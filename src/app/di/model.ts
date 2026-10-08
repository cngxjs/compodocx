import type { SymbolId } from '../links/symbol-id';

/**
 * Where a symbol is documented. A symbol without an entry in the placement
 * map has its own page (`own`).
 */
export type Placement =
    | { readonly type: 'own' }
    /** A provider without a feature type: a page of its own in the providers folder. */
    | { readonly type: 'provider' }
    /** A provider or feature function: a section on its feature type's page. */
    | { readonly type: 'cluster'; readonly owner: SymbolId }
    /** A feature type: its page is the cluster page. */
    | { readonly type: 'cluster-owner' }
    /** Exported, but no entry point reaches it: no page. */
    | { readonly type: 'hidden' };

/** One feature type with the providers that accept it and the functions that return it. */
export interface Cluster {
    readonly owner: SymbolId;
    /** Sorted by name. */
    readonly providers: readonly SymbolId[];
    /** Sorted by name. */
    readonly features: readonly SymbolId[];
    /** Tokens the providers provide, deduped, sorted by name. */
    readonly tokens: readonly SymbolId[];
}

export interface DiView {
    /** Sorted by feature type name. */
    readonly clusters: readonly Cluster[];
    /** Providers without a feature type, sorted by name. */
    readonly plainProviders: readonly SymbolId[];
    /** Every documented token, sorted by name. */
    readonly tokens: readonly SymbolId[];
    /** Symbols that reach no entry point, sorted by file and name. */
    readonly hidden: readonly SymbolId[];
    /** Only the symbols that are not `own`. */
    readonly placement: ReadonlyMap<SymbolId, Placement>;
}

const OWN: Placement = { type: 'own' };

export const emptyDiView = (): DiView => ({
    clusters: [],
    plainProviders: [],
    tokens: [],
    hidden: [],
    placement: new Map()
});

export const placementOf = (view: DiView | undefined, id: SymbolId): Placement =>
    view?.placement.get(id) ?? OWN;
