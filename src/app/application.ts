import * as path from 'node:path';

import { isErr } from '../lib';
import AngularVersionUtil from '../utils/angular-version.util';
import { COMPODOC_DEFAULTS } from '../utils/defaults';
import { logger } from '../utils/logger';
import { promiseSequential } from '../utils/promise-sequential';
import RouterParserUtil from '../utils/router-parser.util';
import { cleanSourcesForWatch, findMainSourceFolder } from '../utils/utils';
import Configuration from './configuration';
import DependenciesEngine from './engines/dependencies.engine';
import ExportEngine from './engines/export.engine';
import FileEngine from './engines/file.engine';
import HtmlEngine from './engines/html.engine';
import I18nEngine from './engines/i18n.engine';
import MarkdownEngine from './engines/markdown.engine';
import { initHighlighter } from './engines/syntax-highlight.engine';
import {
    generationPromise,
    rejectGenerationPromise,
    resolveGenerationPromise
} from './generation-promise';
import { copyAssetsFolder, copyResources, finalizeOutput } from './page-generator';
import { createGenerators, type Generators, type RunContext, type RunMode } from './run/context';
import {
    countsFromDiff,
    countsFromEngine,
    runPrepareStages,
    type SourceCounts,
    selectPrepareStages
} from './run/stages';
import { crawlDependencies, crawlMicroDependencies } from './services/dependencies';
import { startWebServer } from './services/serve';

const cwd = process.cwd();
let startTime = new Date();

export class Application {
    /**
     * Files processed during initial scanning
     */
    public files: Array<string>;
    /**
     * Files processed during watch scanning
     */
    public updatedFiles: Array<string>;
    /**
     * Files changed during watch scanning
     */
    public watchChangedFiles: Array<string> = [];
    /**
     * Boolean for watching status
     * @type {boolean}
     */
    public isWatching: boolean = false;

    private readonly generators: Generators = createGenerators();

    /**
     * Create a new compodocx application instance.
     *
     * @param options An object containing the options that should be used.
     */
    constructor(options?: Object) {
        for (const option in options) {
            if (typeof Configuration.mainData[option] !== 'undefined') {
                Configuration.mainData[option] = options[option];
            }
            // For documentationMainName, process it outside the loop, for handling conflict with pages name
            if (option === 'name') {
                Configuration.mainData.documentationMainName = options[option];
            }
            // For documentationMainName, process it outside the loop, for handling conflict with pages name
            if (option === 'silent') {
                logger.silent = false;
            }
        }
    }

    /**
     * Start compodocx process
     */
    protected generate(): Promise<{}> {
        process.on('unhandledRejection', this.unhandledRejectionListener);
        process.on('uncaughtException', this.uncaughtExceptionListener);

        I18nEngine.init(Configuration.mainData.language);

        if (
            Configuration.mainData.output.charAt(Configuration.mainData.output.length - 1) !== '/'
        ) {
            Configuration.mainData.output += '/';
        }

        if (Configuration.mainData.exportFormat !== COMPODOC_DEFAULTS.exportFormat) {
            this.processPackageJson();
        } else {
            initHighlighter(Configuration.mainData.shikiTheme || undefined)
                .then(() => HtmlEngine.init(Configuration.mainData.templates))
                .then(() => this.processPackageJson());
        }
        return generationPromise;
    }

    private endCallback() {
        process.removeListener('unhandledRejection', this.unhandledRejectionListener);
        process.removeListener('uncaughtException', this.uncaughtExceptionListener);
    }

    private unhandledRejectionListener(err, p) {
        console.log('Unhandled Rejection at:', p, 'reason:', err);
        logger.error(
            'Sorry, but there was a problem during parsing or generation of the documentation. Please fill an issue on github. (https://github.com/cngxjs/compodocx/issues/new)'
        ); // tslint:disable-line
        process.exit(1);
    }

    private uncaughtExceptionListener(err) {
        logger.error(err);
        logger.error(
            'Sorry, but there was a problem during parsing or generation of the documentation. Please fill an issue on github. (https://github.com/cngxjs/compodocx/issues/new)'
        ); // tslint:disable-line
        process.exit(1);
    }

