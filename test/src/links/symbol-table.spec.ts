import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyModel, type SemanticModel } from '../../../src/app/compiler/semantic/model';
import DependenciesEngine from '../../../src/app/engines/dependencies.engine';
import {
    ambiguousNames,
    buildSymbolTable,
    type EngineData,
    entryInFile,
    lookupEntry,
    lookupName,
    policyKinds,
    type SymbolTable,
    withStyleEntries
} from '../../../src/app/links/symbol-table';
import { buildEntityIndex } from '../../../src/utils/entity-index.util';
import { pageOf } from '../helpers/pages';

const item = (name: string, file: string, extra: Record<string, unknown> = {}) => ({
    name,
    file,
    ...extra
});

/** The name collisions the fixtures and a large library show, in one engine. */
const fixture = (): Required<Omit<EngineData, 'miscellaneous'>> & {
    miscellaneous: Record<string, ReturnType<typeof item>[]>;
} => ({
    components: [item('SettingsPanel', 'src/settings/panel.ts')],
    directives: [],
    injectables: [
        item('SettingsService', 'src/a/settings.service.ts'),
        item('SettingsService', 'src/b/settings.service.ts', {
            isDuplicate: true,
            duplicateId: 1,
            duplicateName: 'SettingsService-1'
        }),
        item('SettingsService', 'src/c/settings.service.ts', {
            isDuplicate: true,
            duplicateId: 2,
            duplicateName: 'SettingsService-2'
        })
    ],
    services: [],
    tokens: [item('DEFAULT_PAGE_SIZE', 'src/tokens.ts')],
    pipes: [],
    classes: [item('Page', 'src/page.ts'), item('Foo', 'src/foo.class.ts')],
    interfaces: [item('Foo', 'src/foo.ts'), item('Item', 'src/item.ts')],
    guards: [],
    interceptors: [],
    entities: [],
    miscellaneous: {
        functions: [
            item('foo', 'src/foo.fn.ts'),
            item('provideUser', 'src/user.ts', { category: 'users' }),
            item('provideUser', 'src/user.ts', { category: 'users' }),
            item('fill', 'src/fill.ts', { category: 'defaults' }),
            item('fill', 'src/fill.ts')
        ],
        variables: [item('DEFAULT_PAGE_SIZE', 'src/config.ts')],
        typealiases: [item('Foo', 'src/foo.type.ts')],
        enumerations: []
    }
});

/** Point the legacy engine lookups at the fixture's arrays. */
const loadLegacy = (data: ReturnType<typeof fixture>) => {
    Object.assign(DependenciesEngine, data, {
        miscellaneous: { ...data.miscellaneous, groupedVariables: [] }
    });
};

/** Kind-free identity of an engine object; overloads of one function share it. */
const identity = (data: unknown) => {
    const named = data as { name?: string; file?: string } | undefined;
    return named ? `${named.file}#${named.name}` : undefined;
};

const pick = (table: SymbolTable, id: string | undefined) =>
    identity(id === undefined ? undefined : table.byId.get(id as never)?.data);

describe('style entries', () => {
    const base = buildSymbolTable(
        { components: [{ name: 'tokens', file: 'kit/tokens.ts' }] },
        { cwd: '/' }
    );
    const table = withStyleEntries(base, [
        { file: 'kit/theming/tokens.css' },
        { file: 'themes/material/_bridge.scss' }
    ]);

    it('adds one style entry per file, named after the file, in the fallback folder', () => {
        const entry = table.byId.get('style:kit/theming/tokens.css#tokens' as never);
        expect(entry?.ref).toEqual({
            kind: 'style',
            file: 'kit/theming/tokens.css',
            name: 'tokens'
        });
        expect(entry?.folder).toEqual(['stylesheets']);
        expect(
            table.byId.get('style:themes/material/_bridge.scss#_bridge' as never)?.fileName
        ).toBe('_bridge');
    });

    it('keeps style entries out of every lookup policy', () => {
        for (const policy of ['type-link', 'doc-link', 'entity-index', 'diff'] as const) {
            expect(policyKinds(policy)).not.toContain('style');
            expect(lookupName(table, '_bridge', policy)).toBeUndefined();
        }
        expect(lookupName(table, 'tokens', 'doc-link')).toBe('component:kit/tokens.ts#tokens');
    });
});

