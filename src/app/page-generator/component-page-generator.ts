import * as path from 'node:path';

import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { markedAcl } from '../../utils/marked.acl';
import { collectThemeTokens } from '../../utils/theme-doc-parser';
import Configuration from '../configuration';
import DependenciesEngine from '../engines/dependencies.engine';
import FileEngine from '../engines/file.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { pageLocation } from '../links/layout';
import type { NavTabsResolver } from './nav-tabs';

export class ComponentPageGenerator {
    constructor(private readonly navTabs: NavTabsResolver) {}

    public prepare(someComponents?): Promise<any> {
        logger.info('Prepare components');
        Configuration.mainData.components = someComponents
            ? someComponents
            : DependenciesEngine.getComponents();

        return new Promise((mainPrepareComponentResolve, _mainPrepareComponentReject) => {
            let i = 0;
            const len = Configuration.mainData.components.length;
            const loop = () => {
                if (i <= len - 1) {
                    const component = Configuration.mainData.components[i];
                    if (MarkdownEngine.hasNeighbourReadmeFile(component.file)) {
                        logger.info(` ${component.name} has a README file, include it`);
                        const readmeFile = MarkdownEngine.readNeighbourReadmeFile(component.file);
                        component.readme = markedAcl(readmeFile);
                    }
                    const themeResult = collectThemeTokens({
                        entityFile: component.file,
                        styleUrls: component.styleUrls,
                        styles: component.styles
                    });
                    component.themeTokens = themeResult.tokens;
                    component.themeStyleSources = themeResult.sources;
                    component.themeOverview = themeResult.overview;
                    const location = pageLocation({
                        type: 'symbol',
                        kind: 'component',
                        name: component.name
                    });
                    const page = {
                        path: location.path,
                        name: component.name,
                        id: component.id,
                        navTabs: this.navTabs.resolve(component),
                        context: 'component',
                        component: component,
                        depth: location.depth,
                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                    };

                    if (component.isDuplicate) {
                        page.name += `-${component.duplicateId}`;
                    }
                    Configuration.addPage(page);

                    const componentTemplateUrlPromise = new Promise(
                        (componentTemplateUrlResolve, componentTemplateUrlReject) => {
                            if (component.templateUrl.length > 0) {
                                logger.info(` ${component.name} has a templateUrl, include it`);
                                this.handleTemplateurl(component).then(
                                    () => {
                                        componentTemplateUrlResolve(true);
                                    },
                                    e => {
                                        logger.error(e);
                                        componentTemplateUrlReject();
                                    }
                                );
                            } else {
                                componentTemplateUrlResolve(true);
                            }
                        }
                    );
                    const componentStyleUrlsPromise = new Promise(
                        (componentStyleUrlsResolve, componentStyleUrlsReject) => {
                            if (component.styleUrls.length > 0) {
                                logger.info(` ${component.name} has styleUrls, include them`);
                                this.handleStyleurls(component).then(
                                    () => {
                                        componentStyleUrlsResolve(true);
                                    },
                                    e => {
                                        logger.error(e);
                                        componentStyleUrlsReject();
                                    }
                                );
                            } else {
                                componentStyleUrlsResolve(true);
                            }
                        }
                    );
                    const componentStylesPromise = new Promise(
                        (componentStylesResolve, componentStylesReject) => {
                            if (component.styles.length > 0) {
                                logger.info(` ${component.name} has styles, include them`);
                                this.handleStyles(component).then(
                                    () => {
                                        componentStylesResolve(true);
                                    },
                                    e => {
                                        logger.error(e);
                                        componentStylesReject();
                                    }
                                );
                            } else {
                                componentStylesResolve(true);
                            }
                        }
                    );

                    Promise.all([
                        componentTemplateUrlPromise,
                        componentStyleUrlsPromise,
                        componentStylesPromise
                    ]).then(() => {
                        i++;
                        loop();
                    });
                } else {
                    mainPrepareComponentResolve(true);
                }
            };
            loop();
        });
    }

    private handleTemplateurl(component): Promise<any> {
        const dirname = path.dirname(component.file);
        const templatePath = path.resolve(dirname + path.sep + component.templateUrl);

        if (!FileEngine.existsSync(templatePath)) {
            const err = `Cannot read template for ${component.name}`;
            logger.error(err);
            return new Promise((_resolve, _reject) => {});
        }

        return FileEngine.get(templatePath).then(
            data => (component.templateData = data),
            err => {
                logger.error(err);
                return Promise.reject('');
            }
        );
    }

    private handleStyles(component): Promise<any> {
        const styles = component.styles;
        component.stylesData = '';
        return new Promise((resolveStyles, _rejectStyles) => {
            styles.forEach(style => {
                component.stylesData = `${component.stylesData + style}\n`;
            });
            resolveStyles(true);
        });
    }

    private handleStyleurls(component): Promise<any> {
        const dirname = path.dirname(component.file);

        const styleDataPromise = component.styleUrls.map(styleUrl => {
            const stylePath = path.resolve(dirname + path.sep + styleUrl);

            if (!FileEngine.existsSync(stylePath)) {
                const err = `Cannot read style url ${stylePath} for ${component.name}`;
                logger.error(err);
                return Promise.resolve(null);
            }

            return new Promise((resolve, _reject) => {
                FileEngine.get(stylePath).then(data => {
                    resolve({
                        data,
                        styleUrl
                    });
                });
            });
        });

        return Promise.all(styleDataPromise).then(
            data => (component.styleUrlsData = data.filter(item => item !== null)),
            err => {
                logger.error(err);
                return Promise.reject('');
            }
        );
    }
}
