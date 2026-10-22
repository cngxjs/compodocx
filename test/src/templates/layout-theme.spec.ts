import { describe, expect, it } from 'vitest';

import { Layout } from '../../../src/templates/Layout';

const render = (extra: Record<string, unknown>) =>
    Layout({
        data: {
            documentationMainName: 'Docs',
            depth: 0,
            context: 'readme',
            name: 'index',
            ...extra
        },
        content: ''
    });

const RESTORE = "localStorage.getItem('compodocx-theme')";

describe('stored theme restore script', () => {
    it('is emitted with the theme picker for the built-in themes', () => {
        for (const theme of [undefined, 'default', 'gitbook']) {
            const html = render({ theme });
            expect(html).toContain(RESTORE);
            expect(html).toContain('data-cdx-theme-picker');
        }
    });

    it('is not emitted for a locked custom or named theme', () => {
        for (const theme of ['custom', 'ocean']) {
            const html = render({ theme });
            expect(html).not.toContain(RESTORE);
            expect(html).not.toContain('data-cdx-theme-picker');
            expect(html).toContain(`href="./styles/${theme}.css"`);
        }
    });
});

describe('page title', () => {
    it('prefers displayName over name', () => {
        const html = render({
            context: 'additional-page',
            name: 'Short',
            displayName: 'Long page title'
        });
        expect(html).toMatch(/<title[^>]*>Long page title - additional page - Docs<\/title>/);
        expect(html).not.toMatch(/<title[^>]*>Short/);
    });
});

describe('page title escaping', () => {
    const hostile = `A</title><h1>BREAK</h1> & "Q" 'S'`;
    const escaped = 'A&lt;/title>&lt;h1>BREAK&lt;/h1> &amp; &#34;Q&#34; &#39;S&#39;';

    const titleOf = (html: string) => /<title[^>]*>(.*?)<\/title>/s.exec(html)?.[1];

    it('escapes the documentation name', () => {
        const html = render({ documentationMainName: hostile, context: 'readme' });
        expect(titleOf(html)).toBe(`${escaped}`);
        expect(html).not.toContain('</title><h1>');
    });

    it('escapes displayName and name', () => {
        const fromDisplay = render({ context: 'component', displayName: hostile });
        expect(titleOf(fromDisplay)).toBe(`${escaped} - component - Docs`);
        const fromName = render({ context: 'component', name: hostile });
        expect(titleOf(fromName)).toBe(`${escaped} - component - Docs`);
        expect(titleOf(fromName)).not.toContain('</title>');
    });

    it('leaves a plain title unchanged', () => {
        const html = render({ context: 'component', name: 'Button' });
        expect(titleOf(html)).toBe('Button - component - Docs');
    });
});

describe('documentation name in the page chrome', () => {
    it('escapes the topbar and the sidebar brand', () => {
        const html = render({ documentationMainName: 'N<script>x</script> & Co' });
        expect(html).not.toContain('<script>x</script>');
        expect(html.match(/N&lt;script>x&lt;\/script> &amp; Co/g)?.length).toBeGreaterThanOrEqual(
            3
        );
    });
});
