import { factKey, type SemanticModel } from '../compiler/semantic/model';
import type { EntityKind } from '../engines/dependencies.engine';
import {
    presentationKind,
    type SymbolId,
    type SymbolRef,
    symbolFile,
    symbolId,
    type TableKind,
    toSymbolKey
} from './symbol-id';

export interface SymbolEntry {
    readonly id: SymbolId;
    readonly ref: SymbolRef;
    /** The engine object, by reference. Read only. */
    readonly data: unknown;
    /** Page name of a same-name copy, e.g. `Todo-1`. */
    readonly duplicateName?: string;
    /** Import path of the nearest exporting barrel; undefined without semantic facts. */
    readonly entryPoint?: string;
    /** Further engine entries that share the id (overloads, merged declarations). */
    readonly overloads: number;
}

export interface SymbolTable {
    readonly byId: ReadonlyMap<SymbolId, SymbolEntry>;
    /** One id per engine entry, in engine order. An id repeats for each overload. */
    readonly byName: ReadonlyMap<string, readonly SymbolId[]>;
    /** The engine object of each `byName` id, index for index. */
    readonly dataByName: ReadonlyMap<string, readonly unknown[]>;
}

type Named = { readonly name?: unknown; readonly file?: unknown };
type List = readonly Named[] | undefined;

/** The plain arrays a `DependenciesEngine` (or an export) holds. */
export interface EngineData {
    readonly components?: List;
    readonly directives?: List;
    readonly injectables?: List;
    readonly tokens?: List;
    readonly pipes?: List;
    readonly classes?: List;
    readonly interfaces?: List;
    readonly guards?: List;
    readonly interceptors?: List;
    readonly entities?: List;
    readonly miscellaneous?: {
        readonly functions?: List;
        readonly variables?: List;
        readonly typealiases?: List;
        readonly enumerations?: List;
    };
}

const listOf = (data: EngineData, kind: EntityKind): List => {
    switch (kind) {
        case 'component':
            return data.components;
        case 'directive':
            return data.directives;
        case 'injectable':
            return data.injectables;
        case 'token':
            return data.tokens;
        case 'pipe':
            return data.pipes;
        case 'class':
            return data.classes;
        case 'interface':
            return data.interfaces;
        case 'guard':
            return data.guards;
        case 'interceptor':
            return data.interceptors;
        case 'entity':
            return data.entities;
        case 'function':
            return data.miscellaneous?.functions;
        case 'variable':
            return data.miscellaneous?.variables;
        case 'typealias':
            return data.miscellaneous?.typealiases;
        case 'enumeration':
            return data.miscellaneous?.enumerations;
    }
};

/** Kind order of the table's `byName` lists. */
const TABLE_ORDER: readonly EntityKind[] = [
    'component',
    'directive',
    'injectable',
    'token',
    'pipe',
    'class',
    'interface',
    'guard',
    'interceptor',
    'entity',
    'function',
    'variable',
    'typealias',
    'enumeration'
];

/**
 * Kinds whose same-name copies the table numbers itself (`-1`, `-2`, ... in
 * engine order). The engine numbers the other kinds on its own objects; these
 * are left untouched because the export copies them.
 */
const TABLE_SUFFIX_KINDS: ReadonlySet<TableKind> = new Set<TableKind>([
    'function',
    'variable',
    'typealias',
    'enumeration',
    'token'
]);

/** The engine lists the table numbers. */
const SUFFIX_LISTS: readonly EntityKind[] = [
    'function',
    'variable',
    'typealias',
    'enumeration',
    'token'
];

const engineDuplicateName = (item: Named): string | undefined => {
    const name = (item as { duplicateName?: unknown }).duplicateName;
    return typeof name === 'string' ? name : undefined;
};

/** Duplicate names of the table-numbered kinds; overloads (one id) are one symbol. */
const tableDuplicateNames = (
    data: EngineData,
    idOf: (kind: EntityKind, item: Named) => SymbolId
): ReadonlyMap<SymbolId, string> => {
    const names = new Map<SymbolId, string>();
    for (const kind of SUFFIX_LISTS) {
        const seen = new Map<string, SymbolId[]>();
        for (const item of listOf(data, kind) ?? []) {
            if (typeof item?.name !== 'string') {
                continue;
            }
            const id = idOf(kind, item);
            const ids = seen.get(item.name) ?? [];
            if (!ids.includes(id)) {
                ids.push(id);
                seen.set(item.name, ids);
            }
        }
        for (const [name, ids] of seen) {
            ids.slice(1).forEach((id, i) => {
                names.set(id, `${name}-${i + 1}`);
            });
        }
    }
    return names;
};

