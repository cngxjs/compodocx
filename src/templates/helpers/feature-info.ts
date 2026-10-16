import type { Feature, FeatureId, FeatureModel } from '../../app/compiler/semantic/features';
import { factKey, type SemanticModel } from '../../app/compiler/semantic/model';
import { type DiView, foldClusterMembers, placementOf } from '../../app/di/model';
import { type EntityWithKind, PRIMARY_KINDS } from '../../app/engines/dependencies.engine';
import { featureSegments } from '../../app/links/feature-paths';
import { presentationKind, type TableKind, toSymbolKey } from '../../app/links/symbol-id';
import { entryInFile, type SymbolEntry, type SymbolTable } from '../../app/links/symbol-table';
import {
    DEFAULT_MENU_FEATURE_SECTIONS,
    type MenuFeatureSections,
    type MenuPlacement
} from '../../utils/menu-feature-sections';
import { sectionOf } from './feature-sections';

/** A feature with the segments of its page. */
export interface PlacedFeature {
    readonly feature: Feature;
    readonly segments: readonly string[];
}

export interface FeatureInfo extends PlacedFeature {
    /** The entry point's (or app's) root feature, when there is one. */
    readonly root?: PlacedFeature;
}

interface Derived {
    readonly byId: ReadonlyMap<FeatureId, PlacedFeature>;
    /** Root feature per entry point (`''` for apps and folders). */
    readonly roots: ReadonlyMap<string, PlacedFeature>;
}

const derived = new WeakMap<FeatureModel, Derived>();

/** Segments and root features of a model, computed once per model. */
const derive = (model: FeatureModel): Derived => {
    const known = derived.get(model);
    if (known) {
        return known;
    }
    const { segments } = featureSegments(model.features);
    const byId = new Map<FeatureId, PlacedFeature>();
    const roots = new Map<string, PlacedFeature>();
    for (const feature of model.features) {
        const placed = { feature, segments: segments.get(feature.id) ?? [] };
        byId.set(feature.id, placed);
        if (feature.key === '') {
            roots.set(feature.entryPoint ?? '', placed);
        }
    }
    const result = { byId, roots };
    derived.set(model, result);
    return result;
};

/** The feature of a table entry, its page and its entry point's root feature. */
export const featureInfoOf = (
    semantic: SemanticModel | undefined,
    entry: SymbolEntry | undefined
): FeatureInfo | undefined => {
    const model = semantic?.features;
    const id = entry && model?.featureOf.get(factKey(toSymbolKey(entry.ref)));
    if (!model || id === undefined) {
        return undefined;
    }
    const { byId, roots } = derive(model);
    const placed = byId.get(id);
    if (!placed) {
        return undefined;
    }
    const root = roots.get(placed.feature.entryPoint ?? '');
    return root && root.feature.id !== id ? { ...placed, root } : placed;
};

const pagePaths = new WeakMap<FeatureModel, ReadonlySet<string>>();

/** Group keys (page paths) of every feature, computed once per model. */
export const featurePagePaths = (semantic: SemanticModel | undefined): ReadonlySet<string> => {
    const model = semantic?.features;
    if (!model) {
        return new Set();
    }
    let paths = pagePaths.get(model);
    if (!paths) {
        paths = new Set([...derive(model).byId.values()].map(p => p.segments.join('/')));
        pagePaths.set(model, paths);
    }
    return paths;
};

/** Group key of an app's root feature (no entry point), listed first in the sidebar. */
export const appRootPath = (semantic: SemanticModel | undefined): string | undefined => {
    const model = semantic?.features;
    const root = model && derive(model).roots.get('');
    return root && root.feature.entryPoint === undefined ? root.segments.join('/') : undefined;
};

/** Root-relative path of a feature page's segments, the key of its group. */
const featurePathKey = (segments: readonly string[]): string => segments.join('/');

const asItem = (entry: SymbolEntry): EntityWithKind => ({
    ...(entry.data as object),
    kind: entry.ref.kind,
    name: entry.ref.name
});

const groupCache = new WeakMap<SymbolTable, Record<string, EntityWithKind[]>>();

