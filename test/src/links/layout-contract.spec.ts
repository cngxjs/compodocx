import { describe, expect, it } from 'vitest';
import {
    hrefFor,
    hrefText,
    kindOfPath,
    type PageTarget,
    pageLocation,
    relativePrefix
} from '../../../src/app/links/layout';

/**
 * The literal URL contract of the generated docs. The one spec that spells
 * out output paths; every other test builds them through the layout.
 */
describe('page layout contract', () => {
    const symbol = (kind: string, name: string, extra = {}): PageTarget =>
        ({ type: 'symbol', kind, name, ...extra }) as PageTarget;

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
        ['token', 'tokens']
    ])('puts a %s page in %s/ at depth 1', (kind, folder) => {
        expect(pageLocation(symbol(kind, 'Foo'))).toEqual({
            path: folder,
            filename: 'Foo',
            depth: 1
        });
    });

    it('names a same-name copy after its duplicate name', () => {
        expect(pageLocation(symbol('class', 'Todo', { duplicateName: 'Todo-1' }))).toEqual({
            path: 'classes',
            filename: 'Todo-1',
            depth: 1
        });
    });

    it.each([
        ['function', 'functions'],
        ['variable', 'variables'],
        ['typealias', 'typealiases'],
        ['enumeration', 'enumerations']
    ])('links an untagged %s to the %s collection anchor', (kind, collection) => {
        const href = hrefFor(symbol(kind, 'item'), 1);
        expect(hrefText(href)).toBe(`../miscellaneous/${collection}.html#item`);
        expect(pageLocation({ type: 'misc-collection', kind } as PageTarget)).toEqual({
            path: 'miscellaneous',
            filename: collection,
            depth: 1
        });
    });

    it('puts a tagged misc detail page in its collection folder at depth 2', () => {
        const target = symbol('function', 'provideUser', { detail: true });
        expect(pageLocation(target)).toEqual({
            path: 'miscellaneous/functions',
            filename: 'provideUser',
            depth: 2
        });
        expect(hrefText(hrefFor(target, 2))).toBe('../../miscellaneous/functions/provideUser.html');
    });

    it('puts root pages at the output root', () => {
        expect(pageLocation({ type: 'root', page: 'app-config' })).toEqual({
            path: '',
            filename: 'app-config',
            depth: 0
        });
        expect(hrefText(hrefFor({ type: 'root', page: 'index' }, 0))).toBe('./index.html');
    });

    it('nests bucket landing pages below categories/', () => {
        expect(pageLocation({ type: 'bucket', segments: ['ui'] })).toEqual({
            path: 'categories',
            filename: 'ui',
            depth: 1
        });
        expect(pageLocation({ type: 'bucket', segments: ['ui', 'feedback', 'toast'] })).toEqual({
            path: 'categories/ui/feedback',
            filename: 'toast',
            depth: 3
        });
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
        expect(hrefText(hrefFor(symbol('variable', 'X'), 0), 'bare')).toBe(
            'miscellaneous/variables.html#X'
        );
    });

    it('maps a path back to the kind of its folder', () => {
        expect(kindOfPath('components/Foo.html')).toBe('component');
        expect(kindOfPath('../classes/Foo.html')).toBe('class');
        expect(kindOfPath('./entities/Foo.html')).toBe('entity');
        expect(kindOfPath('miscellaneous/functions.html')).toBeUndefined();
    });
});