    /**
     * Start compodocx documentation coverage
     */
    protected testCoverage() {
        this.getDependenciesData();
    }

    /**
     * Store files for initial processing
     * @param  {Array<string>} files Files found during source folder and tsconfig scan
     */
    public setFiles(files: Array<string>) {
        this.files = files;
    }

    /**
     * Store files for watch processing
     * @param  {Array<string>} files Files found during source folder and tsconfig scan
     */
    public setUpdatedFiles(files: Array<string>) {
        this.updatedFiles = files;
    }

    /**
     * Return a boolean indicating presence of one TypeScript file in updatedFiles list
     * @return {boolean} Result of scan
     */
    public hasWatchedFilesTSFiles(): boolean {
        let result = false;

        this.updatedFiles.forEach(file => {
            if (path.extname(file) === '.ts') {
                result = true;
            }
        });

        return result;
    }

    /**
     * Return a boolean indicating presence of one root markdown files in updatedFiles list
     * @return {boolean} Result of scan
     */
    public hasWatchedFilesRootMarkdownFiles(): boolean {
        let result = false;

        this.updatedFiles.forEach(file => {
            if (path.extname(file) === '.md' && path.dirname(file) === cwd) {
                result = true;
            }
        });

        return result;
    }

    /**
     * Clear files for watch processing
     */
    public clearUpdatedFiles(): void {
        this.updatedFiles = [];
        this.watchChangedFiles = [];
    }

    private processPackageJson(): void {
        logger.info('Searching package.json file');
        FileEngine.get(`${cwd + path.sep}package.json`).then(
            packageData => {
                const parsedData = JSON.parse(packageData);
                this.packageJsonData = parsedData;
                if (
                    typeof parsedData.name !== 'undefined' &&
                    Configuration.mainData.documentationMainName === COMPODOC_DEFAULTS.title
                ) {
                    Configuration.mainData.documentationMainName = `${parsedData.name} documentation`;
                }
                if (typeof parsedData.description !== 'undefined') {
                    Configuration.mainData.documentationMainDescription = parsedData.description;
                }
                Configuration.mainData.angularVersion =
                    AngularVersionUtil.getAngularVersionOfProject(parsedData);

                // Detect zone.js in dependencies (if absent, app is zoneless)
                const allDeps = {
                    ...parsedData.dependencies,
                    ...parsedData.devDependencies
                };
                Configuration.mainData.hasZoneJs = 'zone.js' in allDeps;

                // Surface the runtime and peer dep tables to the StackBlitz
                // manifest builder so consumer-declared third-party libraries
                // (incl. user-authored ones) are auto-forwarded into
                // `@playground` projects with the right version.
                Configuration.mainData.workspacePackage = {
                    dependencies: parsedData.dependencies ?? {},
                    peerDependencies: parsedData.peerDependencies ?? {}
                };

                logger.info('package.json file found');

                if (!Configuration.mainData.disableDependencies) {
                    if (typeof parsedData.dependencies !== 'undefined') {
                        this.generators.packageDependencies.processDependencies(
                            parsedData.dependencies
                        );
                    }
                    if (typeof parsedData.peerDependencies !== 'undefined') {
                        this.generators.packageDependencies.processPeerDependencies(
                            parsedData.peerDependencies
                        );
                    }
                }

                if (!Configuration.mainData.disableProperties) {
                    const propertiesToCheck = [
                        'version',
                        'description',
                        'keywords',
                        'homepage',
                        'bugs',
                        'license',
                        'repository',
                        'author'
                    ];
                    let hasOneOfCheckedProperties = false;
                    propertiesToCheck.forEach(prop => {
                        if (prop in parsedData) {
                            hasOneOfCheckedProperties = true;
                            Configuration.mainData.packageProperties[prop] = parsedData[prop];
                        }
                    });
                    if (hasOneOfCheckedProperties) {
                        Configuration.addPage({
                            name: 'properties',
                            id: 'packageProperties',
                            context: 'package-properties',
                            depth: 0,
                            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.ROOT
                        });
                    }
                }

                this.generators.overview.processMarkdowns().then(
                    () => {
                        this.getDependenciesData();
                    },
                    errorMessage => {
                        logger.error(errorMessage);
                        process.exit(1);
                    }
                );
            },
            errorMessage => {
                logger.error(errorMessage);
                logger.error('Continuing without package.json file');
                this.generators.overview.processMarkdowns().then(
                    () => {
                        this.getDependenciesData();
                    },
                    errorMessage1 => {
                        logger.error(errorMessage1);
                        process.exit(1);
                    }
                );
            }
        );
    }

