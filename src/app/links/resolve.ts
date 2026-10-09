import { type DiView, itemId, placementOf } from '../di/model';
import {
    type Href,
    hrefFor,
    isPageKind,
    memberAnchor,
    type PageTarget,
    type UtilityKind
} from './layout';
import { presentationKind, type SymbolId } from './symbol-id';
import {
    entryInFile,
    type LookupPolicy,
    lookupEntry,
    type SymbolEntry,
    type SymbolTable
} from './symbol-table';

export interface SymbolLinkOptions {
    readonly anchor?: string;
    /** Link a same-name copy to its own `-N` page, not the first copy's. */
    readonly duplicate?: boolean;
}

export const symbolTarget = (entry: SymbolEntry, options: SymbolLinkOptions = {}): PageTarget => ({
    type: 'symbol',
    kind: entry.ref.kind,
    name: entry.ref.name,
    duplicateName: options.duplicate ? entry.duplicateName : undefined
});

/** A link destination: the page and the section on it. */
export interface PlacedLink {
    readonly target: PageTarget;
    readonly anchor?: string;
}

/**
 * Where a link to a table entry lands, following its placement in the DI
 * view: its own page, the plain provider page, the cluster page (the
 * feature type) or the member's section on it. Undefined for a hidden
 * symbol. Without a view every symbol has its own page.
 */
export const placedLink = (
    table: SymbolTable,
    entry: SymbolEntry,
    di: DiView | undefined,
    options: SymbolLinkOptions = {}
): PlacedLink | undefined => {
    const placement = placementOf(di, entry.id);
    switch (placement.type) {
        case 'hidden':
            return undefined;
        case 'provider':
            return {
                target: {
                    type: 'symbol',
                    kind: 'provider',
                    name: entry.ref.name,
                    duplicateName: options.duplicate ? entry.duplicateName : undefined
                },
                anchor: options.anchor
            };
        case 'cluster-owner':
            return { target: { type: 'cluster', name: entry.ref.name }, anchor: options.anchor };
        case 'cluster': {
            const owner = table.byId.get(placement.owner)?.ref.name;
            return owner
                ? {
                      target: { type: 'cluster', name: owner },
                      anchor: memberAnchor(entry.ref.name, owner)
                  }
                : undefined;
        }
        default:
            return { target: symbolTarget(entry, options), anchor: options.anchor };
    }
};

export const hrefForSymbol = (
    table: SymbolTable,
    id: SymbolId,
    fromDepth: number,
    options: SymbolLinkOptions = {},
    di?: DiView
): Href | undefined => {
    const entry = table.byId.get(id);
    const link = entry && placedLink(table, entry, di, options);
    return link ? hrefFor(link.target, fromDepth, link.anchor) : undefined;
};

/**
 * `target` (a symbol page of an engine object of `kind`) moved to where the
 * DI view documents the object. Other targets and objects outside the table
 * stay as they are; undefined for a hidden symbol.
 */
export const placeTarget = (
    target: PageTarget,
    item: { readonly name?: unknown; readonly file?: unknown },
    context: { readonly symbols?: SymbolTable; readonly di?: DiView },
    anchor?: string
): PlacedLink | undefined => {
    const { symbols, di } = context;
    const unplaced = symbols === undefined || di === undefined || di.placement.size === 0;
    if (target.type !== 'symbol' || unplaced) {
        return { target, anchor };
    }
    const id = target.kind === 'provider' ? undefined : itemId(target.kind, item);
    const entry = id && symbols.byId.get(id);
    if (!entry || placementOf(di, entry.id).type === 'own') {
        return { target, anchor };
    }
    return placedLink(symbols, entry, di, { anchor, duplicate: !!target.duplicateName });
};

/** Resolve a bare name with a lookup policy, then link it. */
export const hrefForName = (
    table: SymbolTable,
    name: string,
    policy: LookupPolicy,
    fromDepth: number,
    options: SymbolLinkOptions = {}
): Href | undefined => {
    const entry = lookupEntry(table, name, policy);
    return entry && hrefFor(symbolTarget(entry, options), fromDepth, options.anchor);
};

/** Kinds a function or constant is documented as when it is a guard, interceptor or resolver. */
const FUNCTIONAL_PAGE_KINDS = ['guard', 'interceptor', 'resolver'] as const;

const MISC_SUBTYPE: Readonly<Record<string, UtilityKind>> = {
    function: 'function',
    variable: 'variable',
    typealias: 'typealias',
    enum: 'enumeration'
};

/**
 * The page of an engine object, read from its own `type` (or
 * `ctype`/`subtype` for miscellaneous symbols). Undefined for an object the
 * layout has no page for.
 */
export const targetOfData = (data: unknown): PageTarget | undefined => {
    const item = data as {
        name?: string;
        type?: string;
        ctype?: string;
        subtype?: string;
    };
    if (typeof item?.name !== 'string') {
        return undefined;
    }
    if (item.type === 'miscellaneous' || item.ctype === 'miscellaneous') {
        const kind = MISC_SUBTYPE[item.subtype ?? ''];
        return kind
            ? { type: 'symbol', kind: presentationKind(kind, item), name: item.name }
            : undefined;
    }
    const kind = item.type ?? '';
    return isPageKind(kind) ? { type: 'symbol', kind, name: item.name } : undefined;
};

/**
 * A coverage row's page, from its `linktype` (`classe` for classes) and misc
 * `linksubtype`. With a table, a misc row links to its own same-name copy.
 */
export const targetOfCoverage = (
    row: {
        readonly name: string;
        readonly filePath?: string;
        readonly linktype?: string;
        readonly linksubtype?: string;
    },
    options: { readonly table?: SymbolTable } = {}
): PageTarget | undefined => {
    if (row.linksubtype) {
        const kind = MISC_SUBTYPE[row.linksubtype];
        if (!kind) {
            return undefined;
        }
        const table = options.table;
        const entry = table
            ? [kind, ...FUNCTIONAL_PAGE_KINDS]
                  .map(k => entryInFile(table, k, row.name, row.filePath))
                  .find(e => e !== undefined)
            : undefined;
        return {
            type: 'symbol',
            kind: entry?.ref.kind ?? kind,
            name: row.name,
            duplicateName: entry?.duplicateName
        };
    }
    const kind = row.linktype === 'classe' ? 'class' : (row.linktype ?? '');
    return isPageKind(kind) ? { type: 'symbol', kind, name: row.name } : undefined;
};
