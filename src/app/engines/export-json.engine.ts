import * as path from 'node:path';
import traverse from 'neotraverse/legacy';

import pkg from '../../../package.json';
import { logger } from '../../utils/logger';
import type { StyleSource } from '../../utils/theme-doc-parser';
import {
    type DeclarationSpace,
    type DiFacts,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey,
    type TokenFacts
} from '../compiler/semantic/model';
import Configuration from '../configuration';
import {
    EXPORT_SCHEMA_VERSION,
    type ExportComponent,
    type ExportData,
    type ExportDiFacts,
    type ExportSemantic,
    type ExportSemanticFacts,
    type ExportStyleSource,
    type ExportSymbolRef,
    type ExportTokenFacts
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

const refs = (keys: readonly SymbolKey[]): ExportSymbolRef[] =>
    keys.map(key => ({ name: key.name, file: key.file }));

/** Lists are written only when non-empty. */
const nonEmpty = <K extends string>(
    key: K,
    keys: readonly SymbolKey[]
): Partial<Record<K, ExportSymbolRef[]>> =>
    keys.length > 0 ? ({ [key]: refs(keys) } as Record<K, ExportSymbolRef[]>) : {};

const exportDi = (di: DiFacts | undefined): ExportDiFacts | undefined => {
    if (!di) {
        return undefined;
    }
    const facts: ExportDiFacts = {
        ...(di.role ? { role: di.role } : {}),
        ...(di.featureType ? { featureType: refs([di.featureType])[0] } : {}),
        ...nonEmpty('providesTokens', di.providesTokens),
        ...nonEmpty('readsTokens', di.readsTokens),
        ...(di.usesInjectionContext ? { usesInjectionContext: di.usesInjectionContext } : {})
    };
    return Object.keys(facts).length > 0 ? facts : undefined;
};

const exportToken = (token: TokenFacts): ExportTokenFacts => ({
    shape: token.shape,
    ...nonEmpty('providedBy', token.providedBy),
    ...nonEmpty('injectedBy', token.injectedBy)
});

/** The export fields of one symbol's facts; empty lists and `false` are left out. */
export const exportSemanticFacts = (facts: SymbolFacts): ExportSemanticFacts => {
    const di = exportDi(facts.di);
    return {
        ...(facts.entryPoint ? { entryPoint: facts.entryPoint } : {}),
        ...(facts.exportedBy.length > 0 ? { exportedBy: [...facts.exportedBy] } : {}),
        ...(facts.notExported ? { notExported: true as const } : {}),
        ...nonEmpty('usedBy', facts.usedBy),
        ...(di ? { di } : {}),
        ...(facts.token ? { token: exportToken(facts.token) } : {})
    };
};

type SymbolEntry = { name?: string; file?: string };

/**
 * A copy of `entry` with its semantic facts appended, joined by file and
 * name; the entry itself when it has none, so it serialises as before.
 */
export const withSemanticFacts = <T extends SymbolEntry>(
    entry: T,
    model: SemanticModel,
    space: DeclarationSpace = 'value'
): T => {
    const facts =
        entry.file && entry.name
            ? model.facts.get(factKey({ name: entry.name, file: entry.file, space }))
            : undefined;
    const fields = facts ? exportSemanticFacts(facts) : {};
    return Object.keys(fields).length > 0 ? { ...entry, ...fields } : entry;
};

const mapEntries = <T extends SymbolEntry>(
    entries: T[] | undefined,
    model: SemanticModel,
    space: DeclarationSpace = 'value'
): T[] | undefined => entries?.map(entry => withSemanticFacts(entry, model, space));

const mapGroups = <T extends SymbolEntry>(
    groups: Record<string, T[]> | undefined,
    model: SemanticModel,
    space: DeclarationSpace = 'value'
): Record<string, T[]> | undefined =>
    groups &&
    Object.fromEntries(
        Object.entries(groups).map(([key, entries]) => [
            key,
            entries.map(e => withSemanticFacts(e, model, space))
        ])
    );

const MISC_LISTS = ['variables', 'functions', 'typealiases', 'enumerations'] as const;
const MISC_GROUPS = [
    'groupedVariables',
    'groupedFunctions',
    'groupedEnumerations',
    'groupedTypeAliases'
] as const;
const TYPE_SPACE_LISTS: ReadonlySet<string> = new Set(['typealiases', 'groupedTypeAliases']);
const spaceOfList = (key: string): DeclarationSpace =>
    TYPE_SPACE_LISTS.has(key) ? 'type' : 'value';

/** Copy of the miscellaneous block with facts joined into its flat and grouped lists. */
export const miscellaneousWithFacts = (
    miscellaneous: Record<string, unknown> | undefined,
    model: SemanticModel
): Record<string, unknown> | undefined => {
    if (!miscellaneous) {
        return miscellaneous;
    }
    const copy: Record<string, unknown> = { ...miscellaneous };
    for (const key of MISC_LISTS) {
        if (Array.isArray(copy[key])) {
            copy[key] = mapEntries(copy[key] as SymbolEntry[], model, spaceOfList(key));
        }
    }
    for (const key of MISC_GROUPS) {
        if (copy[key] && typeof copy[key] === 'object') {
            copy[key] = mapGroups(
                copy[key] as Record<string, SymbolEntry[]>,
                model,
                spaceOfList(key)
            );
        }
    }
    return copy;
};

export const exportSemantic = (model: SemanticModel): ExportSemantic => ({
    entryPoints: model.entryPoints.map(entry => ({
        importPath: entry.importPath,
        file: entry.file,
        source: entry.source
    })),
    summary: {
        entryPoints: model.summary.entryPoints,
        providers: model.summary.providers,
        features: model.summary.features,
        injectionContext: { ...model.summary.injectionContext },
        notExported: model.summary.notExported
    }
});

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

        const model: SemanticModel | undefined = data.semantic;
        const facts = <T extends SymbolEntry>(
            entries: T[] | undefined,
            space: DeclarationSpace = 'value'
        ): T[] | undefined => (model ? mapEntries(entries, model, space) : entries);

        exportData.pipes = facts(data.pipes);
        exportData.interfaces = facts(data.interfaces, 'type');
        exportData.injectables = facts(data.injectables);
        exportData.guards = facts(data.guards);
        exportData.interceptors = facts(data.interceptors);
        exportData.classes = facts(data.classes);
        exportData.directives = facts(data.directives);
        const shared = shareStyleSources<ExportComponent>(data.components ?? []);
        exportData.components = facts(shared.components);
        if (Object.keys(shared.styleSources).length > 0) {
            exportData.styleSources = shared.styleSources;
        }
        exportData.miscellaneous = model
            ? miscellaneousWithFacts(data.miscellaneous, model)
            : data.miscellaneous;
        exportData.tokens = facts(data.tokens);
        if (!Configuration.mainData.disableRoutesGraph) {
            exportData.routes = data.routes;
        }
        if (!Configuration.mainData.disableCoverage) {
            exportData.coverage = data.coverageData;
        }
        if (model) {
            exportData.semantic = exportSemantic(model);
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
