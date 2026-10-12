import * as path from 'node:path';
import traverse from 'neotraverse/legacy';

import pkg from '../../../package.json';
import { renderLlmMd } from '../../llm-md';
import { logger } from '../../utils/logger';
import type { SemanticModel } from '../compiler/semantic/model';
import Configuration from '../configuration';

import { EXPORT_SCHEMA_VERSION, type ExportData } from '../interfaces/export-data.interface';
import { exportRoutes, type RoutingModel } from '../routing';
import {
    exportStyleFiles,
    factsJoiner,
    miscellaneousWithFacts,
    withLinkedTheming
} from './export-json.engine';
import FileEngine from './file.engine';

/**
 * `--exportFormat llm-md` engine.
 *
 * Builds the same `ExportData` shape the JSON exporter uses, then runs it
 * through the pure-functional emitter in `src/llm-md`. Output goes to a
 * file under `<outputFolder>/llm-context.md` when the user passed `-d`, and
 * streams to stdout otherwise (no `-d` → cat/sed/awk convention).
 */
export class ExportLlmMdEngine {
    private static instance: ExportLlmMdEngine;
    private constructor() {}
    public static getInstance() {
        if (!ExportLlmMdEngine.instance) {
            ExportLlmMdEngine.instance = new ExportLlmMdEngine();
        }
        return ExportLlmMdEngine.instance;
    }

    public async export(outputFolder: string, data: any): Promise<void> {
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
            }
        });

        // Facts carry `notExported`, which the emitter uses to leave symbols out.
        const model: SemanticModel | undefined = data.semantic;
        const facts = factsJoiner(model);
        exportData.pipes = facts(data.pipes);
        exportData.interfaces = facts(data.interfaces, 'type');
        exportData.injectables = facts(data.injectables);
        exportData.guards = facts(data.guards);
        exportData.interceptors = facts(data.interceptors);
        exportData.classes = facts(data.classes);
        const themed = { styles: data.styles, symbols: data.symbols };
        exportData.directives = facts(withLinkedTheming(data.directives, 'directive', themed));
        exportData.components = facts(withLinkedTheming(data.components, 'component', themed));
        const styleFiles = exportStyleFiles(data.styles, data.symbols, model?.features).files;
        if (styleFiles.length > 0) {
            exportData.styleFiles = styleFiles;
        }
        exportData.miscellaneous = model
            ? miscellaneousWithFacts(data.miscellaneous, model)
            : data.miscellaneous;
        exportData.tokens = facts(data.tokens);
        const routing: RoutingModel | undefined = data.routing;
        if (!Configuration.mainData.disableRoutes && routing && routing.count > 0) {
            exportData.routes = exportRoutes(routing, data.symbols);
        }

        const markdown = renderLlmMd(exportData, {
            projectName:
                Configuration.mainData.documentationMainName || 'Application documentation',
            projectDescription: Configuration.mainData.documentationMainDescription
        });

        if (Configuration.mainData.outputProvided) {
            const filePath = path.join(outputFolder, 'llm-context.md');
            try {
                await FileEngine.write(filePath, markdown);
                logger.info(`llm-md export written to ${filePath}`);
            } catch (err) {
                logger.error('Error during llm-md export file generation ', err);
                throw err;
            }
            return;
        }

        process.stdout.write(markdown);
    }
}

export default ExportLlmMdEngine.getInstance();
