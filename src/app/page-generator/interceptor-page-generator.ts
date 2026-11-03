import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import { enqueueFunctionalPages } from './functional-pages';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

export class InterceptorPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someInterceptors?): Promise<void> {
        logger.info('Prepare interceptors');

        Configuration.mainData.interceptors = someInterceptors
            ? someInterceptors
            : DependenciesEngine.getInterceptors();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.interceptors.length;
            const loop = () => {
                if (i < len) {
                    const interceptor = Configuration.mainData.interceptors[i];
                    const readmeFields = attachNeighbourReadme(interceptor);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'interceptor', interceptor)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: interceptor.id,
                        navTabs: this.navTabs.resolve(interceptor),
                        context: 'interceptor',
                        injectable: interceptor,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL,
                        ...readmeFields
                    };
                    Configuration.addPage(page);
                    i++;
                    loop();
                } else {
                    enqueueFunctionalPages('interceptor');
                    resolve();
                }
            };
            loop();
        });
    }
}
