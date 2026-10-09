import { err, ok, type Result, sequenceAsync } from '../../lib';
import { logger } from '../../utils/logger';
import DependenciesEngine from '../engines/dependencies.engine';
import type { DependenciesData } from '../services/dependencies';
import type { RunContext } from './context';
import { type Halt, halt } from './halt';

/**
 * How many symbols of each kind the prepare phase works on: the whole
 * project in `full`/`coverage` mode, the changed files in `diff` mode.
 */
export interface SourceCounts {
    readonly components: number;
    readonly directives: number;
    readonly entities: number;
    readonly injectables: number;
    readonly tokens: number;
    readonly interceptors: number;
    readonly guards: number;
    /** Functional resolvers (functions and constants). */
    readonly resolvers: number;
    readonly pipes: number;
    readonly classes: number;
    readonly interfaces: number;
    /** Sum of variables, functions, type aliases and enumerations. */
    readonly utilities: number;
    /** Whether the crawler found a routes tree. */
    readonly routes: boolean;
}

export interface PrepareStage {
    readonly key: string;
    readonly when: (ctx: RunContext, counts: SourceCounts) => boolean;
    /** Resolves with a `Halt` when the stage stops the run on purpose. */
    readonly run: (ctx: RunContext) => Promise<Halt | undefined>;
}

/** Why the prepare stages stopped: a deliberate halt or a rejected stage. */
export type PrepareStop =
    | { readonly kind: 'halt'; readonly halt: Halt }
    | { readonly kind: 'error'; readonly error: unknown };

/** Adapt a generator call that never halts. */
const step =
    (fn: (ctx: RunContext) => unknown) =>
    async (ctx: RunContext): Promise<undefined> => {
        await fn(ctx);
        return undefined;
    };

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
        run: step(ctx => ctx.generators.component.prepare())
    },
    {
        key: 'directive',
        when: hasAny(c => c.directives),
        run: step(ctx => ctx.generators.directive.prepare())
    },
    {
        key: 'entity',
        when: hasAny(c => c.entities),
        run: step(ctx => ctx.generators.entity.prepare())
    },
    {
        key: 'injectable',
        when: hasAny(c => c.injectables),
        run: step(ctx => ctx.generators.injectable.prepare())
    },
    { key: 'token', when: hasAny(c => c.tokens), run: step(ctx => ctx.generators.token.prepare()) },
    {
        key: 'diCluster',
        when: ctx => {
            const view = ctx.config.mainData.di;
            return (view?.clusters.length ?? 0) + (view?.plainProviders.length ?? 0) > 0;
        },
        run: step(ctx => ctx.generators.diPages.prepare())
    },
    {
        key: 'dependencyInjection',
        when: ctx => {
            const view = ctx.config.mainData.di;
            const count =
                (view?.clusters.length ?? 0) +
                (view?.plainProviders.length ?? 0) +
                (view?.tokens.length ?? 0);
            return count > 0;
        },
        run: step(ctx => ctx.generators.diPages.prepareLanding())
    },
    {
        key: 'interceptor',
        when: hasAny(c => c.interceptors),
        run: step(ctx => ctx.generators.interceptor.prepare())
    },
    { key: 'guard', when: hasAny(c => c.guards), run: step(ctx => ctx.generators.guard.prepare()) },
    {
        key: 'resolver',
        when: hasAny(c => c.resolvers),
        run: step(ctx => ctx.generators.resolver.prepare())
    },
    {
        key: 'routes',
        when: (ctx, counts) =>
            (isDiff(ctx) || counts.routes) && !ctx.config.mainData.disableRoutesGraph,
        run: step(ctx => ctx.generators.routes.prepare())
    },
    { key: 'pipe', when: hasAny(c => c.pipes), run: step(ctx => ctx.generators.pipe.prepare()) },
    {
        key: 'class',
        when: hasAny(c => c.classes),
        run: step(ctx => ctx.generators.class.prepare())
    },
    {
        key: 'interface',
        when: hasAny(c => c.interfaces),
        run: step(ctx => ctx.generators.interface.prepare())
    },
    { key: 'appConfig', when: always, run: step(ctx => ctx.generators.appConfig.prepare()) },
    {
        key: 'utilities',
        when: hasAny(c => c.utilities),
        run: step(ctx => ctx.generators.utilities.prepare())
    },
    { key: 'feature', when: always, run: step(ctx => ctx.generators.feature.prepare()) },
    { key: 'apiReference', when: always, run: step(ctx => ctx.generators.apiReference.prepare()) },
    {
        key: 'documentationCoverage',
        when: ctx => !ctx.config.mainData.disableCoverage,
        run: async ctx => {
            const verdict = await ctx.generators.coverage.prepareDocumentation();
            for (const line of verdict.lines) {
                logger[line.level](line.text);
            }
            return verdict.exitCode === null ? undefined : halt(verdict.exitCode, 'coverage-gate');
        }
    },
    {
        key: 'unitTestCoverage',
        when: oneShotWhen(ctx => ctx.config.mainData.unitTestCoverage !== ''),
        run: step(ctx => ctx.generators.coverage.prepareUnitTest())
    },
    {
        key: 'externalIncludes',
        when: oneShotWhen(ctx => ctx.config.mainData.includes !== ''),
        run: step(ctx => ctx.generators.additional.prepareExternalIncludes())
    },
    // Resolve `@playground` file refs after every prepare step has populated
    // `mainData.<kind>.playgrounds` and before page rendering reads
    // `data.playgroundFiles`.
    {
        key: 'playgroundFiles',
        when: always,
        run: step(ctx => ctx.generators.playgroundFiles.resolve())
    },
    // Resolve the `playgroundVendor` closure from the local `dist/` once; a hard
    // error here (unbuilt library) fails the build deliberately.
    {
        key: 'playgroundVendor',
        when: always,
        run: step(ctx => ctx.generators.playgroundVendor.resolve())
    },
    // Validate non-vendored playground imports against the pinned node_modules
    // versions, after vendoring so vendored packages are excluded. Warns by
    // default; throws under `--strictPlaygrounds`.
    {
        key: 'playgroundValidator',
        when: always,
        run: step(ctx => ctx.generators.playgroundValidator.resolve())
    }
];

