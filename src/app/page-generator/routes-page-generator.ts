import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import { ROOT_DEPTH } from '../links/layout';

/** Adds the routes page; it renders `mainData.routing` and needs no script. */
export class RoutesPageGenerator {
    public prepare(): Promise<void> {
        logger.info('Process routes');
        Configuration.addPage({
            name: 'routes',
            id: 'routes',
            context: 'routes',
            depth: ROOT_DEPTH,
            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
        });
        return Promise.resolve();
    }
}
