import { describe, expect, it } from 'vitest';
import {
    folderDepth,
    folderFileNames,
    hrefFor,
    hrefText,
    memberAnchor,
    type PageTarget,
    pageLocation,
    relativePrefix,
    safeFileName
} from '../../../src/app/links/layout';

/**
 * The literal URL contract of the generated docs. The one spec that spells
 * out output paths; every other test builds them through the layout.
 */
describe('page layout contract', () => {
    const symbol = (kind: string, name: string, extra = {}): PageTarget =>
        ({ type: 'symbol', kind, name, file: name, ...extra }) as PageTarget;

    it.each([
        ['component', 'components'],
        ['directive', 'directives'],
        ['injectable', 'injectables'],
        ['pipe', 'pipes'],
        ['class', 'classes'],
        ['interface', 'interfaces'],
        ['guard', 'guards'],
        ['interceptor', 'interceptors'],
        ['entity', 'entities'],
        ['token', 'tokens'],
        ['resolver', 'resolvers'],
        ['provider', 'providers']
    ])('puts a %s page in %s/ at depth 1', (kind, folder) => {
        expect(pageLocation(symbol(kind, 'Foo'))).toEqual({
            path: folder,
            filename: 'Foo',
            depth: 1
        });
    });

    it('puts a cluster page in providers/ under its feature type name', () => {
        const cluster: PageTarget = { type: 'cluster', name: 'FooFeature', file: 'FooFeature' };
        expect(pageLocation(cluster)).toEqual({
            path: 'providers',
            filename: 'FooFeature',
            depth: 1
        });
        expect(hrefText(hrefFor(cluster, 1, 'FooFeature--withMode'))).toBe(
            '../providers/FooFeature.html#FooFeature--withMode'
        );
    });

    it('writes a symbol page under its file name', () => {
        expect(pageLocation(symbol('class', 'Todo', { file: 'Todo-2' }))).toEqual({
            path: 'classes',
            filename: 'Todo-2',
            depth: 1
        });
    });

    it('makes file names safe', () => {
        expect(safeFileName('Unnamed function')).toBe('Unnamed-function');
        expect(safeFileName('a  b$c')).toBe('a-b-c');
        expect(safeFileName('Foo.bar_baz-1')).toBe('Foo.bar_baz-1');
    });

    const names = (...requests: [string, string, string][]) =>
        Object.fromEntries(
            folderFileNames(requests.map(([id, name, kind]) => ({ id, name, kind })))
        );

    it('keeps the bare name for the first symbol by id and numbers same-kind copies', () => {
        expect(
            names(
                ['class:c.ts#Todo', 'Todo', 'class'],
                ['class:a.ts#Todo', 'Todo', 'class'],
                ['class:b.ts#Todo', 'Todo', 'class']
            )
        ).toEqual({
            'class:a.ts#Todo': 'Todo',
            'class:b.ts#Todo': 'Todo-2',
            'class:c.ts#Todo': 'Todo-3'
        });
    });

    it('suffixes the kind when it tells a clash apart, ignoring case', () => {
        expect(
            names(
                ['component:a.ts#Row', 'Row', 'component'],
                ['interface:a.ts#row', 'row', 'interface']
            )
        ).toEqual({ 'component:a.ts#Row': 'Row', 'interface:a.ts#row': 'row-interface' });
    });

    it('reserves index for the feature page', () => {
        expect(names(['function:a.ts#index', 'index', 'function'])).toEqual({
            'function:a.ts#index': 'index-function'
        });
    });

    it('numbers names that clash once made safe', () => {
        expect(
            names(
                ['function:a.ts#Unnamed function', 'Unnamed function', 'function'],
                ['function:b.ts#Unnamed-function', 'Unnamed-function', 'function']
            )
        ).toEqual({
            'function:a.ts#Unnamed function': 'Unnamed-function',
            'function:b.ts#Unnamed-function': 'Unnamed-function-2'
        });
    });

    it.each([
        ['function', 'functions'],
        ['variable', 'variables'],
        ['typealias', 'typealiases'],
        ['enumeration', 'enumerations']
    ])('puts every %s on its own page in %s/ at depth 1', (kind, folder) => {
        expect(pageLocation(symbol(kind, 'item'))).toEqual({
            path: folder,
            filename: 'item',
            depth: 1
        });
        expect(hrefText(hrefFor(symbol(kind, 'item'), 1))).toBe(`../${folder}/item.html`);
        expect(pageLocation(symbol(kind, 'item', { file: 'item-2' })).filename).toBe('item-2');
    });

    it('puts root pages at the output root', () => {
        expect(pageLocation({ type: 'root', page: 'app-config' })).toEqual({
            path: '',
            filename: 'app-config',
            depth: 0
        });
        expect(hrefText(hrefFor({ type: 'root', page: 'index' }, 0))).toBe('./index.html');
    });

    it('places feature pages below features/ by import path segments', () => {
        expect(pageLocation({ type: 'feature', segments: ['forms', 'select'] })).toEqual({
            path: 'features/forms',
            filename: 'select',
            depth: 2
        });
        expect(pageLocation({ type: 'feature', segments: ['admin'] })).toEqual({
            path: 'features',
            filename: 'admin',
            depth: 1
        });
        expect(
            hrefText(hrefFor({ type: 'feature', segments: ['common', 'interactive', 'menu'] }, 1))
        ).toBe('../features/common/interactive/menu.html');
    });

    it('nests additional pages below their folder by slug', () => {
        expect(
            pageLocation({
                type: 'additional',
                folder: 'additional-documentation',
                slugs: ['guide']
            })
        ).toEqual({ path: 'additional-documentation', filename: 'guide', depth: 1 });
        expect(
            pageLocation({
                type: 'additional',
                folder: 'additional-documentation',
                slugs: ['guide', 'setup']
            })
        ).toEqual({ path: 'additional-documentation/guide', filename: 'setup', depth: 2 });
    });

    it('keeps asset paths as given', () => {
        const href = hrefFor({ type: 'asset', path: 'pagefind/pagefind.js' }, 2);
        expect(hrefText(href)).toBe('../../pagefind/pagefind.js');
    });

    it.each<[string, PageTarget]>([
        ['symbol', symbol('component', 'Foo')],
        ['cluster', { type: 'cluster', name: 'Feature' }],
        ['root', { type: 'root', page: 'index' }],
        ['feature', { type: 'feature', segments: ['forms', 'select', 'chips'] }],
        ['additional', { type: 'additional', folder: 'guides', slugs: ['a', 'b', 'c'] }],
        ['asset', { type: 'asset', path: 'js/chunks/x.js' }]
    ])('derives the depth of a %s page from its folder path', (_, target) => {
        const location = pageLocation(target);
        expect(location.depth).toBe(folderDepth(location.path));
    });

    it('counts folder segments as depth', () => {
        expect(folderDepth('')).toBe(0);
        expect(folderDepth('components')).toBe(1);
        expect(folderDepth('forms/select/chips')).toBe(3);
    });

    it.each([
        [0, './', './', ''],
        [1, '../', '../', '../'],
        [2, '../../', '../../', '../../'],
        [5, '../../../../../', '../../../../../', '../../../../../'],
        [6, '../../../../../../', '', '../../../../../../']
    ])('prefixes depth %i as relative %s, description %s, bare %s', (depth, rel, desc, bare) => {
        expect(relativePrefix(depth)).toBe(rel);
        expect(relativePrefix(depth, 'relative')).toBe(rel);
        expect(relativePrefix(depth, 'description')).toBe(desc);
        expect(relativePrefix(depth, 'bare')).toBe(bare);
    });

    it('renders hrefs with prefix, path and anchor', () => {
        const href = hrefFor(symbol('component', 'Foo'), 1, 'inputs');
        expect(hrefText(href)).toBe('../components/Foo.html#inputs');
        expect(hrefText(hrefFor(symbol('component', 'Foo'), 0), 'bare')).toBe(
            'components/Foo.html'
        );
        expect(hrefText(hrefFor(symbol('variable', 'X'), 0), 'bare')).toBe('variables/X.html');
    });

    it('builds member anchors that are valid ids', () => {
        expect(memberAnchor('label')).toBe('label');
        expect(memberAnchor('$implicit')).toBe('$implicit');
        expect(memberAnchor('items$')).toBe('items$');
        expect(memberAnchor('#clicked')).toBe('clicked');
        expect(memberAnchor('Unnamed function')).toBe('Unnamed-function');
        expect(memberAnchor('provideFoo', 'FooFeature')).toBe('FooFeature--provideFoo');
        expect(memberAnchor('style.cursor')).toBe('style.cursor');
        expect(memberAnchor('window:resize')).toBe('window:resize');
        expect(memberAnchor('a b<c>', 'Owner')).toBe('Owner--a-b-c-');
        expect(memberAnchor(undefined)).toBeUndefined();
    });
});
