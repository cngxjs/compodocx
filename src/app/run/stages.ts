import { err, ok, type Result, sequenceAsync } from '../../lib';
import DependenciesEngine from '../engines/dependencies.engine';
import type { DependenciesData } from '../services/dependencies';
import type { RunContext } from './context';

/**
 * How many symbols of each kind the prepare phase works on: the whole
 * project in `full`/`coverage` mode, the changed files in `diff` mode.
 */
export interface SourceCounts {
    readonly components: number;
    readonly modules: number;
    readonly directives: number;
    readonly entities: number;
    readonly injectables: number;
    readonly tokens: number;
    readonly interceptors: number;
    readonly guards: number;
    readonly pipes: number;
    readonly classes: number;
    readonly interfaces: number;
    /** Sum of variables, functions, type aliases and enumerations. */
    readonly miscellaneous: number;
    /** Whether the crawler found a routes tree. */
    readonly routes: boolean;
}

export interface PrepareStage {
    readonly key: string;
    readonly when: (ctx: RunContext, counts: SourceCounts) => boolean;
    readonly run: (ctx: RunContext) => Promise<unknown>;
}

const isDiff = (ctx: RunContext) => ctx.mode === 'diff';

const always = () => true;

/** Kinds that run in every one-shot build but only for changed files in a diff. */
const alwaysUnlessDiffWithout =
    (count: (counts: SourceCounts) => number) => (ctx: RunContext, counts: SourceCounts) =>
        !isDiff(ctx) || count(counts) > 0;

const hasAny =
    (count: (counts: SourceCounts) => number) => (_ctx: RunContext, counts: SourceCounts) =>
        count(counts) > 0;

/** One-shot builds only; watch rebuilds have never run these stages. */
const oneShotWhen = (predicate: (ctx: RunContext) => boolean) => (ctx: RunContext) =>
    !isDiff(ctx) && predicate(ctx);

/**
 * Every prepare step in execution order. The order is part of the output
 * contract; a new prepare step is one row here.
 */
export const PREPARE_STAGES: readonly PrepareStage[] = [
    {
        key: 'component',
        when: alwaysUnlessDiffWithout(c => c.components),
        run: ctx => ctx.generators.component.prepare()
    },
    {
        key: 'module',
        when: alwaysUnlessDiffWithout(c => c.modules),
        run: ctx => ctx.generators.module.prepare()
    },
    {
        key: 'directive',
        when: hasAny(c => c.directives),
        run: ctx => ctx.generators.directive.prepare()
    },
    { key: 'entity', when: hasAny(c => c.entities), run: ctx => ctx.generators.entity.prepare() },
    {
        key: 'injectable',
        when: hasAny(c => c.injectables),
        run: ctx => ctx.generators.injectable.prepare()
    },
    { key: 'token', when: hasAny(c => c.tokens), run: ctx => ctx.generators.token.prepare() },
    {
        key: 'interceptor',
        when: hasAny(c => c.interceptors),
        run: ctx => ctx.generators.interceptor.prepare()
    },
    { key: 'guard', when: hasAny(c => c.guards), run: ctx => ctx.generators.guard.prepare() },
    {
        key: 'routes',
        when: (ctx, counts) =>
            (isDiff(ctx) || counts.routes) && !ctx.config.mainData.disableRoutesGraph,
        run: ctx => ctx.generators.routes.prepare()
    },
    { key: 'pipe', when: hasAny(c => c.pipes), run: ctx => ctx.generators.pipe.prepare() },
    { key: 'class', when: hasAny(c => c.classes), run: ctx => ctx.generators.class.prepare() },
    {
        key: 'interface',
        when: hasAny(c => c.interfaces),
        run: ctx => ctx.generators.interface.prepare()
    },
    { key: 'appConfig', when: always, run: ctx => ctx.generators.appConfig.prepare() },
    {
        key: 'miscellaneous',
        when: hasAny(c => c.miscellaneous),
        run: ctx => ctx.generators.miscellaneous.prepare()
    },
    { key: 'bucketLanding', when: always, run: ctx => ctx.generators.bucketLanding.prepare() },
    { key: 'apiReference', when: always, run: ctx => ctx.generators.apiReference.prepare() },
    {
        key: 'documentationCoverage',
        when: ctx => !ctx.config.mainData.disableCoverage,
        run: ctx => ctx.generators.coverage.prepareDocumentation()
    },
    {
        key: 'unitTestCoverage',
        when: oneShotWhen(ctx => ctx.config.mainData.unitTestCoverage !== ''),
        run: ctx => ctx.generators.coverage.prepareUnitTest()
    },
    {
        key: 'externalIncludes',
        when: oneShotWhen(ctx => ctx.config.mainData.includes !== ''),
        run: ctx => ctx.generators.additional.prepareExternalIncludes()
    },
    // Resolve `@playground` file refs after every prepare step has populated
    // `mainData.<kind>.playgrounds` and before page rendering reads
    // `data.playgroundFiles`.
    {
        key: 'playgroundFiles',
        when: always,
        run: async ctx => ctx.generators.playgroundFiles.resolve()
    },
    // Resolve the `playgroundVendor` closure from the local `dist/` once; a hard
    // error here (unbuilt library) fails the build deliberately.
    {
        key: 'playgroundVendor',
        when: always,
        run: async ctx => ctx.generators.playgroundVendor.resolve()
    },
    // Validate non-vendored playground imports against the pinned node_modules
    // versions, after vendoring so vendored packages are excluded. Warns by
    // default; throws under `--strictPlaygrounds`.
    {
        key: 'playgroundValidator',
        when: always,
        run: async ctx => ctx.generators.playgroundValidator.resolve()
    }
];

