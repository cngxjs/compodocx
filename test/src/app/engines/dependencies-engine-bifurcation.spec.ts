import { beforeEach, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import DependenciesEngine, {
    PRIMARY_KINDS,
    REFERENCE_KINDS
} from '../../../../src/app/engines/dependencies.engine';

/**
 * The bifurcation step of `prepareFeatureGroups()` partitions every bucket
 * in `categorizedByFeature` into Primary and Reference dicts using:
 *   - PRIMARY_KINDS membership (component, directive, pipe, injectable,
 *     class, guard, interceptor, entity)
 *   - REFERENCE_KINDS membership (interface, function, variable, typealias,
 *     enumeration)
 *   - Per-symbol `docsKind === 'primary'` override that promotes a
 *     reference-kind entity into Primary.
 *
 * These tests target the partition logic by invoking `init()` on the
 * DependenciesEngine singleton with crafted ParsedData and asserting on the
 * resulting `categorizedByFeaturePrimary` / `categorizedByFeatureReference`
 * snapshots.
 */
describe('DependenciesEngine — Primary/Reference bifurcation', () => {
    beforeEach(() => {
        Configuration.mainData.groupDepth = 2;
        // Pin the default scope so each test starts from a known state; the
        // scope-specific tests below override it explicitly.
        Configuration.mainData.featureLibraryScope = 'auto';
    });

    const makeParsed = (overrides: Partial<any> = {}): any => ({
        components: [],
        directives: [],
        injectables: [],
        interceptors: [],
        guards: [],
        interfaces: [],
        pipes: [],
        classes: [],
        entities: [],
        miscellaneous: {
            variables: [],
            functions: [],
            typealiases: [],
            enumerations: [],
            groupedVariables: [],
            groupedFunctions: [],
            groupedEnumerations: [],
            groupedTypeAliases: []
        },
        routesTree: {},
        appConfig: [],
        ...overrides
    });

    it('exposes ReadonlySets aligned with the spec', () => {
        expect(PRIMARY_KINDS.has('component')).toBe(true);
        expect(PRIMARY_KINDS.has('directive')).toBe(true);
        expect(PRIMARY_KINDS.has('pipe')).toBe(true);
        expect(PRIMARY_KINDS.has('injectable')).toBe(true);
        expect(PRIMARY_KINDS.has('class')).toBe(true);
        // Guards / interceptors / entities default to Primary so today's
        // feature-mode users don't see them silently disappear.
        expect(PRIMARY_KINDS.has('guard')).toBe(true);
        expect(PRIMARY_KINDS.has('interceptor')).toBe(true);
        expect(PRIMARY_KINDS.has('entity')).toBe(true);

        expect(REFERENCE_KINDS.has('interface')).toBe(true);
        expect(REFERENCE_KINDS.has('function')).toBe(true);
        expect(REFERENCE_KINDS.has('variable')).toBe(true);
        expect(REFERENCE_KINDS.has('typealias')).toBe(true);
        expect(REFERENCE_KINDS.has('enumeration')).toBe(true);
    });

    it('Features = curated primary subset; References = exhaustive (both kinds)', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'CngxToast',
                        file: 'src/ui/feedback/toast/toast.component.ts',
                        category: 'ui/feedback/toast'
                    }
                ],
                interfaces: [
                    {
                        name: 'ToastConfig',
                        file: 'src/ui/feedback/toast/toast.types.ts',
                        category: 'ui/feedback/toast'
                    }
                ]
            })
        );
        expect(DependenciesEngine.categorizedByFeature['ui/feedback/toast']).toHaveLength(2);
        // Features stays the curated organisms-only view.
        expect(DependenciesEngine.categorizedByFeaturePrimary['ui/feedback/toast']).toHaveLength(1);
        expect(DependenciesEngine.categorizedByFeaturePrimary['ui/feedback/toast'][0].name).toBe(
            'CngxToast'
        );
        // References is exhaustive — includes the component AND the type.
        const refs = DependenciesEngine.categorizedByFeatureReference['ui/feedback/toast'];
        expect(refs.map(i => i.name).sort()).toEqual(['CngxToast', 'ToastConfig']);
    });

    it('scope "primary" drops a bucket with no primary-kind item (References still shows it)', () => {
        Configuration.mainData.featureLibraryScope = 'primary';
        DependenciesEngine.init(
            makeParsed({
                interfaces: [
                    {
                        name: 'ToastConfig',
                        file: 'src/toast/toast.types.ts',
                        category: 'toast'
                    }
                ]
            })
        );
        expect(DependenciesEngine.categorizedByFeaturePrimary).toEqual({});
        expect(DependenciesEngine.categorizedByFeatureReference['toast']).toHaveLength(1);
    });

    it('scope "auto" (default) surfaces a reference-only library as a Features node', () => {
        // Modern Angular: an adapter lib exporting only a function + interface
        // + type alias must appear as a first-class library, not vanish.
        DependenciesEngine.init(
            makeParsed({
                interfaces: [
                    {
                        name: 'CngxQueryLike',
                        file: 'src/interop/query/from-query.ts',
                        category: 'interop'
                    }
                ],
                miscellaneous: {
                    variables: [],
                    enumerations: [],
                    groupedVariables: [],
                    groupedFunctions: [],
                    groupedEnumerations: [],
                    groupedTypeAliases: [],
                    functions: [
                        {
                            name: 'fromQuery',
                            file: 'src/interop/query/from-query.ts',
                            category: 'interop'
                        }
                    ],
                    typealiases: [
                        {
                            name: 'CngxAsyncStateProps',
                            file: 'src/interop/signals/with-cngx-async-state.ts',
                            category: 'interop'
                        }
                    ]
                }
            })
        );
        const primary = DependenciesEngine.categorizedByFeaturePrimary['interop'] ?? [];
        expect(primary.map(i => i.name).sort()).toEqual([
            'CngxAsyncStateProps',
            'CngxQueryLike',
            'fromQuery'
        ]);
        expect(DependenciesEngine.categorizedByFeatureReference['interop']).toHaveLength(3);
    });

    it('scope "auto" keeps a class-like bucket curated (reference kinds stay off the node)', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    { name: 'CngxToast', file: 'src/toast/toast.component.ts', category: 'toast' }
                ],
                interfaces: [
                    { name: 'ToastConfig', file: 'src/toast/toast.types.ts', category: 'toast' }
                ]
            })
        );
        // Has a primary item ⇒ no fallback; the interface stays References-only.
        expect(DependenciesEngine.categorizedByFeaturePrimary['toast'].map(i => i.name)).toEqual([
            'CngxToast'
        ]);
        expect(DependenciesEngine.categorizedByFeatureReference['toast']).toHaveLength(2);
    });

    it('scope "all" lists the complete surface of every bucket under Features', () => {
        Configuration.mainData.featureLibraryScope = 'all';
        DependenciesEngine.init(
            makeParsed({
                components: [
                    { name: 'CngxToast', file: 'src/toast/toast.component.ts', category: 'toast' }
                ],
                interfaces: [
                    { name: 'ToastConfig', file: 'src/toast/toast.types.ts', category: 'toast' }
                ]
            })
        );
        expect(
            DependenciesEngine.categorizedByFeaturePrimary['toast'].map(i => i.name).sort()
        ).toEqual(['CngxToast', 'ToastConfig']);
    });

    it('a primary-only bucket surfaces in BOTH chapters (References is exhaustive)', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'CngxToast',
                        file: 'src/toast/toast.component.ts',
                        category: 'toast'
                    }
                ]
            })
        );
        // Same component shows up in Features AND References — the index
        // pattern means every primary entity is a reference entry too.
        expect(DependenciesEngine.categorizedByFeaturePrimary['toast']).toHaveLength(1);
        expect(DependenciesEngine.categorizedByFeaturePrimary['toast'][0].name).toBe('CngxToast');
        expect(DependenciesEngine.categorizedByFeatureReference['toast']).toHaveLength(1);
        expect(DependenciesEngine.categorizedByFeatureReference['toast'][0].name).toBe('CngxToast');
    });

    it('promotes a reference-kind function with docsKind: primary into Features; References lists everything', () => {
        DependenciesEngine.init(
            makeParsed({
                miscellaneous: {
                    variables: [],
                    typealiases: [],
                    enumerations: [],
                    functions: [
                        {
                            name: 'provideFeedback',
                            file: 'src/feedback/providers.ts',
                            category: 'ui/feedback',
                            docsKind: 'primary'
                        },
                        {
                            name: 'clamp01',
                            file: 'src/feedback/util.ts',
                            category: 'ui/feedback'
                        }
                    ],
                    groupedVariables: [],
                    groupedFunctions: [],
                    groupedEnumerations: [],
                    groupedTypeAliases: []
                }
            })
        );
        const primary = DependenciesEngine.categorizedByFeaturePrimary['ui/feedback'] ?? [];
        const reference = DependenciesEngine.categorizedByFeatureReference['ui/feedback'] ?? [];
        // Features: only the @docsKind-promoted symbol.
        expect(primary.map(i => i.name)).toEqual(['provideFeedback']);
        // References: every public symbol in the bucket, sorted by source order.
        expect(reference.map(i => i.name).sort()).toEqual(['clamp01', 'provideFeedback']);
    });

    it('keeps `categorizedByFeature` intact alongside the bifurcated dicts (LLM-export contract)', () => {
        DependenciesEngine.init(
            makeParsed({
                components: [
                    {
                        name: 'CngxToast',
                        file: 'src/toast/toast.component.ts',
                        category: 'toast'
                    }
                ],
                interfaces: [
                    {
                        name: 'ToastConfig',
                        file: 'src/toast/toast.types.ts',
                        category: 'toast'
                    }
                ]
            })
        );
        expect(DependenciesEngine.categorizedByFeature['toast']).toHaveLength(2);
        expect(DependenciesEngine.categorizedByFeature['toast'].map(i => i.name).sort()).toEqual([
            'CngxToast',
            'ToastConfig'
        ]);
    });

    it('produces empty Primary/Reference dicts when no feature buckets exist', () => {
        DependenciesEngine.init(makeParsed());
        expect(DependenciesEngine.categorizedByFeaturePrimary).toEqual({});
        expect(DependenciesEngine.categorizedByFeatureReference).toEqual({});
    });
});
