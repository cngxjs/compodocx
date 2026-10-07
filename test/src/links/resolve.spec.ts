import { describe, expect, it } from 'vitest';
import { hrefFor, hrefText, pageLocation } from '../../../src/app/links/layout';
import {
    hrefForName,
    hrefForSymbol,
    targetOfCoverage,
    targetOfData
} from '../../../src/app/links/resolve';
import type { SymbolId } from '../../../src/app/links/symbol-id';
import { buildSymbolTable } from '../../../src/app/links/symbol-table';
import { hrefTo, miscAnchor, pageOf } from '../helpers/pages';

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

    it('links a tagged misc symbol to its detail page only when asked', () => {
        const tagged = id('function:src/todos.ts#provideTodos');
        expect(hrefForSymbol(table, tagged, 1)).toMatchObject({
            path: pageOf('function', 'provideTodos'),
            anchor: 'provideTodos'
        });
        expect(hrefForSymbol(table, tagged, 1, { detail: true })).toMatchObject({
            path: pageOf('function', 'provideTodos', { detail: true }),
            anchor: undefined
        });
        const untagged = id('function:src/format.ts#formatTodo');
        expect(hrefForSymbol(table, untagged, 1, { detail: true })?.anchor).toBe('formatTodo');
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

    it('sends tagged misc engine objects and coverage rows to their detail page', () => {
        const tagged = {
            name: 'provideTodos',
            ctype: 'miscellaneous',
            subtype: 'function',
            category: 'todos'
        };
        expect(pageLocation(targetOfData(tagged, { detail: true })!).filename).toBe('provideTodos');
        expect(hrefText(hrefFor(targetOfData(tagged)!, 1))).toBe(
            hrefTo('function', 'provideTodos', 1)
        );
        const row = { name: 'provideTodos', filePath: 'src/todos.ts', linksubtype: 'function' };
        expect(hrefText(hrefFor(targetOfCoverage(row, { detail: true, table })!, 0))).toBe(
            hrefTo('function', 'provideTodos', 0, { detail: true })
        );
        expect(hrefText(hrefFor(targetOfCoverage(row)!, 0))).toBe(
            `./${miscAnchor('function', 'provideTodos')}`
        );
    });
});
