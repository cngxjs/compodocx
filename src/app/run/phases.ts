import * as fs from 'node:fs';
import * as path from 'node:path';

import { err, isErr, mapResult, ok, type Result, sequenceAsync } from '../../lib';
import AngularVersionUtil from '../../utils/angular-version.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import {
    formatUnknownStyleTagNotice,
    type StyleSource,
    unknownStyleTags
} from '../../utils/theme-doc-parser';
import { formatLegacyNotice } from '../compiler/legacy-scan';
import { findRemovedTags, formatRemovedTagNotice } from '../compiler/removed-tags';
import {
    analyzeProject,
    formatAxesSummary,
    formatFeatureSummary,
    formatSemanticSummary,
    resolvePublicApi
} from '../compiler/semantic';
import { buildDiView, formatHiddenList } from '../di';
import DependenciesEngine from '../engines/dependencies.engine';
import ExportEngine from '../engines/export.engine';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';
import I18nEngine from '../engines/i18n.engine';
import { initHighlighter } from '../engines/syntax-highlight.engine';
import { buildSymbolTable, withStyleEntries } from '../links';
import { copyAssetsFolder, copyResources, finalizeOutput } from '../page-generator';
import { crawlDependencies, crawlMicroDependencies } from '../services/dependencies';
import { hasStylePage } from '../styles';
import { deriveAxes } from './axes';
import type { RunContext, RunMode, Stage } from './context';
import { deriveFeatures, placeInFeatures } from './features';
import { type Halt, halt } from './halt';
import { draftRoutes, logRouting, nameRoutes } from './routing';
import { countsFromDiff, countsFromEngine, runPrepareStages, selectPrepareStages } from './stages';
import { deriveStyles, logStyles } from './styles';

// package.json is read from the process cwd, not from the tsconfig folder.
const cwd = process.cwd();

export type PhaseKey =
    | 'init'
    | 'packageJson'
    | 'markdowns'
    | 'crawl'
    | 'microCrawl'
    | 'prepare'
    | 'emit'
    | 'emitPages'
    | 'resetRootMarkdownPages'
    | 'resetAdditionalPages'
    | 'includes';

const PHASES: Readonly<Record<RunMode, readonly PhaseKey[]>> = {
    full: ['init', 'packageJson', 'markdowns', 'crawl', 'prepare', 'emit'],
    // Coverage runs skip init (no i18n, highlighter or template setup).
    coverage: ['crawl', 'prepare', 'emit'],
    diff: ['microCrawl', 'prepare', 'emit'],
    markdown: ['resetRootMarkdownPages', 'markdowns', 'emitPages'],
    includes: ['resetAdditionalPages', 'includes', 'emitPages']
};

/** The phases a run of this mode goes through, in order. */
export const phasesFor = (mode: RunMode): readonly PhaseKey[] => PHASES[mode];

const proceed = (ctx: RunContext): Result<RunContext, Halt> => ok(ctx);

const init: Stage = async ctx => {
    const { mainData } = ctx.config;
    I18nEngine.init(mainData.language);

    if (mainData.output.charAt(mainData.output.length - 1) !== '/') {
        mainData.output += '/';
    }

    if (mainData.exportFormat === COMPODOC_DEFAULTS.exportFormat) {
        await initHighlighter(mainData.shikiTheme || undefined);
        await HtmlEngine.init(mainData.templates);
    }
    return proceed(ctx);
};

const PACKAGE_PROPERTIES = [
    'version',
    'description',
    'keywords',
    'homepage',
    'bugs',
    'license',
    'repository',
    'author'
] as const;

const applyPackageJson = (ctx: RunContext, parsedData: Record<string, any>): void => {
    const { mainData } = ctx.config;
    if (
        typeof parsedData.name !== 'undefined' &&
        mainData.documentationMainName === COMPODOC_DEFAULTS.title
    ) {
        mainData.documentationMainName = `${parsedData.name} documentation`;
    }
    if (typeof parsedData.description !== 'undefined') {
        mainData.documentationMainDescription = parsedData.description;
    }
    mainData.angularVersion = AngularVersionUtil.getAngularVersionOfProject(parsedData);

    // Detect zone.js in dependencies (if absent, app is zoneless)
    const allDeps = {
        ...parsedData.dependencies,
        ...parsedData.devDependencies
    };
    mainData.hasZoneJs = 'zone.js' in allDeps;

    // Surface the runtime and peer dep tables to the StackBlitz manifest
    // builder so consumer-declared third-party libraries (incl. user-authored
    // ones) are auto-forwarded into `@playground` projects with the right
    // version.
    mainData.workspacePackage = {
        dependencies: parsedData.dependencies ?? {},
        peerDependencies: parsedData.peerDependencies ?? {}
    };

    logger.info('package.json file found');

    if (!mainData.disableDependencies) {
        if (typeof parsedData.dependencies !== 'undefined') {
            ctx.generators.packageDependencies.processDependencies(parsedData.dependencies);
        }
        if (typeof parsedData.peerDependencies !== 'undefined') {
            ctx.generators.packageDependencies.processPeerDependencies(parsedData.peerDependencies);
        }
    }

    if (!mainData.disableProperties) {
        const present = PACKAGE_PROPERTIES.filter(prop => prop in parsedData);
        for (const prop of present) {
            mainData.packageProperties[prop] = parsedData[prop];
        }
        if (present.length > 0) {
            ctx.config.addPage({
                name: 'properties',
                id: 'packageProperties',
                context: 'package-properties',
                depth: 0,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
            });
        }
    }
};

