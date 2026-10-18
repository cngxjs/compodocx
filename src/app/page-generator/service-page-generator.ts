import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';

/** Pages of the classes decorated with Angular's `@Service`. */
export class ServicePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someServices?): Promise<void> {
        logger.info('Prepare services');

        Configuration.mainData.services = someServices ?? DependenciesEngine.getServices();

        for (const service of Configuration.mainData.services) {
            if (MarkdownEngine.hasNeighbourReadmeFile(service.file)) {
                logger.info(` ${service.name} has a README file, include it`);
                service.readme = markedAcl(MarkdownEngine.readNeighbourReadmeFile(service.file));
            }
            const location = pageLocation(
                itemTarget(Configuration.mainData.symbols, 'service', service)
            );
            Configuration.addPage({
                path: location.path,
                name: location.filename,
                filename: location.filename,
                id: service.id,
                navTabs: this.navTabs.resolve(service),
                context: 'service',
                service,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            });
        }
        return Promise.resolve();
    }
}
