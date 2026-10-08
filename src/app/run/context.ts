import type { Result } from '../../lib';
import type { SemanticState } from '../compiler/semantic';
import type Configuration from '../configuration';
import type { DiView } from '../di';
import type { SymbolTable } from '../links';
import {
    AdditionalPageGenerator,
    ApiReferencePageGenerator,
    AppConfigPageGenerator,
    BucketLandingPageGenerator,
    ClassPageGenerator,
    ComponentPageGenerator,
    CoveragePageGenerator,
    DiPageGenerator,
    DirectivePageGenerator,
    EntityPageGenerator,
    GuardPageGenerator,
    InjectablePageGenerator,
    InterceptorPageGenerator,
    InterfacePageGenerator,
    MiscellaneousPageGenerator,
    NavTabsResolver,
    OverviewPageGenerator,
    PackageDependenciesPageGenerator,
    PageWriter,
    PipePageGenerator,
    PlaygroundFileResolver,
    PlaygroundValidator,
    PlaygroundVendorResolver,
    ResolverPageGenerator,
    RoutesPageGenerator,
    TokenPageGenerator
} from '../page-generator';
import type { DependenciesData } from '../services/dependencies';
import type { Halt } from './halt';

export { type Halt, halt } from './halt';

/**
 * What a run does. `full` and `coverage` are one-shot runs; `diff`,
 * `markdown` and `includes` are the partial watch-mode rebuilds.
 */
export type RunMode = 'full' | 'coverage' | 'diff' | 'markdown' | 'includes';

/** The page generators, created once per process and shared by every run. */
export interface Generators {
    readonly component: ComponentPageGenerator;
    readonly directive: DirectivePageGenerator;
    readonly entity: EntityPageGenerator;
    readonly injectable: InjectablePageGenerator;
    readonly token: TokenPageGenerator;
    readonly interceptor: InterceptorPageGenerator;
    readonly guard: GuardPageGenerator;
    readonly resolver: ResolverPageGenerator;
    readonly diPages: DiPageGenerator;
    readonly routes: RoutesPageGenerator;
    readonly pipe: PipePageGenerator;
    readonly class: ClassPageGenerator;
    readonly interface: InterfacePageGenerator;
    readonly appConfig: AppConfigPageGenerator;
    readonly utilities: MiscellaneousPageGenerator;
    readonly bucketLanding: BucketLandingPageGenerator;
    readonly apiReference: ApiReferencePageGenerator;
    readonly coverage: CoveragePageGenerator;
    readonly additional: AdditionalPageGenerator;
    readonly overview: OverviewPageGenerator;
    readonly packageDependencies: PackageDependenciesPageGenerator;
    readonly playgroundFiles: PlaygroundFileResolver;
    readonly playgroundVendor: PlaygroundVendorResolver;
    readonly playgroundValidator: PlaygroundValidator;
    readonly pageWriter: PageWriter;
}

export const createGenerators = (): Generators => {
    const navTabs = new NavTabsResolver();
    return {
        component: new ComponentPageGenerator(navTabs),
        directive: new DirectivePageGenerator(navTabs),
        entity: new EntityPageGenerator(navTabs),
        injectable: new InjectablePageGenerator(navTabs),
        token: new TokenPageGenerator(navTabs),
        interceptor: new InterceptorPageGenerator(navTabs),
        guard: new GuardPageGenerator(navTabs),
        resolver: new ResolverPageGenerator(),
        diPages: new DiPageGenerator(),
        routes: new RoutesPageGenerator(),
        pipe: new PipePageGenerator(navTabs),
        class: new ClassPageGenerator(navTabs),
        interface: new InterfacePageGenerator(navTabs),
        appConfig: new AppConfigPageGenerator(),
        utilities: new MiscellaneousPageGenerator(),
        bucketLanding: new BucketLandingPageGenerator(),
        apiReference: new ApiReferencePageGenerator(),
        coverage: new CoveragePageGenerator(),
        additional: new AdditionalPageGenerator(),
        overview: new OverviewPageGenerator(),
        packageDependencies: new PackageDependenciesPageGenerator(),
        playgroundFiles: new PlaygroundFileResolver(),
        playgroundVendor: new PlaygroundVendorResolver(),
        playgroundValidator: new PlaygroundValidator(),
        pageWriter: new PageWriter()
    };
};

export interface RunContext {
    readonly mode: RunMode;
    /** The `Configuration` singleton, passed explicitly. */
    readonly config: typeof Configuration;
    /** Files from the initial scan. */
    readonly files: readonly string[];
    /** Files changed since the last build (watch rebuilds only). */
    readonly updatedFiles: readonly string[];
    /** `Date.now()` at run start. */
    readonly startTime: number;
    readonly generators: Generators;
    /** Crawl result of the changed files, set by the micro-crawl phase. */
    readonly diff?: DependenciesData;
    /**
     * Project-wide program and semantic facts. Set by the crawl phases; holds
     * the previous run's state until then, so a rebuild can reuse its program.
     */
    readonly semantic?: SemanticState;
    /** Every documented symbol by id. Built by the crawl phases. */
    readonly symbols?: SymbolTable;
    /** Where providers, feature functions and tokens are documented. Built with the table. */
    readonly di?: DiView;
    /**
     * Watch rebuilds only: called once the output phase has started writing
     * HTML, so the watcher can reset its changed-file buffer.
     */
    readonly onEmitStart?: () => void;
}

/** What every run of one process shares. */
export interface RunBase {
    readonly config: typeof Configuration;
    readonly files: readonly string[];
    readonly generators: Generators;
    /** Semantic state of the previous run, if any. */
    readonly semantic?: SemanticState;
}

export const createRunContext = (
    base: RunBase,
    mode: RunMode,
    updatedFiles: readonly string[] = [],
    onEmitStart?: () => void
): RunContext => ({
    mode,
    config: base.config,
    files: base.files,
    updatedFiles,
    startTime: Date.now(),
    generators: base.generators,
    semantic: base.semantic,
    onEmitStart
});

export type Stage = (ctx: RunContext) => Promise<Result<RunContext, Halt>>;
