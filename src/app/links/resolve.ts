import { type Href, hrefFor, type PageTarget } from './layout';
import type { SymbolId } from './symbol-id';
import { type LookupPolicy, lookupName, type SymbolEntry, type SymbolTable } from './symbol-table';

export interface SymbolLinkOptions {
    readonly anchor?: string;
    /** Link a tagged miscellaneous symbol to its detail page, not the collection anchor. */
    readonly detail?: boolean;
    /** Link a same-name copy to its own `-N` page, not the first copy's. */
    readonly duplicate?: boolean;
}

export const symbolTarget = (entry: SymbolEntry, options: SymbolLinkOptions = {}): PageTarget => ({
    type: 'symbol',
    kind: entry.ref.kind,
    name: entry.ref.name,
    duplicateName: options.duplicate ? entry.duplicateName : undefined,
    detail: Boolean(options.detail && entry.tagged)
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
    const id = lookupName(table, name, policy);
    return id === undefined ? undefined : hrefForSymbol(table, id, fromDepth, options);
};