/** The documented members of every feature with their table entry, hidden symbols left out. */
const membersByFeature = (
    model: FeatureModel,
    table: SymbolTable,
    view: DiView | undefined
): ReadonlyMap<FeatureId, readonly SymbolEntry[]> => {
    const all = new Map<FeatureId, SymbolEntry[]>();
    for (const entry of table.byId.values()) {
        const id = model.featureOf.get(factKey(toSymbolKey(entry.ref)));
        if (id === undefined || placementOf(view, entry.id).type === 'hidden') {
            continue;
        }
        const entries = all.get(id) ?? [];
        entries.push(entry);
        all.set(id, entries);
    }
    return all;
};

/**
 * The documented members of every feature, keyed by the feature's page path
 * (`forms/select`, `forms/select/menu`), copies of the engine objects with
 * their kind. Hidden symbols are left out and the members of a provider
 * cluster fold into one entry. Computed once per run.
 */
export const featureGroups = (
    semantic: SemanticModel | undefined,
    table: SymbolTable | undefined,
    view: DiView | undefined
): Record<string, EntityWithKind[]> => {
    const model = semantic?.features;
    if (model === undefined || table === undefined) {
        return {};
    }
    const known = groupCache.get(table);
    if (known) {
        return known;
    }
    const { byId } = derive(model);
    const all = membersByFeature(model, table, view);
    const groups: Record<string, EntityWithKind[]> = {};
    for (const feature of model.features) {
        const folded = foldClusterMembers((all.get(feature.id) ?? []).map(asItem), view, table);
        if (folded.length > 0) {
            groups[featurePathKey(byId.get(feature.id)?.segments ?? [])] = folded;
        }
    }
    groupCache.set(table, groups);
    return groups;
};

/** Role nodes in sidebar order; non-primary classes always go into "More". */
const NODE_ROLES = ['configuration', 'utilities', 'constants', 'types', 'classes'] as const;

export type MenuNodeRole = (typeof NODE_ROLES)[number];

/** A role node of a feature, or a labelled group inside its "More" node. */
export interface FeatureMenuNode {
    readonly role: MenuNodeRole;
    readonly items: readonly EntityWithKind[];
}

export interface FeatureMenuTiers {
    /** Roles with a node of their own, in `NODE_ROLES` order. */
    readonly own: readonly FeatureMenuNode[];
    /** Labelled groups of the "More" node, in `NODE_ROLES` order. */
    readonly more: readonly FeatureMenuNode[];
}

export interface FeatureMenu {
    /** Top-level members per feature page path (the tree's groups); may be empty when tiers exist. */
    readonly groups: Record<string, EntityWithKind[]>;
    /** Role nodes per feature page path, only for features with a primary member. */
    readonly tiers: Readonly<Record<string, FeatureMenuTiers>>;
}

/** Where a member of a feature with primary members shows in the sidebar. */
const menuPlaceOf = (
    entry: SymbolEntry,
    view: DiView | undefined,
    sections: MenuFeatureSections
): { readonly role: MenuNodeRole; readonly placement: MenuPlacement } | 'top' | undefined => {
    if (entry.ref.kind === 'style') {
        return 'top';
    }
    const role = sectionOf(entry, view);
    if (role === undefined) {
        return undefined;
    }
    if (role === 'configuration') {
        return { role, placement: sections.configuration };
    }
    if (PRIMARY_KINDS.has(entry.ref.kind)) {
        return 'top';
    }
    if (role === 'utilities' || role === 'constants' || role === 'types') {
        return { role, placement: sections[role] };
    }
    return role === 'classes' ? { role, placement: 'more' } : 'top';
};

const menuCache = new WeakMap<SymbolTable, Map<string, FeatureMenu>>();

/**
 * The sidebar members of every feature, keyed by page path. A feature with
 * a primary member lists its primary members and style files at the top
 * level and the other roles in role nodes as `sections` places them
 * (`own`: a node per role, `more`: one "More" node, `top`: flat, `hidden`:
 * left out); a feature without one lists its whole surface flat. Cluster
 * members fold into one entry per list. Computed once per run and sections.
 */
