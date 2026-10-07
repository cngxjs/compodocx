import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

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
                    if (MarkdownEngine.hasNeighbourReadmeFile(interceptor.file)) {
                        logger.info(` ${interceptor.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(interceptor.file);
                        interceptor.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'interceptor',
                        name: interceptor.name
                    });
                    const page = {
                        path: location.path,
                        name: interceptor.name,
                        id: interceptor.id,
                        navTabs: this.navTabs.resolve(interceptor),
                        context: 'interceptor',
                        injectable: interceptor,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (interceptor.isDuplicate) {
                        page.name += `-${interceptor.duplicateId}`;
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
