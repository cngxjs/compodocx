import { describe, expect, it } from 'vitest';
import {
    type MarkdownPages,
    missingMarkdownPageMessage,
    rewriteMarkdownLinks,
    toPosix
} from '../../../src/app/links/markdown-links';

const ROOT = '/repo/docs';

/** Root-relative page paths, as the page writer maps them. */
const PAGES: MarkdownPages = new Map([
    [`${ROOT}/intro.md`, 'additional/intro.html'],
    [`${ROOT}/guides/overview.md`, 'additional/guides.html'],
    [`${ROOT}/guides/signals.md`, 'additional/guides/signals-&-reactivity.html'],
    [`${ROOT}/guides/my file.md`, 'additional/guides/my-file.html'],
    [`${ROOT}/guides/advanced/migration.md`, 'additional/guides/advanced/migration.html'],
    ['/repo/README.md', 'index.html']
]);

const from = (file: string, depth: number) => ({ file: `${ROOT}/${file}`, root: ROOT, depth });

const link = (href: string): string => `<p><a href="${href}">x</a></p>`;

const rewrite = (href: string, file = 'guides/overview.md', depth = 1) =>
    rewriteMarkdownLinks(link(href), from(file, depth), PAGES);

describe('rewriteMarkdownLinks', () => {
    it('points a sibling link at its page', () => {
        expect(rewrite('./signals.md').html).toBe(
            link('../additional/guides/signals-&amp;-reactivity.html')
        );
    });

    it('resolves a link without ./ and into a subfolder', () => {
        expect(rewrite('advanced/migration.md').html).toBe(
            link('../additional/guides/advanced/migration.html')
        );
    });

    it('resolves ../ against the source folder and uses the page depth', () => {
        const result = rewrite('../overview.md', 'guides/advanced/overview.md', 2);
        expect(result.html).toBe(link('../../additional/guides.html'));
        expect(result.missing).toEqual([]);
    });

    it('keeps the anchor', () => {
        expect(rewrite('./signals.md#computed').html).toBe(
            link('../additional/guides/signals-&amp;-reactivity.html#computed')
        );
    });

    it('decodes percent-encoded names', () => {
        expect(rewrite('./my%20file.md').html).toBe(link('../additional/guides/my-file.html'));
    });

    it('resolves a root-absolute link against the root folder', () => {
        expect(rewrite('/intro.md', 'guides/advanced/overview.md', 2).html).toBe(
            link('../../additional/intro.html')
        );
    });

    it('reaches a page outside the root folder', () => {
        expect(rewrite('../README.md', 'intro.md', 1).html).toBe(link('../index.html'));
    });

    it('writes ./ on a page at the root', () => {
        const result = rewriteMarkdownLinks(
            link('./docs/intro.md'),
            { file: '/repo/README.md', root: ROOT, depth: 0 },
            PAGES
        );
        expect(result.html).toBe(link('./additional/intro.html'));
    });

    it('leaves an unknown target as written and reports it', () => {
        const result = rewrite('./missing.md#a');
        expect(result.html).toBe(link('./missing.md#a'));
        expect(result.missing).toEqual([`${ROOT}/guides/missing.md`]);
    });

    it('reports every unknown link once per occurrence', () => {
        const html = `${link('./a.md')}${link('./signals.md')}${link('./a.md')}`;
        expect(rewriteMarkdownLinks(html, from('guides/overview.md', 1), PAGES).missing).toEqual([
            `${ROOT}/guides/a.md`,
            `${ROOT}/guides/a.md`
        ]);
    });

    it('reports a group node, which has no page', () => {
        const pages: MarkdownPages = new Map([[`${ROOT}/guides/signals.md`, 'a/b.html']]);
        const group = rewriteMarkdownLinks(
            link('./guides/overview.md'),
            from('intro.md', 1),
            pages
        );
        expect(group.missing).toEqual([`${ROOT}/guides/overview.md`]);
    });

    it.each([
        'https://example.com/readme.md',
        'mailto:someone@example.com',
        '//cdn.example.com/x.md',
        '#signals',
        './signals.html',
        './folder/',
        ''
    ])('leaves %j untouched', href => {
        const result = rewrite(href);
        expect(result.html).toBe(link(href));
        expect(result.missing).toEqual([]);
    });

    it('keeps the other attributes of the link', () => {
        const html = '<a title="t" href="./signals.md" class="c">x</a>';
        expect(rewriteMarkdownLinks(html, from('guides/overview.md', 1), PAGES).html).toBe(
            '<a title="t" href="../additional/guides/signals-&amp;-reactivity.html" class="c">x</a>'
        );
    });

    it('ignores href attributes outside links', () => {
        const html = '<link href="./signals.md">';
        expect(rewriteMarkdownLinks(html, from('guides/overview.md', 1), PAGES).html).toBe(html);
    });
});

describe('toPosix', () => {
    it('turns backslashes into slashes', () => {
        expect(toPosix('C:\\repo\\docs\\a.md')).toBe('C:/repo/docs/a.md');
    });
});

describe('missingMarkdownPageMessage', () => {
    it('names the page and the target', () => {
        expect(missingMarkdownPageMessage('docs/a.md', 'docs/b.md')).toBe(
            'docs/a.md: link to docs/b.md has no additional page'
        );
    });
});
