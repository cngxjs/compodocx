import { describe, expect, it } from 'vitest';
import {
    hrefFor,
    hrefText,
    kindOfPath,
    memberAnchor,
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
        ['token', 'tokens'],
        ['resolver', 'resolvers']
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
    ])('puts every %s on its own page in %s/ at depth 1', (kind, folder) => {
        expect(pageLocation(symbol(kind, 'item'))).toEqual({
            path: folder,
            filename: 'item',
            depth: 1
        });
        expect(hrefText(hrefFor(symbol(kind, 'item'), 1))).toBe(`../${folder}/item.html`);
        expect(pageLocation(symbol(kind, 'item', { duplicateName: 'item-1' })).filename).toBe(
            'item-1'
        );
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
        expect(hrefText(hrefFor(symbol('variable', 'X'), 0), 'bare')).toBe('variables/X.html');
    });

    it('maps a path back to the kind of its folder', () => {
        expect(kindOfPath('components/Foo.html')).toBe('component');
        expect(kindOfPath('../classes/Foo.html')).toBe('class');
        expect(kindOfPath('./entities/Foo.html')).toBe('entity');
        expect(kindOfPath('miscellaneous/functions.html')).toBeUndefined();
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
