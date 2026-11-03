import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

export class InterfacePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someInterfaces?): Promise<any> {
        logger.info('Prepare interfaces');
        Configuration.mainData.interfaces = someInterfaces
            ? someInterfaces
            : DependenciesEngine.getInterfaces();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.interfaces.length;
            const loop = () => {
                if (i < len) {
                    const interf = Configuration.mainData.interfaces[i];
                    const readmeFields = attachNeighbourReadme(interf);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'interface', interf)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: interf.id,
                        navTabs: this.navTabs.resolve(interf),
                        context: 'interface',
                        interface: interf,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL,
                        ...readmeFields
                    };
                    Configuration.addPage(page);
                    i++;
                    loop();
                } else {
                    resolve(true);
                }
            };
            loop();
        });
    }
}
