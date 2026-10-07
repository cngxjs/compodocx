import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

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
                    if (MarkdownEngine.hasNeighbourReadmeFile(interf.file)) {
                        logger.info(` ${interf.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(interf.file);
                        interf.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'interface',
                        name: interf.name
                    });
                    const page = {
                        path: location.path,
                        name: interf.name,
                        id: interf.id,
                        navTabs: this.navTabs.resolve(interf),
                        context: 'interface',
                        interface: interf,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (interf.isDuplicate) {
                        page.name += `-${interf.duplicateId}`;
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
