import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

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
                    if (MarkdownEngine.hasNeighbourReadmeFile(injec.file)) {
                        logger.info(` ${injec.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(injec.file);
                        injec.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'injectable',
                        name: injec.name
                    });
                    const page = {
                        path: location.path,
                        name: injec.name,
                        id: injec.id,
                        navTabs: this.navTabs.resolve(injec),
                        context: 'injectable',
                        injectable: injec,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (injec.isDuplicate) {
                        page.name += `-${injec.duplicateId}`;
                    }
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