const packageJson: Stage = async ctx => {
    logger.info('Searching package.json file');
    await FileEngine.get(`${cwd + path.sep}package.json`).then(
        packageData => applyPackageJson(ctx, JSON.parse(packageData)),
        errorMessage => {
            logger.error(errorMessage);
            logger.error('Continuing without package.json file');
        }
    );
    return proceed(ctx);
};

const markdowns: Stage = ctx =>
    ctx.generators.overview.processMarkdowns().then(
        () => proceed(ctx),
        errorMessage => {
            logger.error(errorMessage);
            return err(halt(1, 'markdown'));
        }
    );

const printStatistics = (): void => {
    logger.info('-------------------');
    logger.info('Project statistics ');
    if (DependenciesEngine.components.length > 0) {
        logger.info(`- component    : ${DependenciesEngine.components.length}`);
    }
    if (DependenciesEngine.entities.length > 0) {
        logger.info(`- entity       : ${DependenciesEngine.entities.length}`);
    }
    if (DependenciesEngine.directives.length > 0) {
        logger.info(`- directive    : ${DependenciesEngine.directives.length}`);
    }
    if (DependenciesEngine.injectables.length > 0) {
        logger.info(`- injectable   : ${DependenciesEngine.injectables.length}`);
    }
    if (DependenciesEngine.services.length > 0) {
        logger.info(`- service      : ${DependenciesEngine.services.length}`);
    }
    if (DependenciesEngine.interceptors.length > 0) {
        logger.info(`- injector     : ${DependenciesEngine.interceptors.length}`);
    }
    if (DependenciesEngine.guards.length > 0) {
        logger.info(`- guard        : ${DependenciesEngine.guards.length}`);
    }
    if (DependenciesEngine.pipes.length > 0) {
        logger.info(`- pipe         : ${DependenciesEngine.pipes.length}`);
    }
    if (DependenciesEngine.classes.length > 0) {
        logger.info(`- class        : ${DependenciesEngine.classes.length}`);
    }
    if (DependenciesEngine.interfaces.length > 0) {
        logger.info(`- interface    : ${DependenciesEngine.interfaces.length}`);
    }
    if (DependenciesEngine.miscellaneous.typealiases.length > 0) {
        logger.info(`- type aliases : ${DependenciesEngine.miscellaneous.typealiases.length}`);
    }
    logger.info('-------------------');
};

/**
 * Build the project-wide program and its facts. A failure is logged once and
 * leaves the run without semantic facts; it never stops the generation.
 * Every run parses afresh: the crawler shares the program's source files and
 * re-binds them, so a later program that reused them as unchanged would get
 * a checker that no longer resolves imports (a watch rebuild after a save
 * without changes lost the routers).
 */
const withSemantic = (ctx: RunContext): RunContext => {
    const { mainData } = ctx.config;
    if (!mainData.tsconfig) {
        mainData.semantic = undefined;
        return { ...ctx, semantic: undefined };
    }
    const analyzed = analyzeProject({
        tsconfigPath: path.resolve(cwd, mainData.tsconfig),
        files: ctx.files,
        cwd
    });
    if (isErr(analyzed)) {
        logger.warn(`Semantic analysis skipped: ${analyzed.message}`);
        mainData.semantic = undefined;
        return { ...ctx, semantic: undefined };
    }
    mainData.semantic = analyzed.value.model;
    if (ctx.mode !== 'diff') {
        logger.info(formatSemanticSummary(analyzed.value.model.summary));
    }
    return { ...ctx, semantic: analyzed.value };
};

/** `@category` / `@docsKind` tags still written in the documented files. */
const removedTagFindings = (files: readonly string[]) =>
    files.flatMap(file => {
        const absolute = path.resolve(cwd, file);
        const text = fs.readFileSync(absolute, 'utf8');
        return findRemovedTags(path.relative(cwd, absolute).split(path.sep).join('/'), text);
    });

/**
 * Index the engine's symbols once it holds the current crawl, place them and
 * derive their features; the feature model joins the semantic state.
 */
