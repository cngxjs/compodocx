import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

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
                    if (MarkdownEngine.hasNeighbourReadmeFile(guard.file)) {
                        logger.info(` ${guard.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(guard.file);
                        guard.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'guard',
                        name: guard.name
                    });
                    const page = {
                        path: location.path,
                        name: guard.name,
                        id: guard.id,
                        navTabs: this.navTabs.resolve(guard),
                        context: 'guard',
                        injectable: guard,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (guard.isDuplicate) {
                        page.name += `-${guard.duplicateId}`;
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
