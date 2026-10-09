import type { Feature, FeatureId, FeatureModel } from '../../app/compiler/semantic/features';
import { factKey, type SemanticModel } from '../../app/compiler/semantic/model';
import { type DiView, foldClusterMembers, placementOf } from '../../app/di/model';
import { type EntityWithKind, PRIMARY_KINDS } from '../../app/engines/dependencies.engine';
import { featureSegments } from '../../app/links/feature-paths';
import { kindHrefPrefix } from '../../app/links/layout';
import { toSymbolKey } from '../../app/links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';

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

/** Every feature with its page segments, in model order. */
export const placedFeatures = (semantic: SemanticModel | undefined): readonly PlacedFeature[] => {
    const model = semantic?.features;
    return model ? model.features.map(f => derive(model).byId.get(f.id) as PlacedFeature) : [];
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
export const featurePathKey = (segments: readonly string[]): string => segments.join('/');

const asItem = (entry: SymbolEntry): EntityWithKind => ({
    ...(entry.data as object),
    kind: entry.ref.kind,
    hrefPrefix: kindHrefPrefix(entry.ref.kind),
    name: entry.ref.name,
    ...(entry.duplicateName ? { duplicateName: entry.duplicateName } : {})
});

export type FeatureGroupScope = 'primary' | 'all';

const groupCache = new WeakMap<
    SymbolTable,
    Map<FeatureGroupScope, Record<string, EntityWithKind[]>>
>();

/**
 * The documented members of every feature, keyed by the feature's page path
 * (`forms/select`, `forms/select/menu`), copies of the engine objects with
 * their kind. Hidden symbols are left out and the members of a provider
 * cluster fold into one entry. `primary` keeps the primary kinds of a
 * feature, or its whole surface when it has none. Computed once per run.
 */
export const featureGroups = (
    semantic: SemanticModel | undefined,
    table: SymbolTable | undefined,
    view: DiView | undefined,
    scope: FeatureGroupScope
): Record<string, EntityWithKind[]> => {
    const model = semantic?.features;
    if (!model || !table) {
        return {};
    }
    const byScope = groupCache.get(table) ?? new Map();
    groupCache.set(table, byScope);
    const known = byScope.get(scope);
    if (known) {
        return known;
    }
    const { byId } = derive(model);
    const all = new Map<FeatureId, EntityWithKind[]>();
    for (const entry of table.byId.values()) {
        const id = model.featureOf.get(factKey(toSymbolKey(entry.ref)));
        if (id === undefined || placementOf(view, entry.id).type === 'hidden') {
            continue;
        }
        const items = all.get(id) ?? [];
        items.push(asItem(entry));
        all.set(id, items);
    }
    const groups: Record<string, EntityWithKind[]> = {};
    for (const feature of model.features) {
        const items = all.get(feature.id) ?? [];
        const primary = items.filter(item => PRIMARY_KINDS.has(item.kind));
        const listed = scope === 'primary' && primary.length > 0 ? primary : items;
        const folded = foldClusterMembers(listed, view, table);
        if (folded.length > 0) {
            groups[featurePathKey(byId.get(feature.id)?.segments ?? [])] = folded;
        }
    }
    byScope.set(scope, groups);
    return groups;
};
