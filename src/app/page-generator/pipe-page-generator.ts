import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import { pageLocation } from '../links/layout';
import { itemTarget } from '../links/resolve';
import type { NavTabsResolver } from './nav-tabs';
import { attachNeighbourReadme } from './neighbour-readme';

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
                    const readmeFields = attachNeighbourReadme(pipe);
                    const location = pageLocation(
                        itemTarget(Configuration.mainData.symbols, 'pipe', pipe)
                    );
                    const page = {
                        path: location.path,
                        name: location.filename,
                        filename: location.filename,
                        id: pipe.id,
                        navTabs: this.navTabs.resolve(pipe),
                        context: 'pipe',
                        pipe: pipe,
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
