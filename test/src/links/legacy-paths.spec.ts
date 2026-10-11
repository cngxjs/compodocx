import { describe, expect, it } from 'vitest';
import {
    legacyCollectionPaths,
    legacyFeaturePaths,
    legacyNames,
    legacyPaths
} from '../../../src/app/links/legacy-paths';
import { buildSymbolTable } from '../../../src/app/links/symbol-table';

/** The old URLs earlier layouts used; literal paths are the point of this spec. */
describe('legacy page paths', () => {
    const table = buildSymbolTable(
        {
            classes: [
                { name: 'Todo', file: 'src/b/todo.ts' },
                { name: 'Todo', file: 'src/a/todo.ts', duplicateName: 'Todo-1' } as never
            ],
            miscellaneous: {
                functions: [
                    { name: 'pick', file: 'src/z.ts', ctype: 'miscellaneous', subtype: 'function' },
                    { name: 'pick', file: 'src/a.ts', ctype: 'miscellaneous', subtype: 'function' },
                    {
                        name: 'authGuard',
                        file: 'src/auth.ts',
                        ctype: 'miscellaneous',
                        subtype: 'function',
                        functionalKind: 'guard'
                    }
                ]
            }
        } as never,
        { cwd: '/repo' }
    );
    const names = legacyNames(table);
    const entry = (id: string) => table.byId.get(id as never)!;

    it('names same-name copies as the kind folders did: engine order for utilities, engine names otherwise', () => {
        expect(names.get('function:src/z.ts#pick' as never)).toBe('pick');
        expect(names.get('function:src/a.ts#pick' as never)).toBe('pick-1');
        expect(names.get('class:src/b/todo.ts#Todo' as never)).toBe('Todo');
        expect(names.get('class:src/a/todo.ts#Todo' as never)).toBe('Todo-1');
    });

    it('lists the kind folder page, the miscellaneous page and the collection anchor of a utility', () => {
        expect(legacyPaths(entry('function:src/a.ts#pick'), 'pick-1', 'own')).toEqual([
            'functions/pick-1.html',
            'miscellaneous/functions/pick-1.html',
            'miscellaneous/functions.html#pick'
        ]);
    });

    it('lists the provider page of a placed provider and both folders of a functional guard', () => {
        expect(legacyPaths(entry('function:src/z.ts#pick'), 'pick', 'provider')).toContain(
            'providers/pick.html'
        );
        expect(legacyPaths(entry('guard:src/auth.ts#authGuard'), 'authGuard', 'own')).toEqual([
            'guards/authGuard.html',
            'functions/authGuard.html',
            'miscellaneous/functions/authGuard.html',
            'miscellaneous/functions.html#authGuard'
        ]);
    });

    it('lists the old feature and bucket pages and the collection pages', () => {
        expect(legacyFeaturePaths(['forms', 'select'])).toEqual([
            'features/forms/select.html',
            'categories/forms/select.html'
        ]);
        expect(legacyFeaturePaths(['admin'])).toEqual([
            'features/admin.html',
            'categories/admin.html'
        ]);
        expect(legacyCollectionPaths().map(c => c.path)).toContain('miscellaneous/functions.html');
    });
});
