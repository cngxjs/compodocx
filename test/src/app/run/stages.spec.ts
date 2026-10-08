import { describe, expect, it } from 'vitest';
import type { RunContext, RunMode } from '../../../../src/app/run/context';
import {
    PREPARE_STAGES,
    type SourceCounts,
    selectPrepareStages
} from '../../../../src/app/run/stages';

const EMPTY: SourceCounts = {
    components: 0,
    directives: 0,
    entities: 0,
    injectables: 0,
    tokens: 0,
    interceptors: 0,
    guards: 0,
    pipes: 0,
    classes: 0,
    interfaces: 0,
    utilities: 0,
    routes: false
};

const EVERY_KIND: SourceCounts = {
    components: 1,
    directives: 1,
    entities: 1,
    injectables: 1,
    tokens: 1,
    interceptors: 1,
    guards: 1,
    pipes: 1,
    classes: 1,
    interfaces: 1,
    utilities: 1,
    routes: true
};

const ALL_KEYS = [
    'component',
    'directive',
    'entity',
    'injectable',
    'token',
    'interceptor',
    'guard',
    'routes',
    'pipe',
    'class',
    'interface',
    'appConfig',
    'utilities',
    'bucketLanding',
    'apiReference',
    'documentationCoverage',
    'unitTestCoverage',
    'externalIncludes',
    'playgroundFiles',
    'playgroundVendor',
    'playgroundValidator'
];

const context = (mode: RunMode, mainData: Record<string, unknown> = {}): RunContext =>
    ({
        mode,
        config: {
            mainData: {
                disableRoutesGraph: false,
                disableCoverage: false,
                unitTestCoverage: '',
                includes: '',
                ...mainData
            }
        },
        files: [],
        updatedFiles: [],
        startTime: 0,
        generators: {}
    }) as unknown as RunContext;

const keys = (ctx: RunContext, counts: SourceCounts) =>
    selectPrepareStages(ctx, counts).map(stage => stage.key);

describe('prepare stage table', () => {
    it('selects only the unconditional stages for an empty full run', () => {
        expect(keys(context('full'), EMPTY)).toEqual([
            'component',
            'appConfig',
            'bucketLanding',
            'apiReference',
            'documentationCoverage',
            'playgroundFiles',
            'playgroundVendor',
            'playgroundValidator'
        ]);
    });

    it('selects all 21 stages in table order for a full run with every kind', () => {
        const ctx = context('full', { unitTestCoverage: 'coverage.json', includes: 'docs' });
        expect(keys(ctx, EVERY_KIND)).toEqual(ALL_KEYS);
        expect(PREPARE_STAGES.map(stage => stage.key)).toEqual(ALL_KEYS);
    });

    it('never selects unit test coverage or external includes in diff mode', () => {
        const ctx = context('diff', { unitTestCoverage: 'coverage.json', includes: 'docs' });
        const selected = keys(ctx, EVERY_KIND);
        expect(selected).not.toContain('unitTestCoverage');
        expect(selected).not.toContain('externalIncludes');
        expect(selected).toHaveLength(ALL_KEYS.length - 2);
    });

    it('selects the component stage in diff mode only for changed components', () => {
        expect(keys(context('diff'), EMPTY)).not.toContain('component');
        expect(keys(context('diff'), { ...EMPTY, components: 2 })).toContain('component');
        expect(PREPARE_STAGES.map(stage => stage.key)).not.toContain('module');
    });

    it('gates routes on the routes tree in full mode but not in diff mode', () => {
        expect(keys(context('full'), EMPTY)).not.toContain('routes');
        expect(keys(context('full'), { ...EMPTY, routes: true })).toContain('routes');
        expect(keys(context('diff'), EMPTY)).toContain('routes');
        expect(keys(context('diff', { disableRoutesGraph: true }), EMPTY)).not.toContain('routes');
        expect(
            keys(context('full', { disableRoutesGraph: true }), { ...EMPTY, routes: true })
        ).not.toContain('routes');
    });

    it('drops documentation coverage under disableCoverage in both modes', () => {
        for (const mode of ['full', 'coverage', 'diff'] as const) {
            expect(keys(context(mode, { disableCoverage: true }), EVERY_KIND)).not.toContain(
                'documentationCoverage'
            );
        }
    });

    it('gates unit test coverage and external includes on their options', () => {
        expect(keys(context('full'), EMPTY)).not.toContain('unitTestCoverage');
        expect(keys(context('full'), EMPTY)).not.toContain('externalIncludes');
        expect(keys(context('full', { unitTestCoverage: 'c.json' }), EMPTY)).toContain(
            'unitTestCoverage'
        );
        expect(keys(context('coverage', { includes: 'docs' }), EMPTY)).toContain(
            'externalIncludes'
        );
    });

    it('keeps table order for any selection', () => {
        const ctx = context('diff');
        const selected = keys(ctx, { ...EMPTY, pipes: 1, guards: 1, components: 1 });
        const positions = selected.map(key => ALL_KEYS.indexOf(key));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(selected.slice(0, 4)).toEqual(['component', 'guard', 'routes', 'pipe']);
    });
});
