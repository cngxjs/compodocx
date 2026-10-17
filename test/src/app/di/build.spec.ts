import { describe, expect, it } from 'vitest';

import {
    type DiFacts,
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey
} from '../../../../src/app/compiler/semantic/model';
import {
    buildDiView,
    foldClusterMembers,
    formatHiddenList,
    isHiddenItem,
    isMovedPage,
    placementOf
} from '../../../../src/app/di';
import {
    buildSymbolTable,
    type EngineData,
    lookupName,
    type SymbolId
} from '../../../../src/app/links';

const F = 'lib/foo.ts';
const T = 'lib/tokens.ts';
const key = (name: string, file = F): SymbolKey => ({ name, file });
const typeKey = (name: string, file = F): SymbolKey => ({ name, file, space: 'type' });
const id = (kind: string, name: string, file = F) => `${kind}:${file}#${name}` as SymbolId;

const facts = (k: SymbolKey, extra: Partial<SymbolFacts> = {}): SymbolFacts => ({
    key: k,
    exportedBy: ['@lib/foo'],
    notExported: false,
    usedBy: [],
    ...extra
});
const di = (extra: Partial<DiFacts>): DiFacts => ({
    providesTokens: [],
    readsTokens: [],
    ...extra
});

const model = (entries: readonly SymbolFacts[]): SemanticModel => ({
    ...emptyModel(),
    facts: new Map(entries.map(f => [factKey(f.key), f]))
});

// sl-shaped: FooFeature with provideFoo + provideFooAt (arrow const), feature withMode,
// plain provideFooLimit, a token, an unexported helper.
const ENGINE: EngineData = {
    interfaces: [{ name: 'FooFeature', file: F }],
    tokens: [
        { name: 'FOO_CONFIG', file: T },
        { name: 'FOO_LIMIT', file: T }
    ],
    miscellaneous: {
        functions: [
            { name: 'provideFoo', file: F },
            { name: 'withMode', file: F },
            { name: 'provideFooLimit', file: F },
            { name: 'orphan', file: F },
            { name: 'helper', file: F }
        ],
        variables: [{ name: 'provideFooAt', file: F }]
    }
};

const FACTS = [
    facts(typeKey('FooFeature')),
    facts(key('FOO_CONFIG', T)),
    facts(key('FOO_LIMIT', T)),
    facts(key('provideFoo'), {
        di: di({
            role: 'provider',
            featureType: typeKey('FooFeature'),
            providesTokens: [key('FOO_CONFIG', T), key('FOO_LIMIT', T)]
        })
    }),
    facts(key('provideFooAt'), {
        di: di({
            role: 'provider',
            featureType: typeKey('FooFeature'),
            providesTokens: [key('FOO_CONFIG', T)]
        })
    }),
    facts(key('withMode'), { di: di({ role: 'feature', featureType: typeKey('FooFeature') }) }),
    facts(key('provideFooLimit'), { di: di({ role: 'provider' }) }),
    facts(key('orphan'), { notExported: true, exportedBy: [], line: 12 }),
    facts(key('helper'))
];

const table = buildSymbolTable(ENGINE, { cwd: '/' });
const view = buildDiView(table, model(FACTS));

