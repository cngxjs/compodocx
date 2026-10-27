import { describe, expect, it } from 'vitest';

import type { FeatureModel } from '../../../../src/app/compiler/semantic/features';
import {
    type DiFacts,
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey
} from '../../../../src/app/compiler/semantic/model';
import { buildDiView } from '../../../../src/app/di';
import { buildGraphModel, type GraphEdge } from '../../../../src/app/graph';
import { buildSymbolTable, type EngineData } from '../../../../src/app/links';

const UI = 'lib/ui.ts';
const CORE = 'lib/core.ts';
const key = (name: string, file = UI): SymbolKey => ({ name, file });
const id = (kind: string, name: string, file = UI) => `${kind}:${file}#${name}`;

const facts = (k: SymbolKey, extra: Partial<SymbolFacts> = {}): SymbolFacts => ({
    key: k,
    exportedBy: ['@lib/ui'],
    notExported: false,
    usedBy: [],
    ...extra
});
const di = (extra: Partial<DiFacts>): DiFacts => ({
    providesTokens: [],
    readsTokens: [],
    ...extra
});

const ENGINE: EngineData = {
    components: [
        {
            name: 'CardComponent',
            file: UI,
            imports: [{ name: 'BadgeComponent' }, { name: 'DatePipe' }, { name: 'NgClass' }],
            hostDirectives: [{ name: 'RippleDirective' }]
        } as never,
        { name: 'BadgeComponent', file: UI, imports: [{ name: 'Secret' }] } as never,
        { name: 'Secret', file: UI } as never
    ],
    directives: [
        {
            name: 'RippleDirective',
            file: UI,
            hostDirectives: [{ name: 'FocusDirective' }]
        } as never,
        { name: 'FocusDirective', file: UI } as never
    ],
    pipes: [{ name: 'DatePipe', file: UI }],
    injectables: [{ name: 'ThemeService', file: CORE }],
    tokens: [{ name: 'THEME', file: CORE }],
    interfaces: [{ name: 'Theme', file: CORE }],
    classes: [{ name: 'Helper', file: CORE }],
    miscellaneous: {
        functions: [
            { name: 'provideTheme', file: CORE },
            { name: 'formatDate', file: CORE }
        ],
        variables: [{ name: 'provideThemeAt', file: CORE }]
    }
};

const FACTS = [
    facts(key('CardComponent'), { di: di({ readsTokens: [key('ThemeService', CORE)] }) }),
    facts(key('BadgeComponent'), { di: di({ readsTokens: [key('THEME', CORE)] }) }),
    facts(key('Secret'), { notExported: true, exportedBy: [] }),
    facts(key('RippleDirective')),
    facts(key('FocusDirective')),
    facts(key('DatePipe')),
    facts(key('ThemeService', CORE), { di: di({ readsTokens: [key('THEME', CORE)] }) }),
    facts(key('THEME', CORE)),
    facts(key('provideTheme', CORE), {
        di: di({ role: 'provider', providesTokens: [key('THEME', CORE)] })
    }),
    facts(key('provideThemeAt', CORE), {
        di: di({ role: 'provider', providesTokens: [key('THEME', CORE)] })
    }),
    facts(key('formatDate', CORE))
];

const FEATURES: FeatureModel = {
    features: [
        {
            id: '@lib/ui|',
            key: '',
            label: 'ui',
            root: 'lib',
            detector: 'entry-point',
            entryPoint: '@lib/ui'
        },
        {
            id: '@lib/ui|core',
            key: 'core',
            label: 'core',
            root: 'lib',
            detector: 'tag',
            entryPoint: '@lib/ui'
        },
        { id: '@lib/ui|unused', key: 'unused', label: 'unused', root: 'lib', detector: 'tag' }
    ],
    featureOf: new Map([
        [factKey(key('CardComponent')), '@lib/ui|'],
        [factKey(key('BadgeComponent')), '@lib/ui|'],
        [factKey(key('ThemeService', CORE)), '@lib/ui|core'],
        [factKey(key('THEME', CORE)), '@lib/ui|core']
    ]),
    families: []
};

const semantic: SemanticModel = {
    ...emptyModel(),
    facts: new Map(FACTS.map(f => [factKey(f.key), f])),
    features: FEATURES
};
const table = buildSymbolTable(ENGINE, { cwd: '/', semantic });
const graph = buildGraphModel(table, semantic, buildDiView(table, semantic));

const edgesOf = (kind: GraphEdge['kind']) =>
    graph.edges.filter(e => e.kind === kind).map(e => [e.source, e.target]);
const nodeOf = (nodeId: string) => graph.nodes.find(n => n.id === nodeId);

