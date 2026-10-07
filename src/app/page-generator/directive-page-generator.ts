import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

export class DirectivePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someDirectives?): Promise<any> {
        logger.info('Prepare directives');

        Configuration.mainData.directives = someDirectives
            ? someDirectives
            : DependenciesEngine.getDirectives();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.directives.length;
            const loop = () => {
                if (i < len) {
                    const directive = Configuration.mainData.directives[i];
                    if (MarkdownEngine.hasNeighbourReadmeFile(directive.file)) {
                        logger.info(` ${directive.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(directive.file);
                        directive.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'directive',
                        name: directive.name
                    });
                    const page = {
                        path: location.path,
                        name: directive.name,
                        id: directive.id,
                        navTabs: this.navTabs.resolve(directive),
                        context: 'directive',
                        directive: directive,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (directive.isDuplicate) {
                        page.name += `-${directive.duplicateId}`;
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
