import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import type { DiView } from '../di/model';
import { pageLocation } from '../links/layout';
import type { SymbolId } from '../links/symbol-id';
import type { SymbolTable } from '../links/symbol-table';

const LANDING_PAGE = 'dependency-injection';

export interface DiPageCounts {
    readonly clusters: number;
    readonly providers: number;
}

const dataOf = (table: SymbolTable, ids: readonly SymbolId[]): unknown[] =>
    ids.flatMap(id => {
        const entry = table.byId.get(id);
        return entry ? [entry.data] : [];
    });

/**
 * One page per feature type with its providers and feature functions
 * (`providers/<FeatureType>.html`, context `di-cluster`) and one per
 * provider without a feature type (`providers/<name>.html`, context
 * `provider`). Reads the DI view; nothing without the semantic stage.
 */
export class DiPageGenerator {
    /** The landing page `dependency-injection.html` (context `dependency-injection`). */
    public prepareLanding(): Promise<void> {
        const location = pageLocation({ type: 'root', page: LANDING_PAGE });
        Configuration.addPage({
            path: location.path,
            name: location.filename,
            id: LANDING_PAGE,
            context: LANDING_PAGE,
            depth: location.depth,
            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
        });
        return Promise.resolve();
    }

    public prepare(): Promise<DiPageCounts> {
        logger.info('Prepare dependency injection pages');
        const table: SymbolTable | undefined = Configuration.mainData.symbols;
        const view: DiView | undefined = Configuration.mainData.di;
        if (table === undefined || view === undefined) {
            return Promise.resolve({ clusters: 0, providers: 0 });
        }
        for (const cluster of view.clusters) {
            const owner = table.byId.get(cluster.owner);
            if (!owner) {
                continue;
            }
            const location = pageLocation({ type: 'cluster', name: owner.ref.name });
            Configuration.addPage({
                path: location.path,
                name: `cluster-${location.filename}`,
                filename: location.filename,
                id: `cluster-${location.filename}`,
                context: 'di-cluster',
                cluster: {
                    featureType: owner.data,
                    providers: dataOf(table, cluster.providers),
                    features: dataOf(table, cluster.features),
                    tokens: dataOf(table, cluster.tokens)
                },
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            } as never);
        }
        for (const id of view.plainProviders) {
            const entry = table.byId.get(id);
            if (!entry) {
                continue;
            }
            const location = pageLocation({
                type: 'symbol',
                kind: 'provider',
                name: entry.ref.name,
                duplicateName: entry.duplicateName
            });
            Configuration.addPage({
                path: location.path,
                name: `provider-${location.filename}`,
                filename: location.filename,
                id: `provider-${location.filename}`,
                context: 'provider',
                provider: entry.data,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            } as never);
        }
        return Promise.resolve({
            clusters: view.clusters.length,
            providers: view.plainProviders.length
        });
    }
}
