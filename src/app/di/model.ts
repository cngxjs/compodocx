import type { EntityKind } from '../engines/dependencies.engine';
import {
    presentationKind,
    type SymbolId,
    symbolFile,
    symbolId,
    type TableKind
} from '../links/symbol-id';

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

/** Whether a symbol gets no page (it reaches no entry point). */
export const isHidden = (view: DiView | undefined, id: SymbolId): boolean =>
    placementOf(view, id).type === 'hidden';

/** A lookup filter that skips hidden symbols; undefined when nothing is hidden. */
export const hiddenFilter = (view: DiView | undefined): ((id: SymbolId) => boolean) | undefined =>
    view && view.hidden.length > 0 ? id => isHidden(view, id) : undefined;

type NamedItem = { readonly name?: unknown; readonly file?: unknown };

/** The table id of the engine object of `kind` (its `name`, read from its `file`). */
export const itemId = (kind: EntityKind | TableKind, item: NamedItem): SymbolId | undefined => {
    if (typeof item.name !== 'string') {
        return undefined;
    }
    const file = typeof item.file === 'string' ? symbolFile(item.file, process.cwd()) : '';
    return symbolId({ kind: presentationKind(kind as EntityKind, item), file, name: item.name });
};

/** The placement of the engine object of `kind`. */
export const placementOfItem = (
    view: DiView | undefined,
    kind: EntityKind | TableKind,
    item: NamedItem
): Placement => {
    if (!view || view.placement.size === 0) {
        return OWN;
    }
    const id = itemId(kind, item);
    return id ? placementOf(view, id) : OWN;
};

/** Whether the engine object of `kind` gets no page (it reaches no entry point). */
export const isHiddenItem = (
    view: DiView | undefined,
    kind: EntityKind | TableKind,
    item: NamedItem
): boolean => placementOfItem(view, kind, item).type === 'hidden';

/**
 * Whether the engine object of `kind` has a page in its kind folder: not
 * hidden, not a section of a cluster page, not a provider or feature type.
 */
export const hasOwnPage = (
    view: DiView | undefined,
    kind: EntityKind | TableKind,
    item: NamedItem
): boolean => placementOfItem(view, kind, item).type === 'own';

const PAGE_KINDS: ReadonlySet<string> = new Set<EntityKind>([
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
]);

/**
 * Whether a kind page (context = kind, the engine object under that key) is
 * not generated: the symbol is hidden or documented on a provider or cluster page.
 */
export const isMovedPage = (
    page: { readonly context?: unknown } & Record<string, unknown>,
    view: DiView | undefined
): boolean => {
    const kind = page.context;
    if (typeof kind !== 'string' || !PAGE_KINDS.has(kind)) {
        return false;
    }
    const item = page[kind] ?? page.injectable;
    return typeof item === 'object' && item !== null
        ? !hasOwnPage(view, kind as EntityKind, item as NamedItem)
        : false;
};

/** Grouped engine objects (each with its own `kind`) without the hidden ones. */
export const withoutHiddenItems = <T extends { readonly kind?: unknown }>(
    groups: Record<string, readonly T[]>,
    view: DiView | undefined
): Record<string, T[]> =>
    Object.fromEntries(
        Object.entries(groups).map(([key, items]) => [
            key,
            items.filter(item => !isHiddenItem(view, item.kind as EntityKind, item as never))
        ])
    );
