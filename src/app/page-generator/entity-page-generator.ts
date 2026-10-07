import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
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
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'entity',
                        name: entity.name
                    });
                    const page = {
                        path: location.path,
                        name: entity.name,
                        id: entity.id,
                        navTabs: this.navTabs.resolve(entity),
                        context: 'entity',
                        entity: entity,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (entity.isDuplicate) {
                        page.name += `-${entity.duplicateId}`;
                    }
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