/** The stages that run for this context, in table order. */
export const selectPrepareStages = (ctx: RunContext, counts: SourceCounts): PrepareStage[] =>
    PREPARE_STAGES.filter(stage => stage.when(ctx, counts));

/** Counts of the whole project, read after `DependenciesEngine.init`. */
export const countsFromEngine = (): SourceCounts => ({
    components: DependenciesEngine.components.length,
    modules: DependenciesEngine.modules.length,
    directives: DependenciesEngine.directives.length,
    entities: DependenciesEngine.entities.length,
    injectables: DependenciesEngine.injectables.length,
    tokens: DependenciesEngine.tokens?.length ?? 0,
    interceptors: DependenciesEngine.interceptors.length,
    guards: DependenciesEngine.guards.length,
    pipes: DependenciesEngine.pipes.length,
    classes: DependenciesEngine.classes.length,
    interfaces: DependenciesEngine.interfaces.length,
    miscellaneous:
        DependenciesEngine.miscellaneous.variables.length +
        DependenciesEngine.miscellaneous.functions.length +
        DependenciesEngine.miscellaneous.typealiases.length +
        DependenciesEngine.miscellaneous.enumerations.length,
    routes: Boolean(DependenciesEngine.routes)
});

/** Counts of the changed files of a watch rebuild. */
export const countsFromDiff = (diff: DependenciesData): SourceCounts => ({
    components: diff.components.length,
    modules: diff.modules.length,
    directives: diff.directives.length,
    entities: diff.entities.length,
    injectables: diff.injectables.length,
    tokens: diff.tokens?.length ?? 0,
    interceptors: diff.interceptors.length,
    guards: diff.guards.length,
    pipes: diff.pipes.length,
    classes: diff.classes.length,
    interfaces: diff.interfaces.length,
    miscellaneous:
        diff.miscellaneous.variables.length +
        diff.miscellaneous.functions.length +
        diff.miscellaneous.typealiases.length +
        diff.miscellaneous.enumerations.length,
    routes: Boolean(diff.routesTree)
});

/**
 * Run the stages one after the other. A rejected stage stops the sequence
 * and comes back as `err` with the rejection reason.
 */
export const runPrepareStages = (
    ctx: RunContext,
    stages: readonly PrepareStage[]
): Promise<Result<RunContext, unknown>> =>
    sequenceAsync<RunContext, unknown>(
        stages.map(stage => async current => {
            try {
                await stage.run(current);
                return ok(current);
            } catch (error) {
                return err(error);
            }
        }),
        ctx
    );
