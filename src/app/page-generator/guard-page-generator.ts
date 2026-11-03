import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import { enqueueFunctionalPages } from './functional-pages';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

export class GuardPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someGuards?): Promise<void> {
        logger.info('Prepare guards');

        Configuration.mainData.guards = someGuards ? someGuards : DependenciesEngine.getGuards();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.guards.length;
            const loop = () => {
                if (i < len) {
                    const guard = Configuration.mainData.guards[i];
                    const readmeFields = attachNeighbourReadme(guard);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'guard', guard)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: guard.id,
                        navTabs: this.navTabs.resolve(guard),
                        context: 'guard',
                        injectable: guard,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL,
                        ...readmeFields
                    };
                    Configuration.addPage(page);
                    i++;
                    loop();
                } else {
                    enqueueFunctionalPages('guard');
                    resolve();
                }
            };
            loop();
        });
    }
}