const withSymbols = (ctx: RunContext): RunContext => {
    const { mainData } = ctx.config;
    const symbols = buildSymbolTable(DependenciesEngine, { semantic: ctx.semantic?.model, cwd });
    const di = buildDiView(symbols, ctx.semantic?.model);
    mainData.symbols = symbols;
    mainData.di = di;
    const stylesRun = deriveStyles(mainData, DependenciesEngine.getComponents(), symbols, cwd);
    const styles = stylesRun?.model;
    mainData.styles = styles;
    if (stylesRun && ctx.mode !== 'diff') {
        logStyles(stylesRun, mainData.themingTabSections);
    }
    const table = styles
        ? withStyleEntries(
              symbols,
              styles.files.filter(file => hasStylePage(file, mainData.themingTabSections))
          )
        : symbols;
    mainData.symbols = table;
    const routing = nameRoutes(ctx.routing, table);
    mainData.routing = routing;
    if (ctx.mode !== 'diff' && ctx.semantic && !mainData.disableRoutes) {
        logRouting(routing);
    }
    if (!ctx.semantic) {
        return { ...ctx, symbols: table, di, styles, routing };
    }
    const detection = deriveFeatures(ctx.semantic.model, table, mainData, ctx.files, cwd);
    const axes = deriveAxes(ctx.semantic.model, table, mainData.classificationAxes);
    const semantic = {
        ...ctx.semantic,
        model: {
            ...ctx.semantic.model,
            features: detection.model,
            ...(axes.model ? { axes: axes.model } : {})
        }
    };
    mainData.semantic = semantic.model;
    const placed = placeInFeatures(table, detection.model);
    mainData.symbols = placed;
    if (ctx.mode !== 'diff') {
        for (const warning of detection.warnings) {
            logger.warn(warning);
        }
        logger.info(formatFeatureSummary(detection.model));
        for (const warning of axes.warnings) {
            logger.warn(warning);
        }
        if (axes.model) {
            logger.info(formatAxesSummary(axes.model));
        }
    }
    return { ...ctx, symbols: placed, di, semantic, styles, routing };
};

/** The crawler parses nothing the semantic program already holds. */
const sharedSourceFiles = (ctx: RunContext) => {
    const program = ctx.semantic?.program;
    return program ? (fileName: string) => program.getSourceFile(fileName) : undefined;
};

/**
 * The public API map followed to the declarations through the semantic
 * program; without semantic facts the recorded map is used as it is.
 */
const withPublicApi = (ctx: RunContext): void => {
    const { mainData } = ctx.config;
    if (!mainData.publicApiOnly) {
        return;
    }
    const program = ctx.semantic?.program;
    mainData.publicApiDeclarations = program
        ? resolvePublicApi(program, mainData.publicApiExports)
        : mainData.publicApiExports;
};

/** Semantic state, public API and route draft, read before the crawler touches the files. */
const withSemanticAndRoutes = (current: RunContext): RunContext => {
    const ctx = withSemantic(current);
    withPublicApi(ctx);
    const routing = draftRoutes(
        ctx.semantic?.program,
        ctx.files,
        cwd,
        ctx.config.mainData.disableRoutes
    );
    return { ...ctx, routing };
};

const crawl: Stage = async current => {
    const ctx = withSemanticAndRoutes(current);
    const { mainData } = ctx.config;
    logger.info('Get dependencies data');

    mainData.angularProject = true;

    const dependenciesData = crawlDependencies(ctx.files, {
        tsconfigDirectory: path.dirname(mainData.tsconfig),
        sharedSourceFile: sharedSourceFiles(ctx)
    });

    for (const line of formatLegacyNotice(dependenciesData.legacyFindings)) {
        logger.warn(line);
    }
    if (ctx.mode !== 'diff') {
        const notice = formatRemovedTagNotice(removedTagFindings(ctx.files));
        if (notice.length > 0) {
            logger.warn(notice.join('\n'));
        }
    }

    DependenciesEngine.init(dependenciesData);

    printStatistics();
    const placed = withSymbols(ctx);
    if (placed.mode !== 'diff' && placed.di && placed.symbols) {
        const hidden = formatHiddenList(placed.di, placed.symbols, placed.semantic?.model);
        if (hidden.length > 0) {
            logger.warn(hidden.join('\n'));
        }
    }
    return proceed(placed);
};

const microCrawl: Stage = async current => {
    const ctx = withSemanticAndRoutes(current);
    logger.info('Get diff dependencies data');

    ctx.config.mainData.angularProject = true;

    const diff = crawlMicroDependencies(ctx.updatedFiles, {
        tsconfigDirectory: path.dirname(ctx.config.mainData.tsconfig),
        sharedSourceFile: sharedSourceFiles(ctx)
    });

    DependenciesEngine.update(diff);
    return proceed(withSymbols({ ...ctx, diff }));
};

