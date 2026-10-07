import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import { ROOT_DEPTH } from '../links/layout';

export class PackageDependenciesPageGenerator {
    public processPeerDependencies(dependencies): void {
        logger.info('Processing package.json peerDependencies');
        Configuration.mainData.packagePeerDependencies = dependencies;
        if (!Configuration.hasPage('dependencies')) {
            Configuration.addPage({
                name: 'dependencies',
                id: 'packageDependencies',
                context: 'package-dependencies',
                depth: ROOT_DEPTH,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });
        }
    }

    public processDependencies(dependencies): void {
        logger.info('Processing package.json dependencies');
        Configuration.mainData.packageDependencies = dependencies;
        Configuration.addPage({
            name: 'dependencies',
            id: 'packageDependencies',
            context: 'package-dependencies',
            depth: ROOT_DEPTH,
            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
        });
    }
}
