import { factKey, type SemanticModel } from '../compiler/semantic/model';
import type { EntityKind } from '../engines/dependencies.engine';
import { type SymbolId, type SymbolRef, symbolFile, symbolId, toSymbolKey } from './symbol-id';

export interface SymbolEntry {
    readonly id: SymbolId;
    readonly ref: SymbolRef;
    /** The engine object, by reference. Read only. */
    readonly data: unknown;
    /** Page name of a same-name copy, e.g. `Todo-1`. */
    readonly duplicateName?: string;
    /** A miscellaneous symbol with its own detail page (non-empty `@category`). */
    readonly tagged: boolean;
    /** Import path of the nearest exporting barrel; undefined without semantic facts. */
    readonly entryPoint?: string;
    /** Further engine entries that share the id (overloads, merged declarations). */
    readonly overloads: number;
}

export interface SymbolTable {
    readonly byId: ReadonlyMap<SymbolId, SymbolEntry>;
    /** One id per engine entry, in engine order. An id repeats for each overload. */
    readonly byName: ReadonlyMap<string, readonly SymbolId[]>;
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

const MISC_KINDS: ReadonlySet<EntityKind> = new Set([
    'function',
    'variable',
    'typealias',
    'enumeration'
]);

const isTagged = (kind: EntityKind, item: Named): boolean => {
    const category = (item as { category?: unknown }).category;
    return MISC_KINDS.has(kind) && typeof category === 'string' && category.trim() !== '';
};

const duplicateNameOf = (item: Named): string | undefined => {
    const name = (item as { duplicateName?: unknown }).duplicateName;
    return typeof name === 'string' ? name : undefined;
};

export interface BuildOptions {
    readonly semantic?: SemanticModel;
    readonly cwd?: string;
}

export const buildSymbolTable = (data: EngineData, options: BuildOptions = {}): SymbolTable => {
    const cwd = options.cwd ?? process.cwd();
    const byId = new Map<SymbolId, SymbolEntry>();
    const byName = new Map<string, SymbolId[]>();
    for (const kind of TABLE_ORDER) {
        for (const item of listOf(data, kind) ?? []) {
            if (typeof item?.name !== 'string') {
                continue;
            }
            const file = typeof item.file === 'string' ? symbolFile(item.file, cwd) : '';
            const ref: SymbolRef = { kind, file, name: item.name };
            const id = symbolId(ref);
            const known = byId.get(id);
            if (known) {
                byId.set(id, { ...known, overloads: known.overloads + 1 });
            } else {
                byId.set(id, {
                    id,
                    ref,
                    data: item,
                    duplicateName: duplicateNameOf(item),
                    tagged: isTagged(kind, item),
                    entryPoint: options.semantic?.facts.get(factKey(toSymbolKey(ref)))?.entryPoint,
                    overloads: 0
                });
            }
            const ids = byName.get(item.name);
            if (ids) {
                ids.push(id);
            } else {
                byName.set(item.name, [id]);
            }
        }
    }
    return { byId, byName };
};

export const emptySymbolTable = (): SymbolTable => ({ byId: new Map(), byName: new Map() });

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
 * - `referenced-by`: targets of "Referenced by". Last exact name over
 *   interfaces, tokens and misc kinds.
 * - `diff`: export diffs. Last exact name; callers narrow by kind.
 */
export type LookupPolicy = 'type-link' | 'doc-link' | 'entity-index' | 'referenced-by' | 'diff';

const POLICY_KINDS: Readonly<Record<LookupPolicy, readonly EntityKind[]>> = {
    'type-link': [
        'injectable',
        'interceptor',
        'guard',
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
        'function',
        'variable',
        'typealias',
        'enumeration'
    ],
    'referenced-by': ['interface', 'token', 'function', 'variable', 'typealias', 'enumeration'],
    diff: TABLE_ORDER
};

const kindOf = (table: SymbolTable, id: SymbolId): EntityKind | undefined =>
    table.byId.get(id)?.ref.kind;

/** The ids of `name`, in the policy's kind order (engine order inside a kind). */
const candidates = (
    table: SymbolTable,
    ids: readonly SymbolId[],
    kinds: readonly EntityKind[]
): SymbolId[] => {
    const rank = (id: SymbolId) => kinds.indexOf(kindOf(table, id) as EntityKind);
    return ids.filter(id => rank(id) !== -1).sort((a, b) => rank(a) - rank(b));
};

const lastOfFirstKind = (
    table: SymbolTable,
    ordered: readonly SymbolId[]
): SymbolId | undefined => {
    const first = ordered[0];
    if (first === undefined) {
        return undefined;
    }
    const kind = kindOf(table, first);
    return ordered.filter(id => kindOf(table, id) === kind).at(-1);
};

/** A kind with exactly one name contained in `name` matches with the lower score. */
const containedMatch = (
    table: SymbolTable,
    name: string,
    kinds: readonly EntityKind[]
): SymbolId | undefined => {
    const perKind = new Map<EntityKind, SymbolId[]>();
    for (const [other, ids] of table.byName) {
        if (name.indexOf(other) === -1) {
            continue;
        }
        for (const id of ids) {
            const kind = kindOf(table, id) as EntityKind;
            const hits = perKind.get(kind);
            if (hits) {
                hits.push(id);
            } else {
                perKind.set(kind, [id]);
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

export const lookupName = (
    table: SymbolTable,
    name: string,
    policy: LookupPolicy,
    kind?: EntityKind
): SymbolId | undefined => {
    if (typeof name !== 'string') {
        return undefined;
    }
    const kinds = kind ? POLICY_KINDS[policy].filter(k => k === kind) : POLICY_KINDS[policy];
    const exact = candidates(table, table.byName.get(name) ?? [], kinds);
    switch (policy) {
        case 'type-link':
            return lastOfFirstKind(table, exact) ?? containedMatch(table, name, kinds);
        case 'doc-link':
            return exact[0];
        default:
            return exact.at(-1);
    }
};

/** Names that more than one symbol carries. */
export const ambiguousNames = (table: SymbolTable): readonly string[] =>
    [...table.byName]
        .filter(([, ids]) => new Set(ids).size > 1)
        .map(([name]) => name)
        .sort();