    private rebuildRootMarkdowns(): void {
        logger.info(
            'Regenerating README.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE.md, TODO.md pages'
        );

        const actions = [];

        Configuration.resetRootMarkdownPages();

        actions.push(() => {
            return this.generators.overview.processMarkdowns();
        });

        promiseSequential(actions)
            .then(_res => {
                this.emitPages();
                this.clearUpdatedFiles();
            })
            .catch(errorMessage => {
                logger.error(errorMessage);
            });
    }

    /**
     * Get dependency data for small group of updated files during watch process
     */
    private getMicroDependenciesData(): void {
        logger.info('Get diff dependencies data');

        Configuration.mainData.angularProject = true;

        const dependenciesData = crawlMicroDependencies(this.updatedFiles, {
            tsconfigDirectory: path.dirname(Configuration.mainData.tsconfig)
        });

        DependenciesEngine.update(dependenciesData);

        this.prepareJustAFewThings(dependenciesData);
    }

    /**
     * Rebuild external documentation during watch process
     */
    private rebuildExternalDocumentation(): void {
        logger.info('Rebuild external documentation');

        const actions = [];

        Configuration.resetAdditionalPages();

        if (Configuration.mainData.includes !== '') {
            actions.push(() => {
                return this.generators.additional.prepareExternalIncludes();
            });
        }

        promiseSequential(actions)
            .then(_res => {
                this.emitPages();
                this.clearUpdatedFiles();
            })
            .catch(errorMessage => {
                logger.error(errorMessage);
            });
    }

    private getDependenciesData(): void {
        logger.info('Get dependencies data');

        Configuration.mainData.angularProject = true;

        const dependenciesData = crawlDependencies(this.files, {
            tsconfigDirectory: path.dirname(Configuration.mainData.tsconfig)
        });

        // Auto-detect groupBy if not explicitly set by user
        if (!Configuration.mainData.groupBy) {
            const hasModules = dependenciesData.modules && dependenciesData.modules.length > 0;
            Configuration.mainData.hasNgModules = hasModules;
            Configuration.mainData.groupBy = hasModules ? 'none' : 'folder';
        }

        DependenciesEngine.init(dependenciesData);

        // Inject category groupings for sidebar navigation (used by menu partial)
        Configuration.mainData.categorizedComponents = DependenciesEngine.categorizedComponents;
        Configuration.mainData.categorizedDirectives = DependenciesEngine.categorizedDirectives;
        Configuration.mainData.categorizedInjectables = DependenciesEngine.categorizedInjectables;
        Configuration.mainData.categorizedTokens = DependenciesEngine.categorizedTokens;
        Configuration.mainData.categorizedPipes = DependenciesEngine.categorizedPipes;
        Configuration.mainData.categorizedClasses = DependenciesEngine.categorizedClasses;
        Configuration.mainData.categorizedInterfaces = DependenciesEngine.categorizedInterfaces;
        Configuration.mainData.categorizedGuards = DependenciesEngine.categorizedGuards;
        Configuration.mainData.categorizedInterceptors = DependenciesEngine.categorizedInterceptors;
        Configuration.mainData.categorizedEntities = DependenciesEngine.categorizedEntities;
        Configuration.mainData.categorizedByFeature = DependenciesEngine.categorizedByFeature;
        Configuration.mainData.categorizedByFeaturePrimary =
            DependenciesEngine.categorizedByFeaturePrimary;
        Configuration.mainData.categorizedByFeatureReference =
            DependenciesEngine.categorizedByFeatureReference;

        Configuration.mainData.routesLength = RouterParserUtil.routesLength();

        this.printStatistics();

        this.prepareEverything();
    }

