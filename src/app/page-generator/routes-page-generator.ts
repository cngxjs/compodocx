import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import RouterParserUtil from '../../utils/router-parser.util';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { ROOT_DEPTH } from '../links/layout';

export class RoutesPageGenerator {
    public prepare(): Promise<void> {
        logger.info('Process routes');
        Configuration.mainData.routes = DependenciesEngine.getRoutes();

        return new Promise((resolve, reject) => {
            Configuration.addPage({
                name: 'routes',
                id: 'routes',
                context: 'routes',
                depth: ROOT_DEPTH,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });

            if (Configuration.mainData.exportFormat === COMPODOC_DEFAULTS.exportFormat) {
                RouterParserUtil.generateRoutesIndex(
                    Configuration.mainData.output,
                    Configuration.mainData.routes
                ).then(
                    () => {
                        logger.info(' Routes index generated');
                        resolve();
                    },
                    e => {
                        logger.error(e);
                        reject();
                    }
                );
            } else {
                resolve();
            }
        });
    }
}
