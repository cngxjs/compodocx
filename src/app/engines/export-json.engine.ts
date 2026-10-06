import * as path from 'node:path';
import traverse from 'neotraverse/legacy';

import pkg from '../../../package.json';
import { logger } from '../../utils/logger';
import type { StyleSource } from '../../utils/theme-doc-parser';
import Configuration from '../configuration';
import {
    EXPORT_SCHEMA_VERSION,
    type ExportData,
    type ExportStyleSource
} from '../interfaces/export-data.interface';
import FileEngine from './file.engine';

const INLINE_STYLE_RE = /^<inline-style-(\d+)>$/;

/** Map key of one style source: its file, or `<component file>#inline-<n>`. */
const styleSourceKey = (componentFile: string, source: StyleSource): string => {
    const inline = INLINE_STYLE_RE.exec(source.file);
    return inline ? `${componentFile}#inline-${inline[1]}` : source.file;
};

/**
 * Move the style sources of every component into one shared map, so a file
 * used by several components is exported once. Each component keeps the keys
 * of its sources, in collection order.
 */
export const shareStyleSources = <T extends { file?: string; themeStyleSources?: unknown }>(
    components: readonly T[]
): { components: T[]; styleSources: Record<string, ExportStyleSource> } => {
    const styleSources: Record<string, ExportStyleSource> = {};
    const shared = components.map(component => {
        const sources = component.themeStyleSources as StyleSource[] | undefined;
        if (!sources?.length) {
            return component;
        }
        const keys = sources.map(source => {
            const key = styleSourceKey(component.file ?? '', source);
            styleSources[key] = { content: source.content, language: source.language };
            return key;
        });
        return { ...component, themeStyleSources: keys };
    });
    return { components: shared, styleSources };
};

export class ExportJsonEngine {
    private static instance: ExportJsonEngine;
    private constructor() {}
    public static getInstance() {
        if (!ExportJsonEngine.instance) {
            ExportJsonEngine.instance = new ExportJsonEngine();
        }
        return ExportJsonEngine.instance;
    }

    public export(outputFolder, data) {
        const exportData: ExportData = {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            generatedAt: new Date().toISOString(),
            compodocxVersion: pkg.version
        };

        traverse(data).forEach(node => {
            if (node) {
                if (node.parent) {
                    delete node.parent;
                }
                if (node.initializer) {
                    delete node.initializer;
                }
                if (Configuration.mainData.disableSourceCode) {
                    delete node.sourceCode;
                    delete node.templateData;
                    delete node.styleUrlsData;
                    delete node.stylesData;
                }
            }
        });

        exportData.pipes = data.pipes;
        exportData.interfaces = data.interfaces;
        exportData.injectables = data.injectables;
        exportData.guards = data.guards;
        exportData.interceptors = data.interceptors;
        exportData.classes = data.classes;
        exportData.directives = data.directives;
        const shared = shareStyleSources(data.components ?? []);
        exportData.components = shared.components;
        if (Object.keys(shared.styleSources).length > 0) {
            exportData.styleSources = shared.styleSources;
        }
        exportData.miscellaneous = data.miscellaneous;
        exportData.tokens = data.tokens;
        if (!Configuration.mainData.disableRoutesGraph) {
            exportData.routes = data.routes;
        }
        if (!Configuration.mainData.disableCoverage) {
            exportData.coverage = data.coverageData;
        }

        return FileEngine.write(
            `${outputFolder + path.sep}/documentation.json`,
            JSON.stringify(exportData, undefined, Configuration.mainData.jsonIndent)
        ).catch(err => {
            logger.error('Error during export file generation ', err);
            return Promise.reject(err);
        });
    }
}

export default ExportJsonEngine.getInstance();
