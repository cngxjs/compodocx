import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyModel, type SemanticModel } from '../../../src/app/compiler/semantic/model';
import DependenciesEngine from '../../../src/app/engines/dependencies.engine';
import {
    ambiguousNames,
    buildSymbolTable,
    type EngineData,
    lookupEntry,
    lookupName,
    type SymbolTable
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
            pageOf('injectable', 'SettingsService', { duplicate: 'SettingsService-2' })
        );
        expect(
            table.byId.get(lookupName(table, 'SettingsService', 'entity-index') as never)
                ?.duplicateName
        ).toBe('SettingsService-2');
    });

    it('referenced-by reproduces the reverse index: last registered target wins', () => {
        (data.components[0] as Record<string, unknown>).inputsClass = [
            { name: 'size', type: 'DEFAULT_PAGE_SIZE' }
        ];
        (DependenciesEngine as any).prepareReferencedByIndex();
        const legacy = data.miscellaneous.variables[0] as Record<string, unknown>;
        expect(legacy.referencedBy).toBeDefined();
        expect(pick(table, lookupName(table, 'DEFAULT_PAGE_SIZE', 'referenced-by'))).toBe(
            identity(legacy)
        );
    });

    it('diff narrows by kind and takes the last copy', () => {
        expect(lookupName(table, 'Foo', 'diff', 'class')).toBe('class:src/foo.class.ts#Foo');
        expect(lookupName(table, 'SettingsService', 'diff', 'injectable')).toBe(
            'injectable:src/c/settings.service.ts#SettingsService'
        );
        expect(lookupName(table, 'Foo', 'diff', 'component')).toBeUndefined();
    });

    it('carries duplicate names and overload counts', () => {
        const second = table.byId.get(
            'injectable:src/b/settings.service.ts#SettingsService' as never
        );
        expect(second?.duplicateName).toBe('SettingsService-1');
        const provide = table.byId.get('function:src/user.ts#provideUser' as never);
        expect(provide?.overloads).toBe(1);
        expect(table.byName.get('provideUser')).toHaveLength(2);
    });

    it('numbers same-name misc symbols and tokens in the table, not on the engine objects', () => {
        const data = {
            tokens: [item('LIMIT', 'src/a.ts'), item('LIMIT', 'src/b.ts')],
            miscellaneous: {
                functions: [
                    item('pick', 'src/a.ts'),
                    item('pick', 'src/b.ts'),
                    item('pick', 'src/c.ts')
                ],
                variables: [item('mode', 'src/a.ts')]
            }
        };
        const numbered = buildSymbolTable(data, { cwd: '/repo' });
        const dup = (id: string) => numbered.byId.get(id as never)?.duplicateName;
        expect(dup('function:src/a.ts#pick')).toBeUndefined();
        expect(dup('function:src/b.ts#pick')).toBe('pick-1');
        expect(dup('function:src/c.ts#pick')).toBe('pick-2');
        expect(dup('token:src/b.ts#LIMIT')).toBe('LIMIT-1');
        for (const entry of [...data.tokens, ...data.miscellaneous.functions]) {
            expect(entry).not.toHaveProperty('isDuplicate');
            expect(entry).not.toHaveProperty('duplicateName');
        }
    });

    it('gives overloads of one function one page, no suffix', () => {
        const provide = table.byId.get('function:src/user.ts#provideUser' as never);
        expect(provide?.duplicateName).toBeUndefined();
        expect(lookupEntry(table, 'provideUser', 'doc-link')?.duplicateName).toBeUndefined();
    });

    it('keeps the engine duplicate name for the kinds the engine numbers', () => {
        expect(lookupEntry(table, 'SettingsService', 'diff', 'injectable')?.duplicateName).toBe(
            'SettingsService-2'
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
});
