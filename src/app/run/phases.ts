import * as path from 'node:path';

import { err, isErr, mapResult, ok, type Result, sequenceAsync } from '../../lib';
import AngularVersionUtil from '../../utils/angular-version.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import RouterParserUtil from '../../utils/router-parser.util';
import { formatLegacyNotice } from '../compiler/legacy-scan';
import DependenciesEngine from '../engines/dependencies.engine';
import ExportEngine from '../engines/export.engine';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';
import I18nEngine from '../engines/i18n.engine';
import { initHighlighter } from '../engines/syntax-highlight.engine';
import { copyAssetsFolder, copyResources, finalizeOutput } from '../page-generator';
import { crawlDependencies, crawlMicroDependencies } from '../services/dependencies';
import type { RunContext, RunMode, Stage } from './context';
import { type Halt, halt } from './halt';
import { countsFromDiff, countsFromEngine, runPrepareStages, selectPrepareStages } from './stages';

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

const printStatistics = (ctx: RunContext): void => {
    logger.info('-------------------');
    logger.info('Project statistics ');
    if (DependenciesEngine.modules.length > 0) {
        logger.info(`- files        : ${ctx.files.length}`);
    }
    if (DependenciesEngine.modules.length > 0) {
        logger.info(`- module       : ${DependenciesEngine.modules.length}`);
    }
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
    if (ctx.config.mainData.routesLength > 0) {
        logger.info(`- route        : ${ctx.config.mainData.routesLength}`);
    }
    if (DependenciesEngine.miscellaneous.typealiases.length > 0) {
        logger.info(`- type aliases : ${DependenciesEngine.miscellaneous.typealiases.length}`);
    }
    logger.info('-------------------');
};

const crawl: Stage = async ctx => {
    const { mainData } = ctx.config;
    logger.info('Get dependencies data');

    mainData.angularProject = true;

    const dependenciesData = crawlDependencies(ctx.files, {
        tsconfigDirectory: path.dirname(mainData.tsconfig)
    });

    for (const line of formatLegacyNotice(dependenciesData.legacyFindings)) {
        logger.warn(line);
    }

    // Auto-detect groupBy if not explicitly set by user
    if (!mainData.groupBy) {
        const hasModules = dependenciesData.modules && dependenciesData.modules.length > 0;
        mainData.hasNgModules = hasModules;
        mainData.groupBy = hasModules ? 'none' : 'folder';
    }

    DependenciesEngine.init(dependenciesData);

    // Inject category groupings for sidebar navigation (used by menu partial)
    mainData.categorizedComponents = DependenciesEngine.categorizedComponents;
    mainData.categorizedDirectives = DependenciesEngine.categorizedDirectives;
    mainData.categorizedInjectables = DependenciesEngine.categorizedInjectables;
    mainData.categorizedTokens = DependenciesEngine.categorizedTokens;
    mainData.categorizedPipes = DependenciesEngine.categorizedPipes;
    mainData.categorizedClasses = DependenciesEngine.categorizedClasses;
    mainData.categorizedInterfaces = DependenciesEngine.categorizedInterfaces;
    mainData.categorizedGuards = DependenciesEngine.categorizedGuards;
    mainData.categorizedInterceptors = DependenciesEngine.categorizedInterceptors;
    mainData.categorizedEntities = DependenciesEngine.categorizedEntities;
    mainData.categorizedByFeature = DependenciesEngine.categorizedByFeature;
    mainData.categorizedByFeaturePrimary = DependenciesEngine.categorizedByFeaturePrimary;
    mainData.categorizedByFeatureReference = DependenciesEngine.categorizedByFeatureReference;

    mainData.routesLength = RouterParserUtil.routesLength();

    printStatistics(ctx);
    return proceed(ctx);
};

const microCrawl: Stage = async ctx => {
    logger.info('Get diff dependencies data');

    ctx.config.mainData.angularProject = true;

    const diff = crawlMicroDependencies(ctx.updatedFiles, {
        tsconfigDirectory: path.dirname(ctx.config.mainData.tsconfig)
    });

    DependenciesEngine.update(diff);
    return proceed({ ...ctx, diff });
};

const prepare: Stage = async ctx => {
    const isDiff = ctx.mode === 'diff';
    if (isDiff) {
        ctx.config.resetPages();
    }
    const counts = isDiff ? countsFromDiff(ctx.diff) : countsFromEngine();
    const prepared = await runPrepareStages(ctx, selectPrepareStages(ctx, counts));
    if (isErr(prepared)) {
        if (prepared.message.kind === 'halt') {
            return err(prepared.message.halt);
        }
        logger.error(prepared.message.error);
        return err(halt(1, 'prepare'));
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

const emit: Stage = async ctx => {
    if (ctx.config.mainData.exportFormat !== COMPODOC_DEFAULTS.exportFormat) {
        return exportFormat(ctx);
    }
    const graphs = ctx.generators.graph.processGraphs();
    ctx.onEmitStart?.();
    await graphs;
    return writeOutput(ctx);
};

const emitPages: Stage = ctx => {
    const written = writeOutput(ctx);
    ctx.onEmitStart?.();
    return written;
};

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
export const phaseImpl = (key: PhaseKey): Stage => PHASE_IMPLS[key];

/**
 * Run every phase of `ctx.mode` in order; the first halt stops the run.
 * `impl` resolves a phase key to its implementation (tests pass stubs).
 */
export const runPhases = (
    ctx: RunContext,
    impl: (key: PhaseKey) => Stage = phaseImpl
): Promise<Result<RunContext, Halt>> => sequenceAsync(phasesFor(ctx.mode).map(impl), ctx);
