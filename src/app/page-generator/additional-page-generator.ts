import * as crypto from 'node:crypto';
import * as path from 'node:path';

import traverse from 'neotraverse/legacy';

import { detectAiGeneratedMarker } from '../../utils/ai-generated.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import { cleanNameWithoutSpaceAndToLowerCase } from '../../utils/utils';
import Configuration from '../configuration';
import FileEngine from '../engines/file.engine';
import MarkdownEngine from '../engines/markdown.engine';
import type { AdditionalNode } from '../interfaces/additional-node.interface';
import { pageLocation } from '../links/layout';
import type { PageWriter } from './page-writer';

export class AdditionalPageGenerator {
    public processAdditionalPages(pageWriter: PageWriter): Promise<void> {
        logger.info('Process additional pages');
        const pages = Configuration.mainData.additionalPages;
        return Promise.all(
            pages.map(page => {
                if (page.children.length > 0) {
                    return Promise.all([
                        pageWriter.processPage(page),
                        ...page.children.map(childPage => pageWriter.processPage(childPage))
                    ]);
                } else {
                    return pageWriter.processPage(page);
                }
            })
        )
            .then(() => undefined)
            .catch(e => {
                logger.error(e);
                return Promise.reject(e);
            });
    }

    public prepareExternalIncludes(): Promise<any> {
        logger.info('Adding external markdown files');
        // Scan include folder for files detailed in summary.json
        // For each file, add to Configuration.mainData.additionalPages
        // Each file will be converted to html page, inside COMPODOC_DEFAULTS.additionalEntryPath
        return new Promise(resolve => {
            FileEngine.get(this.getIncludedPathForFile('summary.json')).then(
                summaryData => {
                    logger.info('Additional documentation: summary.json file found');

                    const parsedSummaryData = JSON.parse(summaryData);

                    const that = this;
                    let lastLevelOnePage;

                    traverse(parsedSummaryData).forEach(function () {
                        // tslint:disable-next-line:no-invalid-this
                        if (this.notRoot && typeof this.node === 'object') {
                            // tslint:disable-next-line:no-invalid-this
                            const rawPath = this.path;
                            // tslint:disable-next-line:no-invalid-this
                            const additionalNode: AdditionalNode = this.node;
                            const file = additionalNode.file;
                            const title = additionalNode.title;
                            const slugs: string[] = [];

                            const finalDepth = rawPath.filter(el => {
                                return !Number.isNaN(parseInt(String(el), 10));
                            });

                            if (typeof file !== 'undefined' && typeof title !== 'undefined') {
                                /**
                                 * Id created with title + file path hash, seems to be hypothetically unique here
                                 */
                                const id = crypto
                                    .createHash('sha512')
                                    .update(title + file)
                                    .digest('hex');

                                // tslint:disable-next-line:no-invalid-this
                                this.node.id = id;

                                let lastElementRootTree;
                                finalDepth.forEach(el => {
                                    let elementTree =
                                        typeof lastElementRootTree === 'undefined'
                                            ? parsedSummaryData
                                            : lastElementRootTree;
                                    if (typeof elementTree.children !== 'undefined') {
                                        elementTree = elementTree.children[el];
                                    } else {
                                        elementTree = elementTree[el];
                                    }
                                    slugs.push(
                                        cleanNameWithoutSpaceAndToLowerCase(elementTree.title)
                                    );
                                    lastElementRootTree = elementTree;
                                });

                                const location = pageLocation({
                                    type: 'additional',
                                    folder: Configuration.mainData.includesFolder,
                                    slugs
                                });
                                const { html: markdownFile, raw: markdownRaw } =
                                    MarkdownEngine.getTraditionalMarkdownSyncWithRaw(
                                        that.getIncludedPathForFile(file)
                                    );
                                const aiGenerated = detectAiGeneratedMarker(markdownRaw);

                                if (finalDepth.length > 5) {
                                    logger.error('Only 5 levels of depth are supported');
                                } else {
                                    const _page = {
                                        name: title,
                                        id: id,
                                        filename: location.filename,
                                        context: 'additional-page',
                                        path: location.path,
                                        additionalPage: markdownFile,
                                        aiGenerated,
                                        depth: location.depth,
                                        childrenLength: additionalNode.children
                                            ? additionalNode.children.length
                                            : 0,
                                        children: [],
                                        lastChild: false,
                                        pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
                                    };
                                    if (finalDepth.length === 1) {
                                        lastLevelOnePage = _page;
                                    }
                                    if (finalDepth.length > 1) {
                                        // store all child pages of the last root level 1 page inside it
                                        lastLevelOnePage.children.push(_page);
                                    } else {
                                        Configuration.addAdditionalPage(_page);
                                    }
                                }
                            }
                        }
                    });

                    resolve(true);
                },
                () => {
                    resolve(true);
                }
            );
        });
    }

    private getIncludedPathForFile(file: string): string {
        return path.join(Configuration.mainData.includes, file);
    }
}
