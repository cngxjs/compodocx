import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

export class InjectablePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someInjectables?): Promise<void> {
        logger.info('Prepare injectables');

        Configuration.mainData.injectables = someInjectables
            ? someInjectables
            : DependenciesEngine.getInjectables();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.injectables.length;
            const loop = () => {
                if (i < len) {
                    const injec = Configuration.mainData.injectables[i];
                    const readmeFields = attachNeighbourReadme(injec);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'injectable', injec)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: injec.id,
                        navTabs: this.navTabs.resolve(injec),
                        context: 'injectable',
                        injectable: injec,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL,
                        ...readmeFields
                    };
                    Configuration.addPage(page);
                    i++;
                    loop();
                } else {
                    resolve();
                }
            };
            loop();
        });
    }
}