export const featureMenu = (
    semantic: SemanticModel | undefined,
    table: SymbolTable | undefined,
    view: DiView | undefined,
    sections: MenuFeatureSections = DEFAULT_MENU_FEATURE_SECTIONS
): FeatureMenu => {
    const model = semantic?.features;
    if (model === undefined || table === undefined) {
        return { groups: {}, tiers: {} };
    }
    const bySections = menuCache.get(table) ?? new Map<string, FeatureMenu>();
    menuCache.set(table, bySections);
    const key = JSON.stringify(sections);
    const known = bySections.get(key);
    if (known) {
        return known;
    }
    const { byId } = derive(model);
    const all = membersByFeature(model, table, view);
    const groups: Record<string, EntityWithKind[]> = {};
    const tiers: Record<string, FeatureMenuTiers> = {};
    const fold = (entries: readonly SymbolEntry[]) =>
        foldClusterMembers(entries.map(asItem), view, table);
    for (const feature of model.features) {
        const path = featurePathKey(byId.get(feature.id)?.segments ?? []);
        const entries = all.get(feature.id) ?? [];
        if (!entries.some(entry => PRIMARY_KINDS.has(entry.ref.kind))) {
            const flat = fold(entries);
            if (flat.length > 0) {
                groups[path] = flat;
            }
            continue;
        }
        const top: SymbolEntry[] = [];
        const styles: SymbolEntry[] = [];
        const byRole = new Map<
            MenuNodeRole,
            { placement: MenuPlacement; entries: SymbolEntry[] }
        >();
        for (const entry of entries) {
            const place = menuPlaceOf(entry, view, sections);
            if (place === undefined || (place !== 'top' && place.placement === 'hidden')) {
                continue;
            }
            if (place === 'top' || place.placement === 'top') {
                (entry.ref.kind === 'style' ? styles : top).push(entry);
                continue;
            }
            const node = byRole.get(place.role) ?? { placement: place.placement, entries: [] };
            node.entries.push(entry);
            byRole.set(place.role, node);
        }
        const nodes = (placement: MenuPlacement): FeatureMenuNode[] =>
            NODE_ROLES.flatMap(role => {
                const node = byRole.get(role);
                return node?.placement === placement ? [{ role, items: fold(node.entries) }] : [];
            });
        const own = nodes('own');
        const more = nodes('more');
        const listed = fold([...top, ...styles]);
        if (listed.length > 0 || own.length > 0 || more.length > 0) {
            groups[path] = listed;
        }
        if (own.length > 0 || more.length > 0) {
            tiers[path] = { own, more };
        }
    }
    const menu = { groups, tiers };
    bySections.set(key, menu);
    return menu;
};

/** An engine object as far as the grouping reads it. */
type GroupableItem = { readonly name?: unknown; readonly file?: unknown };

const itemGroups = new WeakMap<
    object,
    { model: FeatureModel; groups: Record<string, GroupableItem[]> }
>();

/**
 * Engine objects of one kind grouped by the page path of their feature, for
 * the kind chapters of the type layout. Objects without a feature stay out
 * (the chapter lists them ungrouped). Computed once per list and model.
 */
export const groupItemsByFeature = (
    semantic: SemanticModel | undefined,
    table: SymbolTable | undefined,
    kind: TableKind,
    items: readonly GroupableItem[] | undefined
): Record<string, GroupableItem[]> => {
    const model = semantic?.features;
    if (model === undefined || table === undefined || items === undefined || items.length === 0) {
        return {};
    }
    const known = itemGroups.get(items);
    if (known && known.model === model) {
        return known.groups;
    }
    const groups: Record<string, GroupableItem[]> = {};
    for (const item of items) {
        const file = typeof item?.file === 'string' ? item.file : undefined;
        const entry =
            typeof item?.name === 'string'
                ? entryInFile(table, presentationKind(kind as never, item), item.name, file)
                : undefined;
        const info = featureInfoOf(semantic, entry);
        if (info) {
            const key = featurePathKey(info.segments);
            (groups[key] ??= []).push(item);
        }
    }
    itemGroups.set(items, { model, groups });
    return groups;
};
