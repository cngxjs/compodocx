import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import { pageLocation } from '../links/layout';

/**
 * Emits a single `references.html` page at the documentation root under
 * `menuLayout: 'feature'`: an Angular-style API reference portal with
 * every documented symbol, one section per feature, filtered client-side.
 *
 * Skipped under `menuLayout: 'type'` and when no feature was derived (no
 * semantic stage, or nothing documented).
 */
export class ApiReferencePageGenerator {
    public prepare(): Promise<true> {
        return new Promise(resolve => {
            const layout = Configuration.mainData.menuLayout ?? 'feature';
            if (layout !== 'feature') {
                resolve(true);
                return;
            }
            if ((Configuration.mainData.semantic?.features?.features.length ?? 0) === 0) {
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
