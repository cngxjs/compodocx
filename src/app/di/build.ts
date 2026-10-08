import {
    compareText,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey
} from '../compiler/semantic/model';
import type { EntityKind } from '../engines/dependencies.engine';
import { type SymbolId, toSymbolKey } from '../links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../links/symbol-table';
import { type Cluster, type DiView, emptyDiView, type Placement } from './model';

const FEATURE_TYPE_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>(['interface', 'typealias']);

const byName =
    (table: SymbolTable) =>
    (a: SymbolId, b: SymbolId): number => {
        const left = table.byId.get(a)?.ref;
        const right = table.byId.get(b)?.ref;
        return compareText(left?.name ?? '', right?.name ?? '') || compareText(a, b);
    };

const byFileAndName =
    (table: SymbolTable) =>
    (a: SymbolId, b: SymbolId): number => {
        const left = table.byId.get(a)?.ref;
        const right = table.byId.get(b)?.ref;
        return (
            compareText(left?.file ?? '', right?.file ?? '') ||
            compareText(left?.name ?? '', right?.name ?? '') ||
            compareText(a, b)
        );
    };

/** Table ids by fact key and kind, so a fact's key finds its documented symbol. */
const indexByKey = (entries: readonly SymbolEntry[]) => {
    const index = new Map<string, SymbolEntry[]>();
    for (const entry of entries) {
        const key = factKey(toSymbolKey(entry.ref));
        index.set(key, [...(index.get(key) ?? []), entry]);
    }
    return (key: SymbolKey, kinds: ReadonlySet<EntityKind>): SymbolId | undefined =>
        index.get(factKey(key))?.find(entry => kinds.has(entry.ref.kind))?.id;
};

const TOKEN_KINDS: ReadonlySet<EntityKind> = new Set<EntityKind>(['token']);

/**
 * Who documents what: providers and feature functions grouped by the feature
 * type they share, plain providers, tokens and the symbols that reach no
 * entry point. Pure; reads the table and the facts, mutates neither.
 */
export const buildDiView = (table: SymbolTable, semantic?: SemanticModel): DiView => {
    if (!semantic) {
        return emptyDiView();
    }
    const entries = [...table.byId.values()];
    const factsOf = (entry: SymbolEntry): SymbolFacts | undefined =>
        semantic.facts.get(factKey(toSymbolKey(entry.ref)));
    const find = indexByKey(entries);

    const hidden = entries.filter(entry => factsOf(entry)?.notExported).map(entry => entry.id);
    const hiddenSet = new Set(hidden);
    const visible = entries.filter(entry => !hiddenSet.has(entry.id));

    const ownerOf = (facts: SymbolFacts | undefined): SymbolId | undefined => {
        const featureType = facts?.di?.featureType;
        const owner = featureType && find(featureType, FEATURE_TYPE_KINDS);
        return owner && !hiddenSet.has(owner) ? owner : undefined;
    };

    const members = new Map<SymbolId, { providers: SymbolId[]; features: SymbolId[] }>();
    const plainProviders: SymbolId[] = [];
    const placement = new Map<SymbolId, Placement>();
    for (const entry of visible) {
        const facts = factsOf(entry);
        const role = facts?.di?.role;
        if (!role) {
            continue;
        }
        const owner = ownerOf(facts);
        if (owner) {
            const cluster = members.get(owner) ?? { providers: [], features: [] };
            (role === 'provider' ? cluster.providers : cluster.features).push(entry.id);
            members.set(owner, cluster);
            placement.set(entry.id, { type: 'cluster', owner });
        } else if (role === 'provider') {
            plainProviders.push(entry.id);
            placement.set(entry.id, { type: 'provider' });
        }
    }

    const tokensOf = (providers: readonly SymbolId[]): SymbolId[] => {
        const ids = providers
            .flatMap(id => {
                const entry = table.byId.get(id);
                return (entry && factsOf(entry)?.di?.providesTokens) ?? [];
            })
            .map(key => find(key, TOKEN_KINDS))
            .filter((id): id is SymbolId => id !== undefined && !hiddenSet.has(id));
        return [...new Set(ids)].sort(byName(table));
    };

    const clusters: Cluster[] = [...members]
        // A feature type only owns a page when a provider accepts it.
        .filter(([, cluster]) => cluster.providers.length > 0)
        .map(([owner, cluster]) => ({
            owner,
            providers: [...cluster.providers].sort(byName(table)),
            features: [...cluster.features].sort(byName(table)),
            tokens: tokensOf(cluster.providers)
        }))
        .sort((a, b) => byName(table)(a.owner, b.owner));
    for (const [, cluster] of members) {
        if (cluster.providers.length === 0) {
            for (const id of cluster.features) {
                placement.delete(id);
            }
        }
    }
    for (const cluster of clusters) {
        placement.set(cluster.owner, { type: 'cluster-owner' });
    }
    for (const id of hidden) {
        placement.set(id, { type: 'hidden' });
    }

    return {
        clusters,
        plainProviders: plainProviders.sort(byName(table)),
        tokens: visible
            .filter(entry => entry.ref.kind === 'token')
            .map(entry => entry.id)
            .sort(byName(table)),
        hidden: hidden.sort(byFileAndName(table)),
        placement
    };
};
