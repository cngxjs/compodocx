import * as path from 'node:path';

import { err, isErr, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import FileEngine from '../engines/file.engine';
import MarkdownEngine from '../engines/markdown.engine';
import { type PageLocation, pageLocation } from '../links/layout';
import {
    type LabelMap,
    labelsFileMessage,
    parseLabelMap,
    resolveAdditionalPages
} from './additional-page-resolver';
import { buildAdditionalPages } from './additional-page-tree';
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
        return new Promise((resolve, reject) => {
            FileEngine.get(this.getIncludedPathForFile('summary.json')).then(
                async summaryData => {
                    logger.info('Additional documentation: summary.json file found');

                    const parsedSummaryData = JSON.parse(summaryData);

                    const labelsPath = Configuration.mainData.includesLabels;
                    let labels: LabelMap | undefined;
                    if (labelsPath) {
                        const loaded = await this.loadLabels(labelsPath);
                        if (isErr(loaded)) {
                            reject(loaded.message);
                            return;
                        }
                        labels = loaded.value;
                    }

                    const resolved = resolveAdditionalPages(parsedSummaryData, labels, labelsPath);
                    if (isErr(resolved)) {
                        reject(resolved.message);
                        return;
                    }
                    const { pages, aliases } = buildAdditionalPages(
                        resolved.value,
                        file =>
                            MarkdownEngine.getTraditionalMarkdownSyncWithRaw(
                                this.getIncludedPathForFile(file)
                            ),
                        segments => this.locationOf(segments)
                    );
                    for (const page of pages) {
                        Configuration.addAdditionalPage(page);
                    }
                    Configuration.mainData.additionalAliases = aliases;
                    resolve(true);
                },
                () => {
                    resolve(true);
                }
            );
        });
    }

    private loadLabels(labelsPath: string): Promise<Result<LabelMap, string>> {
        return FileEngine.get(labelsPath).then(
            raw => parseLabelMap(raw, labelsPath),
            () => err(labelsFileMessage(labelsPath, 'unreadable'))
        );
    }

    private locationOf(slugs: readonly string[]): PageLocation {
        return pageLocation({
            type: 'additional',
            folder: Configuration.mainData.includesFolder,
            slugs
        });
    }

    private getIncludedPathForFile(file: string): string {
        return path.join(Configuration.mainData.includes, file);
    }
}
