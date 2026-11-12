import { describe, expect, it } from 'vitest';
import type { Redirects } from '../../../src/app/links/redirects';
import { missingSiteLinksReport, rewriteSiteLinks } from '../../../src/app/links/site-links';

const SITE = 'https://example.github.io/lib/';

/** Root-relative page paths of the build, as the page writer collects them. */
const PAGES: ReadonlySet<string> = new Set([
    'index.html',
    'overview.html',
    'forms/select/index.html',
    'forms/select/Select.html',
    'main/index.html'
]);

/** Old page paths the build writes a redirect for. */
const REDIRECTS: Redirects = { 'components/Select.html': 'forms/select/Select.html' };

const link = (href: string): string => `<p><a href="${href}">x</a></p>`;

const rewrite = (href: string, depth = 1, siteUrl = SITE) =>
    rewriteSiteLinks(link(href), { siteUrl, depth }, PAGES, REDIRECTS);

describe('rewriteSiteLinks', () => {
    it.each([
        'main',
        'v1.2.0',
        'v1.2.0-rc.1'
    ])('drops the version folder %s and points at the page of this build', label => {
        const result = rewrite(`${SITE}${label}/forms/select/`);
        expect(result.html).toBe(link('../forms/select/index.html'));
        expect(result.missing).toEqual([]);
    });

    it('takes a link without a version folder as it is', () => {
        expect(rewrite(`${SITE}forms/select/Select.html`).html).toBe(
            link('../forms/select/Select.html')
        );
    });

    it('prefers a page that matches the whole path over dropping the first folder', () => {
        expect(rewrite(`${SITE}main/`).html).toBe(link('../main/index.html'));
    });

    it('points the site root at the index page', () => {
        expect(rewrite(SITE).html).toBe(link('../index.html'));
    });

    it('points a version root at the index page', () => {
        expect(rewrite(`${SITE}v1.2.0/`).html).toBe(link('../index.html'));
    });

    it('keeps the anchor and the query', () => {
        expect(rewrite(`${SITE}main/forms/select/Select.html?tab=api#inputs`).html).toBe(
            link('../forms/select/Select.html?tab=api#inputs')
        );
        expect(rewrite(`${SITE}main/forms/select/#usage`).html).toBe(
            link('../forms/select/index.html#usage')
        );
    });

    it('keeps an escaped query escaped', () => {
        expect(rewrite(`${SITE}main/overview.html?a=1&amp;b=2`).html).toBe(
            link('../overview.html?a=1&amp;b=2')
        );
    });

    it('decodes the path before the lookup', () => {
        expect(rewrite(`${SITE}main/forms/%73elect/`).html).toBe(
            link('../forms/select/index.html')
        );
    });

    it('keeps a link to a page the build does not have absolute and lists it', () => {
        const href = `${SITE}main/forms/gone/`;
        const result = rewrite(href);
        expect(result.html).toBe(link(href));
        expect(result.missing).toEqual([href]);
    });

    it('points a link to an old page path at it, for the redirect pass', () => {
        expect(rewrite(`${SITE}v1.2.0/components/Select.html`).html).toBe(
            link('../components/Select.html')
        );
    });

    it('leaves links to other sites alone', () => {
        const other = 'https://example.github.io/lib-other/main/forms/select/';
        const foreign = 'https://other.example/lib/main/forms/select/';
        const result = rewriteSiteLinks(
            `${link(other)}${link(foreign)}${link('./x.html')}`,
            { siteUrl: SITE, depth: 1 },
            PAGES,
            REDIRECTS
        );
        expect(result.html).toBe(`${link(other)}${link(foreign)}${link('./x.html')}`);
        expect(result.missing).toEqual([]);
    });

    it('changes nothing without a site URL', () => {
        const html = link(`${SITE}main/forms/select/`);
        expect(rewriteSiteLinks(html, { siteUrl: '', depth: 1 }, PAGES, REDIRECTS)).toEqual({
            html,
            missing: []
        });
    });

    it('writes the prefix for the page depth', () => {
        expect(rewrite(`${SITE}main/forms/select/`, 0).html).toBe(
            link('./forms/select/index.html')
        );
        expect(rewrite(`${SITE}main/forms/select/`, 3).html).toBe(
            link('../../../forms/select/index.html')
        );
    });

    it('rewrites every site link of a page and keeps the other attributes', () => {
        const html = `<a class="a" href="${SITE}main/overview.html" title="t">o</a> <a href="${SITE}index.html">i</a>`;
        expect(rewriteSiteLinks(html, { siteUrl: SITE, depth: 2 }, PAGES, REDIRECTS).html).toBe(
            '<a class="a" href="../../overview.html" title="t">o</a> <a href="../../index.html">i</a>'
        );
    });
});

describe('missingSiteLinksReport', () => {
    it('is undefined without links', () => {
        expect(missingSiteLinksReport([])).toBeUndefined();
    });

    it('counts one link in the singular', () => {
        expect(missingSiteLinksReport([{ source: 'a.html', target: `${SITE}x/` }])).toEqual({
            summary: 'Site links: 1 link to a page this build does not have (--verbose lists it)',
            details: [`  a.html: ${SITE}x/`]
        });
    });

    it('counts each link once, in the plural, sorted by source, then target', () => {
        expect(
            missingSiteLinksReport([
                { source: 'b.html', target: `${SITE}y/` },
                { source: 'a.html', target: `${SITE}z/` },
                { source: 'a.html', target: `${SITE}x/` },
                { source: 'b.html', target: `${SITE}y/` }
            ])
        ).toEqual({
            summary: 'Site links: 3 links to pages this build does not have (--verbose lists them)',
            details: [`  a.html: ${SITE}x/`, `  a.html: ${SITE}z/`, `  b.html: ${SITE}y/`]
        });
    });
});
