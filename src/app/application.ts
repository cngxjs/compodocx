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
import {
    AdditionalPageGenerator,
    ApiReferencePageGenerator,
    AppConfigPageGenerator,
    BucketLandingPageGenerator,
    ClassPageGenerator,
    ComponentPageGenerator,
    CoveragePageGenerator,
    copyAssetsFolder,
    copyResources,
    DirectivePageGenerator,
    EntityPageGenerator,
    finalizeOutput,
    GraphGenerator,
    GuardPageGenerator,
    InjectablePageGenerator,
    InterceptorPageGenerator,
    InterfacePageGenerator,
    MiscellaneousPageGenerator,
    ModulePageGenerator,
    NavTabsResolver,
    OverviewPageGenerator,
    PackageDependenciesPageGenerator,
    PageWriter,
    PipePageGenerator,
    PlaygroundFileResolver,
    PlaygroundValidator,
    PlaygroundVendorResolver,
    RoutesPageGenerator,
    TokenPageGenerator
} from './page-generator';
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

    private readonly navTabs: NavTabsResolver;
    private readonly pipePageGenerator: PipePageGenerator;
    private readonly classPageGenerator: ClassPageGenerator;
    private readonly interfacePageGenerator: InterfacePageGenerator;
    private readonly entityPageGenerator: EntityPageGenerator;
    private readonly directivePageGenerator: DirectivePageGenerator;
    private readonly injectablePageGenerator: InjectablePageGenerator;
    private readonly tokenPageGenerator: TokenPageGenerator;
    private readonly interceptorPageGenerator: InterceptorPageGenerator;
    private readonly guardPageGenerator: GuardPageGenerator;
    private readonly componentPageGenerator: ComponentPageGenerator;
    private readonly modulePageGenerator: ModulePageGenerator;
    private readonly miscellaneousPageGenerator: MiscellaneousPageGenerator;
    private readonly bucketLandingPageGenerator: BucketLandingPageGenerator;
    private readonly apiReferencePageGenerator: ApiReferencePageGenerator;
    private readonly appConfigPageGenerator: AppConfigPageGenerator;
    private readonly routesPageGenerator: RoutesPageGenerator;
    private readonly overviewPageGenerator: OverviewPageGenerator;
    private readonly additionalPageGenerator: AdditionalPageGenerator;
    private readonly packageDependenciesPageGenerator: PackageDependenciesPageGenerator;
    private readonly playgroundFileResolver: PlaygroundFileResolver;
    private readonly playgroundVendorResolver: PlaygroundVendorResolver;
    private readonly playgroundValidator: PlaygroundValidator;
    private readonly coveragePageGenerator: CoveragePageGenerator;
    private readonly pageWriter: PageWriter;
    private readonly graphGenerator: GraphGenerator;

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

        this.navTabs = new NavTabsResolver();
        this.pipePageGenerator = new PipePageGenerator(this.navTabs);
        this.classPageGenerator = new ClassPageGenerator(this.navTabs);
        this.interfacePageGenerator = new InterfacePageGenerator(this.navTabs);
        this.entityPageGenerator = new EntityPageGenerator(this.navTabs);
        this.directivePageGenerator = new DirectivePageGenerator(this.navTabs);
        this.injectablePageGenerator = new InjectablePageGenerator(this.navTabs);
        this.tokenPageGenerator = new TokenPageGenerator(this.navTabs);
        this.interceptorPageGenerator = new InterceptorPageGenerator(this.navTabs);
        this.guardPageGenerator = new GuardPageGenerator(this.navTabs);
        this.componentPageGenerator = new ComponentPageGenerator(this.navTabs);
        this.modulePageGenerator = new ModulePageGenerator(this.navTabs);
        this.miscellaneousPageGenerator = new MiscellaneousPageGenerator();
        this.bucketLandingPageGenerator = new BucketLandingPageGenerator();
        this.apiReferencePageGenerator = new ApiReferencePageGenerator();
        this.appConfigPageGenerator = new AppConfigPageGenerator();
        this.routesPageGenerator = new RoutesPageGenerator();
        this.overviewPageGenerator = new OverviewPageGenerator();
        this.additionalPageGenerator = new AdditionalPageGenerator();
        this.packageDependenciesPageGenerator = new PackageDependenciesPageGenerator();
        this.playgroundFileResolver = new PlaygroundFileResolver();
        this.playgroundVendorResolver = new PlaygroundVendorResolver();
        this.playgroundValidator = new PlaygroundValidator();
        this.coveragePageGenerator = new CoveragePageGenerator();
        this.pageWriter = new PageWriter();
        this.graphGenerator = new GraphGenerator();
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
                        this.packageDependenciesPageGenerator.processDependencies(
                            parsedData.dependencies
                        );
                    }
                    if (typeof parsedData.peerDependencies !== 'undefined') {
                        this.packageDependenciesPageGenerator.processPeerDependencies(
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

                this.overviewPageGenerator.processMarkdowns().then(
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
                this.overviewPageGenerator.processMarkdowns().then(
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
            return this.overviewPageGenerator.processMarkdowns();
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
                return this.additionalPageGenerator.prepareExternalIncludes();
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
        const actions = [];

        Configuration.resetPages();

        if (!Configuration.mainData.disableRoutesGraph) {
            actions.push(() => this.routesPageGenerator.prepare());
        }

        if (diffCrawledData.components.length > 0) {
            actions.push(() => this.componentPageGenerator.prepare());
        }
        if (diffCrawledData.entities.length > 0) {
            actions.push(() => this.entityPageGenerator.prepare());
        }
        if (diffCrawledData.modules.length > 0) {
            actions.push(() => this.modulePageGenerator.prepare());
        }

        if (diffCrawledData.directives.length > 0) {
            actions.push(() => this.directivePageGenerator.prepare());
        }

        if (diffCrawledData.injectables.length > 0) {
            actions.push(() => this.injectablePageGenerator.prepare());
        }

        if ((diffCrawledData.tokens?.length ?? 0) > 0) {
            actions.push(() => this.tokenPageGenerator.prepare());
        }

        if (diffCrawledData.interceptors.length > 0) {
            actions.push(() => this.interceptorPageGenerator.prepare());
        }

        if (diffCrawledData.guards.length > 0) {
            actions.push(() => this.guardPageGenerator.prepare());
        }

        if (diffCrawledData.pipes.length > 0) {
            actions.push(() => this.pipePageGenerator.prepare());
        }

        if (diffCrawledData.classes.length > 0) {
            actions.push(() => this.classPageGenerator.prepare());
        }

        if (diffCrawledData.interfaces.length > 0) {
            actions.push(() => this.interfacePageGenerator.prepare());
        }

        actions.push(() => this.appConfigPageGenerator.prepare());

        if (
            diffCrawledData.miscellaneous.variables.length > 0 ||
            diffCrawledData.miscellaneous.functions.length > 0 ||
            diffCrawledData.miscellaneous.typealiases.length > 0 ||
            diffCrawledData.miscellaneous.enumerations.length > 0
        ) {
            actions.push(() => this.miscellaneousPageGenerator.prepare());
        }

        actions.push(() => this.bucketLandingPageGenerator.prepare());
        actions.push(() => this.apiReferencePageGenerator.prepare());

        if (!Configuration.mainData.disableCoverage) {
            actions.push(() => this.coveragePageGenerator.prepareDocumentation());
        }

        // Resolve `@playground` file refs after every dependency kind has
        // been prepared (so `dependency.playgrounds` is fully populated) and
        // before page rendering reads `data.playgroundFiles`.
        actions.push(() => Promise.resolve(this.playgroundFileResolver.resolve()));
        // Resolve the `playgroundVendor` closure from the local `dist/` once;
        // a hard error here (unbuilt library) fails the build deliberately.
        actions.push(() => Promise.resolve(this.playgroundVendorResolver.resolve()));
        // Validate non-vendored playground imports against the pinned
        // node_modules versions — runs after vendoring so vendored packages
        // are excluded. Warns by default; throws under `--strictPlaygrounds`.
        actions.push(() => Promise.resolve(this.playgroundValidator.resolve()));

        promiseSequential(actions)
            .then(_res => {
                if (Configuration.mainData.exportFormat !== COMPODOC_DEFAULTS.exportFormat) {
                    if (
                        COMPODOC_DEFAULTS.exportFormatsSupported.indexOf(
                            Configuration.mainData.exportFormat
                        ) > -1
                    ) {
                        logger.info(
                            `Generating documentation in export format ${Configuration.mainData.exportFormat}`
                        );
                        ExportEngine.export(
                            Configuration.mainData.output,
                            Configuration.mainData
                        ).then(() => {
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
                        });
                    } else {
                        logger.warn(`Exported format not supported`);
                    }
                } else {
                    this.emitHtml();
                    this.clearUpdatedFiles();
                }
            })
            .catch(errorMessage => {
                logger.error(errorMessage);
            });
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
        const actions = [];

        actions.push(() => {
            return this.componentPageGenerator.prepare();
        });
        actions.push(() => {
            return this.modulePageGenerator.prepare();
        });

        if (DependenciesEngine.directives.length > 0) {
            actions.push(() => {
                return this.directivePageGenerator.prepare();
            });
        }

        if (DependenciesEngine.entities.length > 0) {
            actions.push(() => {
                return this.entityPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.injectables.length > 0) {
            actions.push(() => {
                return this.injectablePageGenerator.prepare();
            });
        }

        if ((DependenciesEngine.tokens?.length ?? 0) > 0) {
            actions.push(() => {
                return this.tokenPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.interceptors.length > 0) {
            actions.push(() => {
                return this.interceptorPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.guards.length > 0) {
            actions.push(() => {
                return this.guardPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.routes && !Configuration.mainData.disableRoutesGraph) {
            actions.push(() => {
                return this.routesPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.pipes.length > 0) {
            actions.push(() => {
                return this.pipePageGenerator.prepare();
            });
        }

        if (DependenciesEngine.classes.length > 0) {
            actions.push(() => {
                return this.classPageGenerator.prepare();
            });
        }

        if (DependenciesEngine.interfaces.length > 0) {
            actions.push(() => {
                return this.interfacePageGenerator.prepare();
            });
        }

        actions.push(() => {
            return this.appConfigPageGenerator.prepare();
        });

        if (
            DependenciesEngine.miscellaneous.variables.length > 0 ||
            DependenciesEngine.miscellaneous.functions.length > 0 ||
            DependenciesEngine.miscellaneous.typealiases.length > 0 ||
            DependenciesEngine.miscellaneous.enumerations.length > 0
        ) {
            actions.push(() => {
                return this.miscellaneousPageGenerator.prepare();
            });
        }

        actions.push(() => {
            return this.bucketLandingPageGenerator.prepare();
        });

        actions.push(() => {
            return this.apiReferencePageGenerator.prepare();
        });

        if (!Configuration.mainData.disableCoverage) {
            actions.push(() => {
                return this.coveragePageGenerator.prepareDocumentation();
            });
        }

        if (Configuration.mainData.unitTestCoverage !== '') {
            actions.push(() => {
                return this.coveragePageGenerator.prepareUnitTest();
            });
        }

        if (Configuration.mainData.includes !== '') {
            actions.push(() => {
                return this.additionalPageGenerator.prepareExternalIncludes();
            });
        }

        // Resolve `@playground` file refs after every prepare* step has
        // populated `Configuration.mainData.<kind>.playgrounds`.
        actions.push(() => Promise.resolve(this.playgroundFileResolver.resolve()));
        // Vendor closure (watch mode) — kept in lockstep with the one-shot
        // queue so `playgroundVendor` rebuilds aren't a silent no-op.
        actions.push(() => Promise.resolve(this.playgroundVendorResolver.resolve()));
        // Pre-publish import validation (watch mode) — same lockstep.
        actions.push(() => Promise.resolve(this.playgroundValidator.resolve()));

        promiseSequential(actions)
            .then(_res => {
                if (Configuration.mainData.exportFormat !== COMPODOC_DEFAULTS.exportFormat) {
                    if (
                        COMPODOC_DEFAULTS.exportFormatsSupported.indexOf(
                            Configuration.mainData.exportFormat
                        ) > -1
                    ) {
                        logger.info(
                            `Generating documentation in export format ${Configuration.mainData.exportFormat}`
                        );
                        ExportEngine.export(
                            Configuration.mainData.output,
                            Configuration.mainData
                        ).then(() => {
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
                        });
                    } else {
                        logger.warn(`Exported format not supported`);
                    }
                } else {
                    this.emitHtml();
                }
            })
            .catch(errorMessage => {
                logger.error(errorMessage);
                process.exit(1);
            });
    }

    /**
     * Graphs, then every page and the output finalisation.
     */
    private emitHtml(): Promise<void> {
        return this.graphGenerator.processGraphs().then(() => this.emitPages());
    }

    /**
     * Write the pages, the additional pages and the assets, then finalise the
     * output and either serve it or settle the generation promise.
     */
    private async emitPages(): Promise<void> {
        const outputContext = { config: Configuration, startTime: startTime.valueOf() };

        await this.pageWriter.processPages();
        if (Configuration.mainData.additionalPages.length > 0) {
            await this.additionalPageGenerator.processAdditionalPages(this.pageWriter);
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