    private prepareJustAFewThings(diffCrawledData): void {
        Configuration.resetPages();

        const ctx: RunContext = { ...this.runContext('diff'), diff: diffCrawledData };
        this.runPrepare(ctx, countsFromDiff(diffCrawledData), () => this.clearUpdatedFiles()).catch(
            errorMessage => {
                logger.error(errorMessage);
            }
        );
    }

    private printStatistics() {
        logger.info('-------------------');
        logger.info('Project statistics ');
        if (DependenciesEngine.modules.length > 0) {
            logger.info(`- files        : ${this.files.length}`);
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
        if (Configuration.mainData.routesLength > 0) {
            logger.info(`- route        : ${Configuration.mainData.routesLength}`);
        }
        if (DependenciesEngine.miscellaneous.typealiases.length > 0) {
            logger.info(`- type aliases : ${DependenciesEngine.miscellaneous.typealiases.length}`);
        }
        logger.info('-------------------');
    }

    private prepareEverything() {
        this.runPrepare(this.runContext('full'), countsFromEngine()).catch(errorMessage => {
            logger.error(errorMessage);
            process.exit(1);
        });
    }

    private runContext(mode: RunMode): RunContext {
        return {
            mode,
            config: Configuration,
            files: this.files,
            updatedFiles: this.updatedFiles,
            startTime: startTime.valueOf(),
            generators: this.generators
        };
    }

    /**
     * Run the selected prepare stages, then export or emit the HTML output.
     * A failed stage rejects with the stage's rejection reason.
     */
    private runPrepare(
        ctx: RunContext,
        counts: SourceCounts,
        afterHtmlStart: () => void = () => undefined
    ): Promise<void> {
        return runPrepareStages(ctx, selectPrepareStages(ctx, counts)).then(prepared => {
            if (isErr(prepared)) {
                return Promise.reject(prepared.message);
            }
            if (Configuration.mainData.exportFormat !== COMPODOC_DEFAULTS.exportFormat) {
                if (
                    COMPODOC_DEFAULTS.exportFormatsSupported.indexOf(
                        Configuration.mainData.exportFormat
                    ) > -1
                ) {
                    logger.info(
                        `Generating documentation in export format ${Configuration.mainData.exportFormat}`
                    );
                    ExportEngine.export(Configuration.mainData.output, Configuration.mainData).then(
                        () => {
                            resolveGenerationPromise(true);
                            this.endCallback();
                            logger.info(
                                'Documentation generated in ' +
                                    Configuration.mainData.output +
                                    ' in ' +
                                    this.getElapsedTime() +
                                    ' seconds'
                            );
                            if (Configuration.mainData.serve) {
                                logger.info(
                                    `Serving documentation from ${Configuration.mainData.output} at http://${Configuration.mainData.hostname}:${Configuration.mainData.port}`
                                );
                                this.serveAndStartWatch(Configuration.mainData.output);
                            }
                        }
                    );
                } else {
                    logger.warn(`Exported format not supported`);
                }
            } else {
                this.emitHtml();
                afterHtmlStart();
            }
        });
    }

    /**
     * Graphs, then every page and the output finalisation.
     */
    private emitHtml(): Promise<void> {
        return this.generators.graph.processGraphs().then(() => this.emitPages());
    }

    /**
     * Write the pages, the additional pages and the assets, then finalise the
     * output and either serve it or settle the generation promise.
     */
    private async emitPages(): Promise<void> {
        const outputContext = { config: Configuration, startTime: startTime.valueOf() };

        await this.generators.pageWriter.processPages();
        if (Configuration.mainData.additionalPages.length > 0) {
            await this.generators.additional.processAdditionalPages(this.generators.pageWriter);
        }
        if (Configuration.mainData.assetsFolder !== '') {
            await copyAssetsFolder(outputContext);
        }
        const copied = await copyResources(outputContext);
        if (isErr(copied)) {
            return;
        }
        const finalized = await finalizeOutput(outputContext);
        if (isErr(finalized)) {
            process.exit(finalized.message.exitCode);
        }

        if (Configuration.mainData.serve) {
            logger.info(
                `Serving documentation from ${Configuration.mainData.output} at http://${Configuration.mainData.hostname}:${Configuration.mainData.port}`
            );
            this.serveAndStartWatch(Configuration.mainData.output);
        } else {
            resolveGenerationPromise(true);
            this.endCallback();
        }
    }

    /**
     * Calculates the elapsed time since the program was started.
     *
     * @returns {number}
     */
    private getElapsedTime() {
        return (Date.now() - startTime.valueOf()) / 1000;
    }

    public serveAndStartWatch(folder: string): void {
        if (!this.isWatching) {
            startWebServer(folder, {
                host: Configuration.mainData.host || 'localhost',
                port: Configuration.mainData.port,
                open: Configuration.mainData.open
            });
        }
        this.startWatchIfRequested();
    }

    private startWatchIfRequested(): void {
        if (Configuration.mainData.watch && !this.isWatching) {
            if (typeof this.files === 'undefined') {
                logger.error('No sources files available, please use -p flag');
                rejectGenerationPromise();
                process.exit(1);
            } else {
                this.runWatch();
            }
        } else if (Configuration.mainData.watch && this.isWatching) {
            const srcFolder = findMainSourceFolder(this.files);
            logger.info(`Already watching sources in ${srcFolder} folder`);
        }
    }

    public async runWatch() {
        let sources = [findMainSourceFolder(this.files)];
        let watcherReady = false;

        this.isWatching = true;

        logger.info(`Watching sources in ${findMainSourceFolder(this.files)} folder`);

        if (MarkdownEngine.hasRootMarkdowns()) {
            sources = sources.concat(MarkdownEngine.listRootMarkdowns());
        }

        if (Configuration.mainData.includes !== '') {
            sources = sources.concat(Configuration.mainData.includes);
        }

        // Check all elements of sources list exist
        sources = cleanSourcesForWatch(sources);

        const { default: chokidar } = await import('chokidar');
        const watcher = chokidar.watch(sources, {
            awaitWriteFinish: true,
            ignoreInitial: true,
            ignored: /(spec|\.d)\.ts/
        });
        let timerAddAndRemoveRef;
        let timerChangeRef;
        const runnerAddAndRemove = () => {
            startTime = new Date();
            this.generate();
        };
        const waiterAddAndRemove = () => {
            clearTimeout(timerAddAndRemoveRef);
            timerAddAndRemoveRef = setTimeout(runnerAddAndRemove, 1000);
        };
        const runnerChange = () => {
            startTime = new Date();
            this.setUpdatedFiles(this.watchChangedFiles);
            if (this.hasWatchedFilesTSFiles()) {
                this.getMicroDependenciesData();
            } else if (this.hasWatchedFilesRootMarkdownFiles()) {
                this.rebuildRootMarkdowns();
            } else {
                this.rebuildExternalDocumentation();
            }
        };
        const waiterChange = () => {
            clearTimeout(timerChangeRef);
            timerChangeRef = setTimeout(runnerChange, 1000);
        };

        watcher.on('ready', () => {
            if (!watcherReady) {
                watcherReady = true;
                watcher
                    .on('add', file => {
                        logger.debug(`File ${file} has been added`);
                        // Test extension, if ts
                        // rescan everything
                        if (path.extname(file) === '.ts') {
                            waiterAddAndRemove();
                        }
                    })
                    .on('change', file => {
                        logger.debug(`File ${file} has been changed`);
                        // Test extension, if ts
                        // rescan only file
                        if (
                            path.extname(file) === '.ts' ||
                            path.extname(file) === '.md' ||
                            path.extname(file) === '.json'
                        ) {
                            this.watchChangedFiles.push(path.join(cwd + path.sep + file));
                            waiterChange();
                        }
                    })
                    .on('unlink', file => {
                        logger.debug(`File ${file} has been removed`);
                        // Test extension, if ts
                        // rescan everything
                        if (path.extname(file) === '.ts') {
                            waiterAddAndRemove();
                        }
                    });
            }
        });
    }

    /**
     * Return the application / root component instance.
     */
    get application(): Application {
        return this;
    }

    get isCLI(): boolean {
        return false;
    }
}