/** One notice per run for tags the style-comment parser does not read. */
const logUnknownStyleTags = (ctx: RunContext): void => {
    const components = (ctx.config.mainData.components ?? []) as {
        themeStyleSources?: StyleSource[];
    }[];
    const sources = components.flatMap(component => component.themeStyleSources ?? []);
    const notice = formatUnknownStyleTagNotice([
        ...unknownStyleTags(sources),
        ...(ctx.config.mainData.styles?.unknownTags ?? [])
    ]);
    if (notice.length > 0) {
        logger.warn(notice.join('\n'));
    }
};

const prepare: Stage = async ctx => {
    const isDiff = ctx.mode === 'diff';
    if (isDiff) {
        ctx.config.resetPages();
    }
    const routeCount = ctx.routing?.count ?? 0;
    const counts = isDiff ? countsFromDiff(ctx.diff, routeCount) : countsFromEngine(routeCount);
    const prepared = await runPrepareStages(ctx, selectPrepareStages(ctx, counts));
    if (isErr(prepared)) {
        if (prepared.message.kind === 'halt') {
            return err(prepared.message.halt);
        }
        logger.error(prepared.message.error);
        return err(halt(1, 'prepare'));
    }
    if (!isDiff) {
        logUnknownStyleTags(ctx);
    }
    return proceed(ctx);
};

/** Write pages, additional pages and assets, then finalise the output folder. */
const writeOutput = (ctx: RunContext): Promise<Result<RunContext, Halt>> =>
    sequenceAsync<RunContext, Halt>(
        [
            async current => {
                await current.generators.pageWriter.processPages();
                return proceed(current);
            },
            async current => {
                if (current.config.mainData.additionalPages.length > 0) {
                    await current.generators.additional.processAdditionalPages(
                        current.generators.pageWriter
                    );
                }
                return proceed(current);
            },
            async current => {
                if (current.config.mainData.assetsFolder !== '') {
                    await copyAssetsFolder(current);
                }
                return proceed(current);
            },
            async current => mapResult(await copyResources(current), () => current),
            async current => mapResult(await finalizeOutput(current), () => current)
        ],
        ctx
    );

const exportFormat: Stage = async ctx => {
    const { mainData } = ctx.config;
    if (COMPODOC_DEFAULTS.exportFormatsSupported.indexOf(mainData.exportFormat) === -1) {
        logger.warn(`Exported format not supported`);
        return err(halt(0, 'export-format'));
    }
    logger.info(`Generating documentation in export format ${mainData.exportFormat}`);
    await ExportEngine.export(mainData.output, mainData);
    logger.info(
        'Documentation generated in ' +
            mainData.output +
            ' in ' +
            (Date.now() - ctx.startTime) / 1000 +
            ' seconds'
    );
    return proceed(ctx);
};

const emitPages: Stage = ctx => {
    const written = writeOutput(ctx);
    ctx.onEmitStart?.();
    return written;
};

const emit: Stage = async ctx =>
    ctx.config.mainData.exportFormat === COMPODOC_DEFAULTS.exportFormat
        ? emitPages(ctx)
        : exportFormat(ctx);

const resetRootMarkdownPages: Stage = async ctx => {
    logger.info('Regenerating README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE.md, TODO.md pages');
    ctx.config.resetRootMarkdownPages();
    return proceed(ctx);
};

const resetAdditionalPages: Stage = async ctx => {
    logger.info('Rebuild external documentation');
    ctx.config.resetAdditionalPages();
    return proceed(ctx);
};

const includes: Stage = async ctx => {
    if (ctx.config.mainData.includes === '') {
        return proceed(ctx);
    }
    return ctx.generators.additional.prepareExternalIncludes().then(
        () => proceed(ctx),
        errorMessage => {
            logger.error(errorMessage);
            return err(halt(1, 'prepare'));
        }
    );
};

const PHASE_IMPLS: Readonly<Record<PhaseKey, Stage>> = {
    init,
    packageJson,
    markdowns,
    crawl,
    microCrawl,
    prepare,
    emit,
    emitPages,
    resetRootMarkdownPages,
    resetAdditionalPages,
    includes
};

/** The implementation of one phase. */
const phaseImpl = (key: PhaseKey): Stage => PHASE_IMPLS[key];

/**
 * Run every phase of `ctx.mode` in order; the first halt stops the run.
 * `impl` resolves a phase key to its implementation (tests pass stubs).
 */
export const runPhases = (
    ctx: RunContext,
    impl: (key: PhaseKey) => Stage = phaseImpl
): Promise<Result<RunContext, Halt>> => sequenceAsync(phasesFor(ctx.mode).map(impl), ctx);