describe('dependency injection view', () => {
    it('groups providers and feature functions under their feature type', () => {
        expect(view.clusters).toHaveLength(1);
        expect(view.clusters[0].owner).toBe(id('interface', 'FooFeature'));
        expect(view.clusters[0].features).toEqual([id('function', 'withMode')]);
    });

    it('puts provideX and provideXAt in one cluster, arrow consts included', () => {
        expect(view.clusters[0].providers).toEqual([
            id('function', 'provideFoo'),
            id('variable', 'provideFooAt')
        ]);
        expect(placementOf(view, id('variable', 'provideFooAt'))).toEqual({
            type: 'cluster',
            owner: id('interface', 'FooFeature')
        });
    });

    it('gives a provider without a feature type its own provider page', () => {
        expect(view.plainProviders).toEqual([id('function', 'provideFooLimit')]);
        expect(placementOf(view, id('function', 'provideFooLimit'))).toEqual({ type: 'provider' });
    });

    it('places the feature type as the cluster page', () => {
        expect(placementOf(view, id('interface', 'FooFeature'))).toEqual({
            type: 'cluster-owner'
        });
    });

    it('dedupes the tokens the providers of a cluster provide', () => {
        expect(view.clusters[0].tokens).toEqual([
            id('token', 'FOO_CONFIG', T),
            id('token', 'FOO_LIMIT', T)
        ]);
        expect(view.tokens).toEqual(view.clusters[0].tokens);
    });

    it('hides symbols that reach no entry point', () => {
        expect(view.hidden).toEqual([id('function', 'orphan')]);
        expect(placementOf(view, id('function', 'orphan'))).toEqual({ type: 'hidden' });
    });

    it('leaves every other symbol on its own page', () => {
        expect(placementOf(view, id('function', 'helper'))).toEqual({ type: 'own' });
        expect(view.placement.has(id('function', 'helper'))).toBe(false);
    });

    it('is empty without the semantic stage', () => {
        const empty = buildDiView(table, undefined);
        expect(empty.clusters).toEqual([]);
        expect(empty.hidden).toEqual([]);
        expect(empty.placement.size).toBe(0);
        expect(placementOf(empty, id('function', 'provideFoo'))).toEqual({ type: 'own' });
    });

    it('lists the hidden symbols in the build log by file and line', () => {
        expect(formatHiddenList(view, table, model(FACTS))).toEqual([
            '1 exported symbols reach no entry point and are not documented:',
            `  ${F}:12 orphan`
        ]);
        expect(formatHiddenList(buildDiView(table, undefined), table)).toEqual([]);
    });

    it('skips hidden symbols in name lookups and page queues', () => {
        const hidden = (id: SymbolId) => placementOf(view, id).type === 'hidden';
        expect(lookupName(table, 'orphan', 'doc-link')).toBe(id('function', 'orphan'));
        expect(lookupName(table, 'orphan', 'doc-link', undefined, hidden)).toBeUndefined();
        expect(isHiddenItem(view, 'function', { name: 'orphan', file: F })).toBe(true);
        expect(isHiddenItem(view, 'function', { name: 'helper', file: F })).toBe(false);
        expect(
            isMovedPage({ context: 'function', function: { name: 'orphan', file: F } }, view)
        ).toBe(true);
        expect(isMovedPage({ context: 'utilities' }, view)).toBe(false);
    });

    it('folds the members of a cluster into one feature-folder entry for the feature type', () => {
        const item = (kind: string, name: string) => ({ kind, name, file: F });
        const folded = foldClusterMembers(
            [
                item('function', 'helper'),
                item('function', 'withMode'),
                item('variable', 'provideFooAt'),
                item('interface', 'FooFeature'),
                item('function', 'provideFooLimit')
            ],
            view,
            table
        );
        expect(folded.map(entry => `${entry.kind}:${entry.name}`)).toEqual([
            'function:helper',
            'interface:FooFeature',
            'function:provideFooLimit'
        ]);
        const unchanged = [item('function', 'withMode')];
        expect(foldClusterMembers(unchanged, undefined, table)).toEqual(unchanged);
    });
});

