import { detectAiGeneratedMarker } from '../../utils/ai-generated.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import MarkdownEngine, { type markdownReadedDatas } from '../engines/markdown.engine';
import { ROOT_DEPTH } from '../links/layout';

export class OverviewPageGenerator {
    public processMarkdowns(): Promise<any> {
        logger.info(
            'Searching README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE.md, TODO.md files'
        );

        return new Promise((resolve, _reject) => {
            let i = 0;
            const markdowns = ['readme', 'changelog', 'contributing', 'license', 'todo'];
            const numberOfMarkdowns = 5;
            const loop = () => {
                if (i < numberOfMarkdowns) {
                    MarkdownEngine.getTraditionalMarkdown(markdowns[i].toUpperCase())
                        .then((readmeData: markdownReadedDatas) => {
                            logger.info(`${markdowns[i].toUpperCase()}.md file found`);
                            const aiGenerated = detectAiGeneratedMarker(readmeData.rawData);
                            if (markdowns[i] === 'readme') {
                                Configuration.mainData.readme = true;
                                if (aiGenerated) {
                                    Configuration.mainData.readmeAiGenerated = aiGenerated;
                                }
                                // Always create index.html as main page with README content
                                Configuration.addPage({
                                    name: 'index',
                                    context: 'readme',
                                    id: 'index',
                                    markdown: readmeData.markdown,
                                    data: readmeData.rawData,
                                    aiGenerated,
                                    depth: ROOT_DEPTH,
                                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                });

                                // If overview is not disabled, also create separate overview page
                                if (!Configuration.mainData.disableOverview) {
                                    Configuration.addPage({
                                        name: 'overview',
                                        context: 'overview',
                                        id: 'overview',
                                        aiGenerated,
                                        depth: ROOT_DEPTH,
                                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                    });
                                }
                            } else {
                                // For other markdown files (changelog, contributing, etc.)
                                Configuration.addPage({
                                    name: markdowns[i],
                                    context: markdowns[i],
                                    id: markdowns[i],
                                    markdown: readmeData.markdown,
                                    data: readmeData.rawData,
                                    aiGenerated,
                                    depth: ROOT_DEPTH,
                                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                });
                                Configuration.mainData.markdowns.push({
                                    name: markdowns[i],
                                    uppername: markdowns[i].toUpperCase(),
                                    depth: ROOT_DEPTH,
                                    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                });
                            }
                            i++;
                            loop();
                        })
                        .catch(errorMessage => {
                            logger.warn(errorMessage);
                            logger.warn(`Continuing without ${markdowns[i].toUpperCase()}.md file`);
                            if (markdowns[i] === 'readme') {
                                if (!Configuration.mainData.disableOverview) {
                                    Configuration.addPage({
                                        name: 'index',
                                        id: 'index',
                                        context: 'overview',
                                        depth: ROOT_DEPTH,
                                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                    });
                                } else {
                                    // When README doesn't exist and overview is disabled,
                                    // generate overview page anyway but show warning
                                    logger.warn(
                                        'No README.md found and --disableOverview is enabled.'
                                    );
                                    logger.warn(
                                        'Generating overview page as landing page. Consider adding a README.md file.'
                                    );
                                    Configuration.addPage({
                                        name: 'index',
                                        id: 'index',
                                        context: 'overview',
                                        depth: ROOT_DEPTH,
                                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                                    });
                                }
                            }
                            i++;
                            loop();
                        });
                } else {
                    resolve(true);
                }
            };
            loop();
        });
    }
}
