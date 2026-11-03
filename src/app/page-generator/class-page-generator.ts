import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

export class ClassPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someClasses?): Promise<any> {
        logger.info('Prepare classes');
        Configuration.mainData.classes = someClasses
            ? someClasses
            : DependenciesEngine.getClasses();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.classes.length;
            const loop = () => {
                if (i < len) {
                    const classe = Configuration.mainData.classes[i];
                    const readmeFields = attachNeighbourReadme(classe);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'class', classe)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: classe.id,
                        navTabs: this.navTabs.resolve(classe),
                        context: 'class',
                        class: classe,
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
