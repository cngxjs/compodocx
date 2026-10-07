import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { ROOT_DEPTH } from '../links/layout';

export class AppConfigPageGenerator {
    public prepare(): Promise<any> {
        logger.info('Prepare app-config');
        // Generate app-config page if ApplicationConfig found
        Configuration.mainData.appConfig = DependenciesEngine.appConfig;
        if (Configuration.mainData.appConfig?.length > 0) {
            Configuration.addPage({
                name: 'app-config',
                id: 'app-config',
                context: 'app-config',
                depth: ROOT_DEPTH,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });
        }
        return Promise.resolve(true);
    }
}
