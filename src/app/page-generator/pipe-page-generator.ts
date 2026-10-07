import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

export class PipePageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(somePipes?): Promise<any> {
        logger.info('Prepare pipes');
        Configuration.mainData.pipes = somePipes ? somePipes : DependenciesEngine.getPipes();

        return new Promise((resolve, _reject) => {
            let i = 0;
            const len = Configuration.mainData.pipes.length;
            const loop = () => {
                if (i < len) {
                    const pipe = Configuration.mainData.pipes[i];
                    if (MarkdownEngine.hasNeighbourReadmeFile(pipe.file)) {
                        logger.info(` ${pipe.name} has a README file, include it`);
                        const readme = MarkdownEngine.readNeighbourReadmeFile(pipe.file);
                        pipe.readme = markedAcl(readme);
                    }
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'pipe',
                        name: pipe.name
                    });
                    const page = {
                        path: location.path,
                        name: pipe.name,
                        id: pipe.id,
                        navTabs: this.navTabs.resolve(pipe),
                        context: 'pipe',
                        pipe: pipe,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };
                    if (pipe.isDuplicate) {
                        page.name += `-${pipe.duplicateId}`;
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
