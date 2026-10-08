import { describe, expect, it } from 'vitest';
import type { Placement } from '../../../src/app/di/model';
import { hrefFor, hrefText, pageLocation } from '../../../src/app/links/layout';
import {
    hrefForName,
    hrefForSymbol,
    placeTarget,
    targetOfCoverage,
    targetOfData
} from '../../../src/app/links/resolve';
import type { SymbolId } from '../../../src/app/links/symbol-id';
import { buildSymbolTable } from '../../../src/app/links/symbol-table';
import { clusterPage, hrefTo, pageOf } from '../helpers/pages';

const table = buildSymbolTable(
    {
        components: [{ name: 'TodoItem', file: 'src/todo-item.ts' }],
        classes: [
            { name: 'Todo', file: 'src/a/todo.ts' },
            { name: 'Todo', file: 'src/b/todo.ts', duplicateName: 'Todo-1' } as never
        ],
        miscellaneous: {
            functions: [
                { name: 'provideTodos', file: 'src/todos.ts', category: 'todos' } as never,
                { name: 'formatTodo', file: 'src/format.ts' }
            ]
        }
    },
    { cwd: '/repo' }
);

const id = (value: string) => value as SymbolId;

describe('symbol hrefs', () => {
    it('climbs from the linking page depth', () => {
        const at = (depth: number) =>
            hrefText(hrefForSymbol(table, id('component:src/todo-item.ts#TodoItem'), depth)!);
        expect(at(0)).toBe(`./${pageOf('component', 'TodoItem')}`);
        expect(at(1)).toBe(`../${pageOf('component', 'TodoItem')}`);
        expect(at(2)).toBe(`../../${pageOf('component', 'TodoItem')}`);
    });

    it('links a same-name copy to its own page only when asked', () => {
        const copy = id('class:src/b/todo.ts#Todo');
        expect(hrefForSymbol(table, copy, 1)?.path).toBe(pageOf('class', 'Todo'));
        expect(hrefForSymbol(table, copy, 1, { duplicate: true })?.path).toBe(
            pageOf('class', 'Todo', { duplicate: 'Todo-1' })
        );
    });

    it('links every misc symbol to its own page, tagged or not', () => {
        const tagged = id('function:src/todos.ts#provideTodos');
        expect(hrefForSymbol(table, tagged, 1)).toMatchObject({
            path: pageOf('function', 'provideTodos'),
            anchor: undefined
        });
        const untagged = id('function:src/format.ts#formatTodo');
        expect(hrefForSymbol(table, untagged, 1)?.path).toBe(pageOf('function', 'formatTodo'));
    });

    it('keeps a caller anchor on a page link', () => {
        const href = hrefForSymbol(table, id('component:src/todo-item.ts#TodoItem'), 1, {
            anchor: 'source'
        });
        expect(href?.anchor).toBe('source');
    });

    it('returns nothing for an unknown id or name', () => {
        expect(hrefForSymbol(table, id('class:src/none.ts#None'), 1)).toBeUndefined();
        expect(hrefForName(table, 'None', 'doc-link', 1)).toBeUndefined();
        expect(hrefForName(table, 'Todo', 'doc-link', 1)?.path).toBe(pageOf('class', 'Todo'));
    });

    it('sends misc engine objects and coverage rows to their own page', () => {
        const tagged = {
            name: 'provideTodos',
            ctype: 'miscellaneous',
            subtype: 'function',
            category: 'todos'
        };
        expect(pageLocation(targetOfData(tagged)!).filename).toBe('provideTodos');
        expect(hrefText(hrefFor(targetOfData(tagged)!, 1))).toBe(
            hrefTo('function', 'provideTodos', 1)
        );
        const row = { name: 'provideTodos', filePath: 'src/todos.ts', linksubtype: 'function' };
        expect(hrefText(hrefFor(targetOfCoverage(row, { table })!, 0))).toBe(
            hrefTo('function', 'provideTodos', 0)
        );
        expect(hrefText(hrefFor(targetOfCoverage(row)!, 0))).toBe(
            hrefTo('function', 'provideTodos', 0)
        );
    });
});

describe('links that follow the dependency injection placement', () => {
    const F = 'src/foo.ts';
    const di = {
        clusters: [],
        plainProviders: [],
        tokens: [],
        hidden: [],
        placement: new Map<SymbolId, Placement>([
            [id(`interface:${F}#FooFeature`), { type: 'cluster-owner' }],
            [
                id(`function:${F}#withMode`),
                { type: 'cluster', owner: id(`interface:${F}#FooFeature`) }
            ],
            [id(`function:${F}#provideLimit`), { type: 'provider' }],
            [id(`function:${F}#orphan`), { type: 'hidden' }]
        ])
    };
    const placed = buildSymbolTable(
        {
            interfaces: [{ name: 'FooFeature', file: F }],
            miscellaneous: {
                functions: [
                    { name: 'withMode', file: F },
                    { name: 'provideLimit', file: F },
                    { name: 'orphan', file: F },
                    { name: 'format', file: F }
                ]
            }
        },
        { cwd: '/' }
    );
    const href = (ref: string) => {
        const link = hrefForSymbol(placed, id(ref), 1, {}, di);
        return link && hrefText(link);
    };

    it('links a cluster member to its section on the feature type page', () => {
        expect(href(`function:${F}#withMode`)).toBe(
            `../${clusterPage('FooFeature')}#FooFeature--withMode`
        );
        expect(href(`interface:${F}#FooFeature`)).toBe(`../${clusterPage('FooFeature')}`);
    });

    it('links a provider without a feature type to its provider page', () => {
        expect(href(`function:${F}#provideLimit`)).toBe(hrefTo('provider', 'provideLimit', 1));
        expect(href(`function:${F}#format`)).toBe(hrefTo('function', 'format', 1));
    });

    it('gives a hidden symbol no href', () => {
        expect(href(`function:${F}#orphan`)).toBeUndefined();
    });

    it('moves an engine object target to its placement', () => {
        const context = { symbols: placed, di };
        const target = targetOfData({
            name: 'withMode',
            file: F,
            ctype: 'miscellaneous',
            subtype: 'function'
        });
        expect(placeTarget(target!, { name: 'withMode', file: F }, context)).toEqual({
            target: { type: 'cluster', name: 'FooFeature' },
            anchor: 'FooFeature--withMode'
        });
        const own = { type: 'symbol', kind: 'function', name: 'format' } as const;
        expect(placeTarget(own, { name: 'format', file: F }, context)).toEqual({
            target: own,
            anchor: undefined
        });
        expect(placeTarget(own, { name: 'format', file: F }, { symbols: placed })).toEqual({
            target: own,
            anchor: undefined
        });
    });
});