describe('symbol table', () => {
    let data: ReturnType<typeof fixture>;
    let table: SymbolTable;
    const saved: Record<string, unknown> = {};

    beforeEach(() => {
        for (const key of Object.keys(fixture())) {
            saved[key] = (DependenciesEngine as any)[key];
        }
        data = fixture();
        loadLegacy(data);
        table = buildSymbolTable(data, { cwd: '/repo' });
    });

    afterEach(() => {
        Object.assign(DependenciesEngine, saved);
    });

    it('type-link reproduces find: kind order, exact over contained, last copy wins', () => {
        for (const name of ['Foo', 'SettingsService', 'DEFAULT_PAGE_SIZE', 'foo', 'provideUser']) {
            expect(pick(table, lookupName(table, name, 'type-link'))).toBe(
                identity(DependenciesEngine.find(name)?.data)
            );
        }
        // Foo is an interface for type links (interfaces precede classes and misc).
        expect(lookupName(table, 'Foo', 'type-link')).toBe('interface:src/foo.ts#Foo');
        expect(lookupName(table, 'SettingsService', 'type-link')).toBe(
            'injectable:src/c/settings.service.ts#SettingsService'
        );
    });

    it('type-link reproduces the contained-name score of find', () => {
        for (const name of ['Page[]', 'Page<Item>', 'SettingsServiceRef', 'Unknown']) {
            expect(pick(table, lookupName(table, name, 'type-link'))).toBe(
                identity(DependenciesEngine.find(name)?.data)
            );
        }
        expect(lookupName(table, 'Page[]', 'type-link')).toBe('class:src/page.ts#Page');
        // Item (interfaces) precedes Page (classes) at the same score.
        expect(lookupName(table, 'Page<Item>', 'type-link')).toBe('interface:src/item.ts#Item');
        // Three contained copies in one kind and no exact one: no match.
        expect(lookupName(table, 'SettingsServiceRef', 'type-link')).toBeUndefined();
    });

    it('type-link and doc-link skip tokens', () => {
        expect(lookupName(table, 'DEFAULT_PAGE_SIZE', 'type-link')).toBe(
            'variable:src/config.ts#DEFAULT_PAGE_SIZE'
        );
        expect(lookupName(table, 'DEFAULT_PAGE_SIZE', 'doc-link')).toBe(
            'variable:src/config.ts#DEFAULT_PAGE_SIZE'
        );
    });

    it('doc-link reproduces findInCompodoc: first match over the merged order', () => {
        for (const name of ['Foo', 'foo', 'SettingsService', 'DEFAULT_PAGE_SIZE', 'Item']) {
            expect(pick(table, lookupName(table, name, 'doc-link'))).toBe(
                identity(DependenciesEngine.findInCompodoc(name) || undefined)
            );
        }
        expect(lookupName(table, 'Foo', 'doc-link')).toBe('interface:src/foo.ts#Foo');
        expect(lookupName(table, 'SettingsService', 'doc-link')).toBe(
            'injectable:src/a/settings.service.ts#SettingsService'
        );
    });

    it('entity-index reproduces buildEntityIndex: last write wins, misc last', () => {
        const index = buildEntityIndex(data as unknown as Record<string, unknown>);
        expect(index.Foo.href).toBe(pageOf('typealias', 'Foo'));
        expect(lookupName(table, 'Foo', 'entity-index')).toBe('typealias:src/foo.type.ts#Foo');
        expect(index.SettingsService.href).toBe(
            pageOf('injectable', 'SettingsService', { file: 'SettingsService-3' })
        );
        expect(
            table.byId.get(lookupName(table, 'SettingsService', 'entity-index') as never)?.fileName
        ).toBe('SettingsService-3');
    });

    it('diff narrows by kind and takes the last copy', () => {
        expect(lookupName(table, 'Foo', 'diff', 'class')).toBe('class:src/foo.class.ts#Foo');
        expect(lookupName(table, 'SettingsService', 'diff', 'injectable')).toBe(
            'injectable:src/c/settings.service.ts#SettingsService'
        );
        expect(lookupName(table, 'Foo', 'diff', 'component')).toBeUndefined();
    });

    it('carries file names and overload counts', () => {
        const second = table.byId.get(
            'injectable:src/b/settings.service.ts#SettingsService' as never
        );
        expect(second?.fileName).toBe('SettingsService-2');
        const provide = table.byId.get('function:src/user.ts#provideUser' as never);
        expect(provide?.overloads).toBe(1);
        expect(table.byName.get('provideUser')).toHaveLength(2);
    });

    it('numbers same-name symbols in the table by id, not on the engine objects', () => {
        const data = {
            tokens: [item('LIMIT', 'src/a.ts'), item('LIMIT', 'src/b.ts')],
            miscellaneous: {
                functions: [
                    item('pick', 'src/c.ts'),
                    item('pick', 'src/a.ts'),
                    item('pick', 'src/b.ts')
                ],
                variables: [item('mode', 'src/a.ts')]
            }
        };
        const numbered = buildSymbolTable(data, { cwd: '/repo' });
        const file = (id: string) => numbered.byId.get(id as never)?.fileName;
        expect(file('function:src/a.ts#pick')).toBe('pick');
        expect(file('function:src/b.ts#pick')).toBe('pick-2');
        expect(file('function:src/c.ts#pick')).toBe('pick-3');
        expect(file('token:src/b.ts#LIMIT')).toBe('LIMIT-2');
        expect(file('variable:src/a.ts#mode')).toBe('mode');
        for (const entry of [...data.tokens, ...data.miscellaneous.functions]) {
            expect(entry).not.toHaveProperty('isDuplicate');
            expect(entry).not.toHaveProperty('duplicateName');
        }
    });

    it('documents a function or constant that is a guard, interceptor or resolver as one', () => {
        const functional = buildSymbolTable(
            {
                guards: [item('authGuard', 'src/auth.ts')],
                miscellaneous: {
                    functions: [
                        item('roleGuard', 'src/role.ts', { functionalKind: 'guard' }),
                        item('format', 'src/format.ts')
                    ],
                    variables: [item('userResolver', 'src/user.ts', { functionalKind: 'resolver' })]
                }
            },
            { cwd: '/repo' }
        );
        expect(functional.byId.has('guard:src/role.ts#roleGuard' as never)).toBe(true);
        expect(functional.byId.has('function:src/role.ts#roleGuard' as never)).toBe(false);
        expect(functional.byId.has('resolver:src/user.ts#userResolver' as never)).toBe(true);
        expect(lookupName(functional, 'userResolver', 'doc-link')).toBe(
            'resolver:src/user.ts#userResolver'
        );
        expect(functional.byId.has('function:src/format.ts#format' as never)).toBe(true);
    });

    it('gives overloads of one function one page, no suffix', () => {
        const provide = table.byId.get('function:src/user.ts#provideUser' as never);
        expect(provide?.fileName).toBe('provideUser');
        expect(lookupEntry(table, 'provideUser', 'doc-link')?.fileName).toBe('provideUser');
    });

    it('names same-name copies of the engine-numbered kinds by the same rule', () => {
        expect(lookupEntry(table, 'SettingsService', 'diff', 'injectable')?.fileName).toBe(
            'SettingsService-3'
        );
    });

    it('sets the entry point from semantic facts and leaves it undefined without them', () => {
        const base = emptyModel();
        const semantic: SemanticModel = {
            ...base,
            facts: new Map([
                [
                    'src/page.ts#Page',
                    {
                        key: { name: 'Page', file: 'src/page.ts' },
                        entryPoint: '@lib/paging',
                        exportedBy: ['@lib/paging'],
                        notExported: false,
                        usedBy: []
                    }
                ]
            ])
        };
        const withFacts = buildSymbolTable(data, { semantic, cwd: '/repo' });
        expect(withFacts.byId.get('class:src/page.ts#Page' as never)?.entryPoint).toBe(
            '@lib/paging'
        );
        expect(table.byId.get('class:src/page.ts#Page' as never)?.entryPoint).toBeUndefined();
    });

    it('keeps the data of the overload each policy picks', () => {
        const index = buildEntityIndex(data as unknown as Record<string, unknown>);
        expect(index.fill.href).toBe(pageOf('function', 'fill'));
        expect(lookupEntry(table, 'fill', 'entity-index')?.data).not.toBe(
            lookupEntry(table, 'fill', 'doc-link')?.data
        );
        expect(lookupEntry(table, 'fill', 'type-link')?.data).toBe(
            DependenciesEngine.find('fill')?.data
        );
    });

    it('lists names that more than one symbol carries', () => {
        expect(ambiguousNames(table)).toEqual(['DEFAULT_PAGE_SIZE', 'Foo', 'SettingsService']);
    });

    it('finds an entry by file written as engine path, absolute, backslash or from another root', () => {
        const own = buildSymbolTable(
            { components: [item('App', 'src/app/app.ts'), item('Other', 'src/other/app.ts')] },
            { cwd: process.cwd() }
        );
        const found = (file: string) => entryInFile(own, 'component', 'App', file)?.id;
        expect(found('src/app/app.ts')).toBe('component:src/app/app.ts#App');
        expect(found(`${process.cwd()}/src/app/app.ts`)).toBe('component:src/app/app.ts#App');
        expect(found('src\\app\\app.ts')).toBe('component:src/app/app.ts#App');
        expect(found('fixtures/demo/src/app/app.ts')).toBe('component:src/app/app.ts#App');
        expect(found('src/elsewhere/app.ts')).toBeUndefined();
    });
});
