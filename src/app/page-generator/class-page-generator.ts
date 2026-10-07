import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

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
                    if (MarkdownEngine.hasNeighbourReadmeFile(classe.file)) {
                        logger.info(` ${classe.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(classe.file);
                        classe.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'class',
                        name: classe.name
                    });
                    const page = {
                        path: location.path,
                        name: classe.name,
                        id: classe.id,
                        navTabs: this.navTabs.resolve(classe),
                        context: 'class',
                        class: classe,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (classe.isDuplicate) {
                        page.name += `-${classe.duplicateId}`;
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