export interface BuildOptions {
    readonly semantic?: SemanticModel;
    readonly cwd?: string;
}

export const buildSymbolTable = (data: EngineData, options: BuildOptions = {}): SymbolTable => {
    const cwd = options.cwd ?? process.cwd();
    const refOf = (kind: EntityKind, item: Named): SymbolRef => ({
        kind: presentationKind(kind, item),
        file: typeof item.file === 'string' ? symbolFile(item.file, cwd) : '',
        name: item.name as string
    });
    const suffixes = tableDuplicateNames(data, (kind, item) => symbolId(refOf(kind, item)));
    const byId = new Map<SymbolId, SymbolEntry>();
    const byName = new Map<string, SymbolId[]>();
    const dataByName = new Map<string, unknown[]>();
    for (const kind of TABLE_ORDER) {
        for (const item of listOf(data, kind) ?? []) {
            if (typeof item?.name !== 'string') {
                continue;
            }
            const ref = refOf(kind, item);
            const id = symbolId(ref);
            const known = byId.get(id);
            if (known) {
                byId.set(id, { ...known, overloads: known.overloads + 1 });
            } else {
                byId.set(id, {
                    id,
                    ref,
                    data: item,
                    duplicateName: TABLE_SUFFIX_KINDS.has(kind)
                        ? suffixes.get(id)
                        : engineDuplicateName(item),
                    entryPoint: options.semantic?.facts.get(factKey(toSymbolKey(ref)))?.entryPoint,
                    overloads: 0
                });
            }
            const ids = byName.get(item.name);
            if (ids) {
                ids.push(id);
                dataByName.get(item.name)?.push(item);
            } else {
                byName.set(item.name, [id]);
                dataByName.set(item.name, [item]);
            }
        }
    }
    return { byId, byName, dataByName };
};

export const emptySymbolTable = (): SymbolTable => ({
    byId: new Map(),
    byName: new Map(),
    dataByName: new Map()
});

/**
 * How a bare name picks one symbol. Each policy reproduces the tie-break of
 * the lookup it replaced, so a name keeps resolving to the same symbol:
 * - `type-link`: type references. Kinds in a fixed order, no tokens. An exact
 *   name beats a name contained in the query; the first kind with the best
 *   score wins, the last match inside that kind wins. A kind with several
 *   contained names and no exact one does not match.
 * - `doc-link`: `{@link}` targets. First exact name, no tokens.
 * - `entity-index`: the client's entity index. Last exact name; misc kinds
 *   after the class-like kinds, no tokens or entities.
 * - `diff`: export diffs. Last exact name; callers narrow by kind.
 */
export type LookupPolicy = 'type-link' | 'doc-link' | 'entity-index' | 'diff';

const POLICY_KINDS: Readonly<Record<LookupPolicy, readonly TableKind[]>> = {
    'type-link': [
        'injectable',
        'interceptor',
        'guard',
        'resolver',
        'interface',
        'class',
        'component',
        'entity',
        'directive',
        'pipe',
        'variable',
        'function',
        'typealias',
        'enumeration'
    ],
    'doc-link': [
        'component',
        'entity',
        'directive',
        'injectable',
        'interceptor',
        'guard',
        'resolver',
        'interface',
        'pipe',
        'class',
        'enumeration',
        'typealias',
        'variable',
        'function'
    ],
    'entity-index': [
        'component',
        'directive',
        'injectable',
        'pipe',
        'class',
        'interface',
        'guard',
        'interceptor',
        'resolver',
        'function',
        'variable',
        'typealias',
        'enumeration'
    ],
    diff: [...TABLE_ORDER, 'resolver']
};

/** The kinds a policy considers, in its order. */
export const policyKinds = (policy: LookupPolicy): readonly TableKind[] => POLICY_KINDS[policy];

const kindOf = (table: SymbolTable, id: SymbolId): TableKind | undefined =>
    table.byId.get(id)?.ref.kind;

/** One engine entry of a name. */
interface Occurrence {
    readonly id: SymbolId;
    readonly data: unknown;
    readonly kind: TableKind;
}

/** Ids a lookup must skip, e.g. symbols that get no page. */
export type ExcludeId = (id: SymbolId) => boolean;

