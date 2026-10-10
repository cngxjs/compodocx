import { type DiView, itemId, placementOf } from '../di/model';
import {
    type Href,
    hrefFor,
    isPageKind,
    memberAnchor,
    type PageKind,
    type PageTarget,
    safeFileName,
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
}

/** The own page of a table entry. */
export const symbolTarget = (entry: SymbolEntry): PageTarget => ({
    type: 'symbol',
    kind: entry.ref.kind,
    name: entry.ref.name,
    file: entry.fileName
});

/**
 * The own page of an engine object of `kind`, through its table entry. An
 * object the table does not hold keeps its safe name.
 */
export const itemTarget = (
    table: SymbolTable | undefined,
    kind: PageKind,
    item: { readonly name?: unknown; readonly file?: unknown }
): PageTarget => {
    const name = String(item.name);
    const entry =
        table && kind !== 'provider'
            ? entryInFile(table, kind, name, item.file as string | undefined)
            : undefined;
    return entry ? symbolTarget(entry) : { type: 'symbol', kind, name, file: safeFileName(name) };
};

/** The page of a feature type (the cluster owner) with its providers and feature functions. */
export const clusterTarget = (owner: SymbolEntry): PageTarget => ({
    type: 'cluster',
    name: owner.ref.name,
    file: owner.fileName
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
                    file: entry.fileName
                },
                anchor: options.anchor
            };
        case 'cluster-owner':
            return { target: clusterTarget(entry), anchor: options.anchor };
        case 'cluster': {
            const owner = table.byId.get(placement.owner);
            return owner
                ? {
                      target: clusterTarget(owner),
                      anchor: memberAnchor(entry.ref.name, owner.ref.name)
                  }
                : undefined;
        }
        default:
            return { target: symbolTarget(entry), anchor: options.anchor };
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
    return placedLink(symbols, entry, di, { anchor });
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
    return entry && hrefFor(symbolTarget(entry), fromDepth, options.anchor);
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
export const targetOfData = (data: unknown, table?: SymbolTable): PageTarget | undefined => {
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
        return kind ? itemTarget(table, presentationKind(kind, item), item) : undefined;
    }
    const kind = item.type ?? '';
    return isPageKind(kind) ? itemTarget(table, kind, item) : undefined;
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
        return entry
            ? symbolTarget(entry)
            : { type: 'symbol', kind, name: row.name, file: safeFileName(row.name) };
    }
    const kind = row.linktype === 'classe' ? 'class' : (row.linktype ?? '');
    return isPageKind(kind)
        ? itemTarget(options.table, kind, { name: row.name, file: row.filePath })
        : undefined;
};
