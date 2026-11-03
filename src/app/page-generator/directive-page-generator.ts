import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

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
                    const readmeFields = attachNeighbourReadme(directive);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'directive', directive)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: directive.id,
                        navTabs: this.navTabs.resolve(directive),
                        context: 'directive',
                        directive: directive,
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
