import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import DependenciesEngine, {
    type EntityKind,
    type EntityWithKind
} from '../../../../src/app/engines/dependencies.engine';
import { KIND_FOLDER } from '../../../../src/app/links/layout';

/**
 * Snapshot of every singleton field prepareFeatureGroups reads from so a spec
 * can swap it in and restore afterwards.
 */
interface EngineSnapshot {
    components: any[];
    directives: any[];
    injectables: any[];
    pipes: any[];
    classes: any[];
    interfaces: any[];
    guards: any[];
    interceptors: any[];
    entities: any[];
    miscellaneous: any;
    categorizedByFeature: Record<string, EntityWithKind[]>;
    groupDepth: number;
}

function captureSnapshot(): EngineSnapshot {
    return {
        components: DependenciesEngine.components,
        directives: DependenciesEngine.directives,
        injectables: DependenciesEngine.injectables,
        pipes: DependenciesEngine.pipes,
        classes: DependenciesEngine.classes,
        interfaces: DependenciesEngine.interfaces,
        guards: DependenciesEngine.guards,
        interceptors: DependenciesEngine.interceptors,
        entities: DependenciesEngine.entities,
        miscellaneous: DependenciesEngine.miscellaneous,
        categorizedByFeature: DependenciesEngine.categorizedByFeature,
        groupDepth: Configuration.mainData.groupDepth
    };
}

function restoreSnapshot(snap: EngineSnapshot): void {
    (DependenciesEngine as any).components = snap.components;
    (DependenciesEngine as any).directives = snap.directives;
    (DependenciesEngine as any).injectables = snap.injectables;
    (DependenciesEngine as any).pipes = snap.pipes;
    (DependenciesEngine as any).classes = snap.classes;
    (DependenciesEngine as any).interfaces = snap.interfaces;
    (DependenciesEngine as any).guards = snap.guards;
    (DependenciesEngine as any).interceptors = snap.interceptors;
    (DependenciesEngine as any).entities = snap.entities;
    (DependenciesEngine as any).miscellaneous = snap.miscellaneous;
    (DependenciesEngine as any).categorizedByFeature = snap.categorizedByFeature;
    Configuration.mainData.groupDepth = snap.groupDepth;
}

function resetEngine(): void {
    (DependenciesEngine as any).components = [];
    (DependenciesEngine as any).directives = [];
    (DependenciesEngine as any).injectables = [];
    (DependenciesEngine as any).pipes = [];
    (DependenciesEngine as any).classes = [];
    (DependenciesEngine as any).interfaces = [];
    (DependenciesEngine as any).guards = [];
    (DependenciesEngine as any).interceptors = [];
    (DependenciesEngine as any).entities = [];
    (DependenciesEngine as any).miscellaneous = {
        variables: [],
        functions: [],
        typealiases: [],
        enumerations: [],
        groupedVariables: [],
        groupedFunctions: [],
        groupedEnumerations: [],
        groupedTypeAliases: []
    };
    (DependenciesEngine as any).categorizedByFeature = {};
    Configuration.mainData.groupDepth = 2;
}

function run(): void {
    (DependenciesEngine as any).prepareFeatureGroups();
}

function findItem(
    groups: Record<string, EntityWithKind[]>,
    bucket: string,
    name: string
): EntityWithKind | undefined {
    return groups[bucket]?.find(item => item.name === name);
}