describe('buildGraphModel', () => {
    it('draws components, directives, pipes, services, tokens and providers', () => {
        expect(nodeOf(id('component', 'CardComponent'))?.kind).toBe('component');
        expect(nodeOf(id('directive', 'RippleDirective'))?.kind).toBe('directive');
        expect(nodeOf(id('pipe', 'DatePipe'))?.kind).toBe('pipe');
        expect(nodeOf(id('injectable', 'ThemeService', CORE))?.kind).toBe('service');
        expect(nodeOf(id('token', 'THEME', CORE))?.kind).toBe('token');
        expect(nodeOf(id('function', 'provideTheme', CORE))?.kind).toBe('provider');
        expect(nodeOf(id('variable', 'provideThemeAt', CORE))?.kind).toBe('provider');
    });

    it('leaves out interfaces, classes and functions without a provider role', () => {
        expect(nodeOf(id('interface', 'Theme', CORE))).toBeUndefined();
        expect(nodeOf(id('class', 'Helper', CORE))).toBeUndefined();
        expect(nodeOf(id('function', 'formatDate', CORE))).toBeUndefined();
    });

    it('drops symbols no entry point exports, and the edges to them', () => {
        expect(nodeOf(id('component', 'Secret'))).toBeUndefined();
        expect(graph.edges.some(e => e.target.includes('Secret'))).toBe(false);
        expect(graph.nodes.some(n => n.name === 'Secret')).toBe(false);
    });

    it('turns template imports into imports edges', () => {
        expect(edgesOf('imports')).toEqual([
            [id('component', 'CardComponent'), id('component', 'BadgeComponent')],
            [id('component', 'CardComponent'), 'external:NgClass'],
            [id('component', 'CardComponent'), id('pipe', 'DatePipe')]
        ]);
    });

    it('turns hostDirectives into composes edges, for components and directives', () => {
        expect(edgesOf('composes')).toEqual([
            [id('component', 'CardComponent'), id('directive', 'RippleDirective')],
            [id('directive', 'RippleDirective'), id('directive', 'FocusDirective')]
        ]);
    });

    it('turns read tokens into injects edges, services included', () => {
        expect(edgesOf('injects')).toEqual([
            [id('component', 'BadgeComponent'), id('token', 'THEME', CORE)],
            [id('component', 'CardComponent'), id('injectable', 'ThemeService', CORE)],
            [id('injectable', 'ThemeService', CORE), id('token', 'THEME', CORE)]
        ]);
    });

    it('turns provided tokens into provides edges', () => {
        expect(edgesOf('provides')).toEqual([
            [id('function', 'provideTheme', CORE), id('token', 'THEME', CORE)],
            [id('variable', 'provideThemeAt', CORE), id('token', 'THEME', CORE)]
        ]);
    });

    it('keeps externals as edge targets only, after the project symbols', () => {
        const external = graph.nodes.filter(n => n.kind === 'external');
        expect(external).toEqual([{ id: 'external:NgClass', name: 'NgClass', kind: 'external' }]);
        expect(graph.nodes.at(-1)?.kind).toBe('external');
        expect(graph.edges.some(e => e.source.startsWith('external:'))).toBe(false);
    });

    it('assigns features and lists only the features a node belongs to', () => {
        expect(nodeOf(id('component', 'CardComponent'))?.feature).toBe('@lib/ui|');
        expect(nodeOf(id('token', 'THEME', CORE))?.feature).toBe('@lib/ui|core');
        expect(nodeOf(id('pipe', 'DatePipe'))?.feature).toBeUndefined();
        expect(graph.features).toEqual([
            { id: '@lib/ui|', label: 'ui', entryPoint: '@lib/ui' },
            { id: '@lib/ui|core', label: 'core', entryPoint: '@lib/ui' }
        ]);
    });

    it('links every project symbol to its page, relative to the site root', () => {
        expect(nodeOf(id('component', 'CardComponent'))?.url).toMatch(
            /^[^./].*CardComponent\.html$/
        );
        expect(nodeOf('external:NgClass')?.url).toBeUndefined();
    });

    it('builds without semantic facts: no DI edges, no providers, no features', () => {
        const plain = buildSymbolTable(ENGINE, { cwd: '/' });
        const model = buildGraphModel(plain, undefined, undefined);
        expect(model.edges.every(e => e.kind === 'imports' || e.kind === 'composes')).toBe(true);
        expect(model.nodes.some(n => n.kind === 'provider')).toBe(false);
        expect(model.features).toEqual([]);
    });

    it('is byte-stable for the same input', () => {
        const again = buildGraphModel(table, semantic, buildDiView(table, semantic));
        expect(JSON.stringify(again)).toBe(JSON.stringify(graph));
    });
});