describe('config accessors', () => {
    const A = 'lib/access.ts';
    const k = (name: string) => key(name, A);
    const fid = (name: string) => id('function', name, A);
    const accessor = (name: string, reads: string[], extra: Partial<SymbolFacts> = {}) =>
        facts(k(name), {
            di: di({ usesInjectionContext: 'direct', readsTokens: reads.map(k), accessor: true }),
            ...extra
        });
    const engine: EngineData = {
        interfaces: [
            { name: 'FooFeature', file: A },
            { name: 'BarFeature', file: A }
        ],
        tokens: ['FOO_CONFIG', 'SHARED', 'LIMIT', 'LONE'].map(name => ({ name, file: A })),
        injectables: [{ name: 'FooService', file: A }],
        miscellaneous: {
            functions: [
                'provideFoo',
                'provideBar',
                'provideLimit',
                'readsConfig',
                'readsPlain',
                'readsLone',
                'readsMixedClass',
                'readsMixedUndocumented',
                'readsShared',
                'hiddenAccessor',
                'notAnAccessor'
            ].map(name => ({ name, file: A })),
            variables: [{ name: 'arrowAccessor', file: A }]
        }
    };
    const accessorFacts = [
        facts({ ...k('FooFeature'), space: 'type' }),
        facts({ ...k('BarFeature'), space: 'type' }),
        ...['FOO_CONFIG', 'SHARED', 'LIMIT', 'LONE', 'FooService'].map(name => facts(k(name))),
        facts(k('provideFoo'), {
            di: di({
                role: 'provider',
                featureType: { ...k('FooFeature'), space: 'type' },
                providesTokens: [k('FOO_CONFIG'), k('SHARED')]
            })
        }),
        facts(k('provideBar'), {
            di: di({
                role: 'provider',
                featureType: { ...k('BarFeature'), space: 'type' },
                providesTokens: [k('SHARED')]
            })
        }),
        facts(k('provideLimit'), { di: di({ role: 'provider', providesTokens: [k('LIMIT')] }) }),
        accessor('readsConfig', ['FOO_CONFIG']),
        accessor('readsPlain', ['LIMIT']),
        accessor('readsLone', ['LONE']),
        accessor('readsMixedClass', ['FOO_CONFIG', 'FooService']),
        accessor('readsMixedUndocumented', ['FOO_CONFIG', 'UNDOCUMENTED']),
        accessor('readsShared', ['SHARED']),
        accessor('hiddenAccessor', ['FOO_CONFIG'], { notExported: true, exportedBy: [] }),
        accessor('arrowAccessor', ['FOO_CONFIG']),
        facts(k('notAnAccessor'), {
            di: di({ usesInjectionContext: 'direct', readsTokens: [k('FOO_CONFIG')] })
        })
    ];
    const accessorTable = buildSymbolTable(engine, { cwd: '/' });
    const accessors = buildDiView(accessorTable, model(accessorFacts)).accessors;
    const foo = id('interface', 'FooFeature', A);
    const bar = id('interface', 'BarFeature', A);

    it('lists a function reading a cluster token with the cluster owner', () => {
        expect(accessors.get(fid('readsConfig'))).toEqual([foo]);
    });

    it('skips a token of a plain provider and a token without a provider', () => {
        expect(accessors.has(fid('readsPlain'))).toBe(false);
        expect(accessors.has(fid('readsLone'))).toBe(false);
    });

    it('skips a function that also reads a documented class', () => {
        expect(accessors.has(fid('readsMixedClass'))).toBe(false);
    });

    it('ignores reads of undocumented tokens', () => {
        expect(accessors.get(fid('readsMixedUndocumented'))).toEqual([foo]);
    });

    it('leaves hidden functions and functions without the accessor shape out', () => {
        expect(accessors.has(fid('hiddenAccessor'))).toBe(false);
        expect(accessors.has(fid('notAnAccessor'))).toBe(false);
    });

    it('lists every cluster that provides the token, sorted by name', () => {
        expect(accessors.get(fid('readsShared'))).toEqual([bar, foo]);
    });

    it('lists an arrow const accessor', () => {
        expect(accessors.get(id('variable', 'arrowAccessor', A))).toEqual([foo]);
    });

    it('is empty without the semantic stage', () => {
        expect(buildDiView(accessorTable).accessors.size).toBe(0);
    });
});
