import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';

/**
 * Emits a single `references.html` page at the documentation root under
 * `menuLayout: 'feature'`. The page renders an Angular-style API
 * reference portal — every public symbol across every bucket, laid out
 * as sticky bucket sections and filtered client-side. It replaces the
 * sidebar's References chapter as the exhaustive-catalogue entry point.
 *
 * Skipped entirely under `menuLayout: 'type'` (no bucket concept) and
 * under feature-mode workspaces that produced no buckets (no surface to
 * catalogue).
 */
export class ApiReferencePageGenerator {
    public prepare(): Promise<true> {
        return new Promise(resolve => {
            const layout = Configuration.mainData.menuLayout ?? 'type';
            if (layout !== 'feature') {
                resolve(true);
                return;
            }
            const buckets = DependenciesEngine.categorizedByFeature ?? {};
            if (Object.keys(buckets).length === 0) {
                resolve(true);
                return;
            }
            logger.info('Prepare API reference page');
            const location = pageLocation({ type: 'root', page: 'references' });
            Configuration.addPage({
                path: location.path,
                name: 'references',
                filename: location.filename,
                id: 'references',
                context: 'api-reference',
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            } as any);
            resolve(true);
        });
    }
}
