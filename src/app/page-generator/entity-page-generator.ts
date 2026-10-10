import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';

export class EntityPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someEntities?): Promise<any> {
        logger.info('Prepare entities');
        Configuration.mainData.entities = someEntities
            ? someEntities
            : DependenciesEngine.getEntities();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.entities.length;
            const loop = () => {
                if (i < len) {
                    const entity = Configuration.mainData.entities[i];
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'entity', entity)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: entity.id,
                        navTabs: this.navTabs.resolve(entity),
                        context: 'entity',
                        entity: entity,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
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
