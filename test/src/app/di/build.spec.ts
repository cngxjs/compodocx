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