const occurrencesOf = (table: SymbolTable, name: string, exclude?: ExcludeId): Occurrence[] => {
    const ids = table.byName.get(name) ?? [];
    const data = table.dataByName.get(name) ?? [];
    return ids
        .map((id, i) => ({ id, data: data[i], kind: kindOf(table, id) as TableKind }))
        .filter(o => !exclude?.(o.id));
};

/** The occurrences in the policy's kind order (engine order inside a kind). */
const inKindOrder = (occurrences: readonly Occurrence[], kinds: readonly TableKind[]) => {
    const rank = (o: Occurrence) => kinds.indexOf(o.kind);
    return occurrences.filter(o => rank(o) !== -1).sort((a, b) => rank(a) - rank(b));
};

const lastOfFirstKind = (ordered: readonly Occurrence[]): Occurrence | undefined => {
    const first = ordered[0];
    return first && ordered.filter(o => o.kind === first.kind).at(-1);
};

/** A kind with exactly one name contained in `name` matches with the lower score. */
const containedMatch = (
    table: SymbolTable,
    name: string,
    kinds: readonly TableKind[],
    exclude?: ExcludeId
): Occurrence | undefined => {
    const perKind = new Map<TableKind, Occurrence[]>();
    for (const other of table.byName.keys()) {
        if (name.indexOf(other) === -1) {
            continue;
        }
        for (const occurrence of occurrencesOf(table, other, exclude)) {
            const hits = perKind.get(occurrence.kind);
            if (hits) {
                hits.push(occurrence);
            } else {
                perKind.set(occurrence.kind, [occurrence]);
            }
        }
    }
    for (const kind of kinds) {
        const hits = perKind.get(kind);
        if (hits?.length === 1) {
            return hits[0];
        }
    }
    return undefined;
};

const lookupOccurrence = (
    table: SymbolTable,
    name: string,
    policy: LookupPolicy,
    kind?: TableKind,
    exclude?: ExcludeId
): Occurrence | undefined => {
    if (typeof name !== 'string') {
        return undefined;
    }
    const kinds = kind ? POLICY_KINDS[policy].filter(k => k === kind) : POLICY_KINDS[policy];
    const exact = inKindOrder(occurrencesOf(table, name, exclude), kinds);
    switch (policy) {
        case 'type-link':
            return lastOfFirstKind(exact) ?? containedMatch(table, name, kinds, exclude);
        case 'doc-link':
            return exact[0];
        default:
            return exact.at(-1);
    }
};

export const lookupName = (
    table: SymbolTable,
    name: string,
    policy: LookupPolicy,
    kind?: TableKind,
    exclude?: ExcludeId
): SymbolId | undefined => lookupOccurrence(table, name, policy, kind, exclude)?.id;

/** The duplicate name of one engine object: the table's for the kinds it numbers. */
const duplicateNameFor = (entry: SymbolEntry, data: Named): string | undefined =>
    TABLE_SUFFIX_KINDS.has(entry.ref.kind) ? entry.duplicateName : engineDuplicateName(data);

/**
 * Like `lookupName`, but returns the entry as the chosen engine object sees
 * it: overloads of one id keep their own data and engine duplicate name.
 */
export const lookupEntry = (
    table: SymbolTable,
    name: string,
    policy: LookupPolicy,
    kind?: TableKind,
    exclude?: ExcludeId
): SymbolEntry | undefined => {
    const occurrence = lookupOccurrence(table, name, policy, kind, exclude);
    const entry = occurrence && table.byId.get(occurrence.id);
    if (!occurrence || !entry) {
        return undefined;
    }
    const data = occurrence.data as Named;
    return { ...entry, data, duplicateName: duplicateNameFor(entry, data) };
};

/** The entry of `name` and `kind` whose engine object was read from `file`. */
export const entryInFile = (
    table: SymbolTable,
    kind: TableKind,
    name: string,
    file: string | undefined
): SymbolEntry | undefined => {
    const occurrence = occurrencesOf(table, name).find(
        o => o.kind === kind && (o.data as Named).file === file
    );
    const entry = occurrence && table.byId.get(occurrence.id);
    if (!occurrence || !entry) {
        return undefined;
    }
    const data = occurrence.data as Named;
    return { ...entry, data, duplicateName: duplicateNameFor(entry, data) };
};

/** Names that more than one symbol carries. */
export const ambiguousNames = (table: SymbolTable): readonly string[] =>
    [...table.byName]
        .filter(([, ids]) => new Set(ids).size > 1)
        .map(([name]) => name)
        .sort();