describe('DependenciesEngine.prepareFeatureGroups — kinds list coverage', () => {
    let snap: EngineSnapshot;

    beforeEach(() => {
        snap = captureSnapshot();
        resetEngine();
    });

    afterEach(() => {
        restoreSnapshot(snap);
    });

    it('walks every entity kind including the miscellaneous sub-collections', () => {
        (DependenciesEngine as any).components = [
            { name: 'ButtonComponent', file: 'src/button/button.component.ts' }
        ];
        (DependenciesEngine as any).directives = [
            { name: 'RippleDirective', file: 'src/button/ripple.directive.ts' }
        ];
        (DependenciesEngine as any).injectables = [
            { name: 'ButtonService', file: 'src/button/button.service.ts' }
        ];
        (DependenciesEngine as any).pipes = [
            { name: 'TimesPipe', file: 'src/button/times.pipe.ts' }
        ];
        (DependenciesEngine as any).classes = [
            { name: 'ButtonModel', file: 'src/button/button.model.ts' }
        ];
        (DependenciesEngine as any).interfaces = [
            { name: 'ButtonConfig', file: 'src/button/button.config.ts' }
        ];
        (DependenciesEngine as any).guards = [
            { name: 'ButtonGuard', file: 'src/button/button.guard.ts' }
        ];
        (DependenciesEngine as any).interceptors = [
            { name: 'ButtonInterceptor', file: 'src/button/button.interceptor.ts' }
        ];
        (DependenciesEngine as any).entities = [
            { name: 'ButtonEntity', file: 'src/button/button.entity.ts' }
        ];
        (DependenciesEngine as any).miscellaneous = {
            functions: [{ name: 'formatLabel', file: 'src/button/util.ts' }],
            variables: [{ name: 'BUTTON_TOKEN', file: 'src/button/tokens.ts' }],
            typealiases: [{ name: 'ButtonVariant', file: 'src/button/types.ts' }],
            enumerations: [{ name: 'ButtonKind', file: 'src/button/types.ts' }]
        };

        run();

        const groups = DependenciesEngine.categorizedByFeature;
        const bucket = groups.button;

        expect(bucket, 'every entity should land in the button bucket').toBeDefined();

        const kindOf = (name: string): EntityKind | undefined =>
            bucket?.find(item => item.name === name)?.kind;

        expect(kindOf('ButtonComponent')).toBe('component');
        expect(kindOf('RippleDirective')).toBe('directive');
        expect(kindOf('ButtonService')).toBe('injectable');
        expect(kindOf('TimesPipe')).toBe('pipe');
        expect(kindOf('ButtonModel')).toBe('class');
        expect(kindOf('ButtonConfig')).toBe('interface');
        expect(kindOf('ButtonGuard')).toBe('guard');
        expect(kindOf('ButtonInterceptor')).toBe('interceptor');
        expect(kindOf('ButtonEntity')).toBe('entity');
        expect(kindOf('formatLabel')).toBe('function');
        expect(kindOf('BUTTON_TOKEN')).toBe('variable');
        expect(kindOf('ButtonVariant')).toBe('typealias');
        expect(kindOf('ButtonKind')).toBe('enumeration');
    });

    it('stamps the miscellaneous href prefixes with their kind folder', () => {
        (DependenciesEngine as any).miscellaneous = {
            functions: [{ name: 'fn', file: 'src/util/util.ts' }],
            variables: [{ name: 'TOKEN', file: 'src/util/util.ts' }],
            typealiases: [{ name: 'Alias', file: 'src/util/util.ts' }],
            enumerations: [{ name: 'Kind', file: 'src/util/util.ts' }]
        };

        run();

        const bucket = DependenciesEngine.categorizedByFeature.util;
        expect(findItem({ util: bucket }, 'util', 'fn')?.hrefPrefix).toBe(KIND_FOLDER.function);
        expect(findItem({ util: bucket }, 'util', 'TOKEN')?.hrefPrefix).toBe(KIND_FOLDER.variable);
        expect(findItem({ util: bucket }, 'util', 'Alias')?.hrefPrefix).toBe(KIND_FOLDER.typealias);
        expect(findItem({ util: bucket }, 'util', 'Kind')?.hrefPrefix).toBe(
            KIND_FOLDER.enumeration
        );
    });

    it('routes miscellaneous items by @category when it overrides the folder path', () => {
        (DependenciesEngine as any).miscellaneous = {
            functions: [
                {
                    name: 'createLogger',
                    file: 'src/internal/wiring/logger.ts',
                    category: 'Diagnostics'
                }
            ],
            variables: [
                {
                    name: 'APP_VERSION',
                    file: 'src/internal/build/version.ts',
                    category: 'Diagnostics'
                }
            ],
            typealiases: [],
            enumerations: []
        };

        run();

        const groups = DependenciesEngine.categorizedByFeature;
        expect(Object.keys(groups)).toContain('Diagnostics');
        expect(groups.Diagnostics.map(i => i.name).sort()).toEqual(['APP_VERSION', 'createLogger']);
        expect(groups['internal/wiring']).toBeUndefined();
        expect(groups['internal/build']).toBeUndefined();
    });

    it('routes interfaces by @category, fixing the bug where every interface used to fall back to folder grouping', () => {
        (DependenciesEngine as any).interfaces = [
            {
                name: 'ThemeTokens',
                file: 'src/anywhere/here/theme.interface.ts',
                category: 'Tokens'
            },
            { name: 'NoCategory', file: 'src/elsewhere/plain.interface.ts' }
        ];

        run();

        const groups = DependenciesEngine.categorizedByFeature;
        expect(findItem(groups, 'Tokens', 'ThemeTokens')).toMatchObject({
            kind: 'interface',
            hrefPrefix: 'interfaces'
        });
        // No-category interfaces still group by folder
        expect(findItem(groups, 'elsewhere', 'NoCategory')?.kind).toBe('interface');
    });

    it('skips items whose file resolves to no folder key and has no @category', () => {
        (DependenciesEngine as any).miscellaneous = {
            functions: [{ name: 'rootFn', file: 'src/root.ts' }],
            variables: [],
            typealiases: [],
            enumerations: []
        };

        run();

        // src/root.ts → after stripping src/ there is no parent folder → skipped
        expect(DependenciesEngine.categorizedByFeature).toEqual({});
    });

    it('tolerates a missing miscellaneous container (defensive optional-chain)', () => {
        (DependenciesEngine as any).interfaces = [
            { name: 'OnlyInterface', file: 'src/widgets/widget.interface.ts' }
        ];
        (DependenciesEngine as any).miscellaneous = undefined;

        expect(() => run()).not.toThrow();
        expect(DependenciesEngine.categorizedByFeature.widgets?.[0].name).toBe('OnlyInterface');
    });
});
