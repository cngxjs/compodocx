import { type Href, hrefFor, isPageKind, type PageTarget, type UtilityKind } from './layout';
import type { SymbolId } from './symbol-id';
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

export const hrefForSymbol = (
    table: SymbolTable,
    id: SymbolId,
    fromDepth: number,
    options: SymbolLinkOptions = {}
): Href | undefined => {
    const entry = table.byId.get(id);
    return entry ? hrefFor(symbolTarget(entry, options), fromDepth, options.anchor) : undefined;
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
        return kind ? { type: 'symbol', kind, name: item.name } : undefined;
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
        const entry = options.table
            ? entryInFile(options.table, kind, row.name, row.filePath)
            : undefined;
        return { type: 'symbol', kind, name: row.name, duplicateName: entry?.duplicateName };
    }
    const kind = row.linktype === 'classe' ? 'class' : (row.linktype ?? '');
    return isPageKind(kind) ? { type: 'symbol', kind, name: row.name } : undefined;
};