/** The stages that run for this context, in table order. */
export const selectPrepareStages = (ctx: RunContext, counts: SourceCounts): PrepareStage[] =>
    PREPARE_STAGES.filter(stage => stage.when(ctx, counts));

/** Counts of the whole project, read after `DependenciesEngine.init`. */
/** Functions and constants of the miscellaneous lists that are a guard, interceptor or resolver. */
const functionalCount = (
    misc:
        | { readonly functions?: readonly unknown[]; readonly variables?: readonly unknown[] }
        | undefined,
    kind: string
): number =>
    [...(misc?.functions ?? []), ...(misc?.variables ?? [])].filter(
        item => (item as { functionalKind?: unknown }).functionalKind === kind
    ).length;

export const countsFromEngine = (): SourceCounts => ({
    components: DependenciesEngine.components.length,
    directives: DependenciesEngine.directives.length,
    entities: DependenciesEngine.entities.length,
    injectables: DependenciesEngine.injectables.length,
    tokens: DependenciesEngine.tokens?.length ?? 0,
    interceptors:
        DependenciesEngine.interceptors.length +
        functionalCount(DependenciesEngine.miscellaneous, 'interceptor'),
    guards:
        DependenciesEngine.guards.length +
        functionalCount(DependenciesEngine.miscellaneous, 'guard'),
    resolvers: functionalCount(DependenciesEngine.miscellaneous, 'resolver'),
    pipes: DependenciesEngine.pipes.length,
    classes: DependenciesEngine.classes.length,
    interfaces: DependenciesEngine.interfaces.length,
    utilities:
        DependenciesEngine.miscellaneous.variables.length +
        DependenciesEngine.miscellaneous.functions.length +
        DependenciesEngine.miscellaneous.typealiases.length +
        DependenciesEngine.miscellaneous.enumerations.length,
    routes: Boolean(DependenciesEngine.routes)
});

/** Counts of the changed files of a watch rebuild. */
export const countsFromDiff = (diff: DependenciesData): SourceCounts => ({
    components: diff.components.length,
    directives: diff.directives.length,
    entities: diff.entities.length,
    injectables: diff.injectables.length,
    tokens: diff.tokens?.length ?? 0,
    interceptors: diff.interceptors.length + functionalCount(diff.miscellaneous, 'interceptor'),
    guards: diff.guards.length + functionalCount(diff.miscellaneous, 'guard'),
    resolvers: functionalCount(diff.miscellaneous, 'resolver'),
    pipes: diff.pipes.length,
    classes: diff.classes.length,
    interfaces: diff.interfaces.length,
    utilities:
        diff.miscellaneous.variables.length +
        diff.miscellaneous.functions.length +
        diff.miscellaneous.typealiases.length +
        diff.miscellaneous.enumerations.length,
    routes: Boolean(diff.routesTree)
});

/**
 * Run the stages one after the other. A halting stage or a rejected stage
 * stops the sequence; later stages are not called.
 */
export const runPrepareStages = (
    ctx: RunContext,
    stages: readonly PrepareStage[]
): Promise<Result<RunContext, PrepareStop>> =>
    sequenceAsync<RunContext, PrepareStop>(
        stages.map(stage => async current => {
            try {
                const stopped = await stage.run(current);
                return stopped ? err({ kind: 'halt', halt: stopped }) : ok(current);
            } catch (error) {
                return err({ kind: 'error', error });
            }
        }),
        ctx
    );
