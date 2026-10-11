import { describe, expect, it } from 'vitest';
import { symbolFolder } from '../../../src/app/links/layout';
import { buildRedirects, rewriteLegacyLinks } from '../../../src/app/links/redirects';
import { buildSymbolTable, placeInFolders } from '../../../src/app/links/symbol-table';

describe('redirect map', () => {
    const placed = placeInFolders(
        buildSymbolTable(
            {
                components: [{ name: 'SelectPanel', file: 'src/select/panel.ts' }],
                miscellaneous: {
                    functions: [
                        {
                            name: 'Unnamed function',
                            file: 'src/a.ts',
                            ctype: 'miscellaneous',
                            subtype: 'function'
                        }
                    ]
                }
            } as never,
            { cwd: '/repo' }
        ),
        entry => (entry.ref.kind === 'component' ? ['forms', 'select'] : ['core'])
    );
    const pages = new Set([
        'forms/select/SelectPanel.html',
        'core/Unnamed-function.html',
        'utilities.html'
    ]);
    const redirects = buildRedirects({
        table: placed,
        features: [['forms', 'select']],
        pages,
        utilities: 'utilities.html'
    });

    it('sends every old symbol page, including unsafe names and anchors, to its current page', () => {
        expect(redirects['components/SelectPanel.html']).toBe('forms/select/SelectPanel.html');
        expect(redirects['functions/Unnamed function.html']).toBe('core/Unnamed-function.html');
        expect(redirects['miscellaneous/functions.html#Unnamed function']).toBe(
            'core/Unnamed-function.html'
        );
    });

    it('sends feature, bucket and collection pages to the feature page and the utilities groups', () => {
        expect(redirects['features/forms/select.html']).toBe('forms/select/index.html');
        expect(redirects['categories/forms/select.html']).toBe('forms/select/index.html');
        expect(redirects['miscellaneous/functions.html']).toBe('utilities.html#functions');
    });

    it('never redirects a current page', () => {
        const flat = buildRedirects({
            table: buildSymbolTable({ components: [{ name: 'A', file: 'a.ts' }] }, { cwd: '/' }),
            features: [],
            pages: new Set([`${symbolFolder('component').join('/')}/A.html`])
        });
        expect(flat).toEqual({});
    });

    it('points hand-written links at old pages to where they moved, keeping their anchor', () => {
        const html =
            '<a href="../components/SelectPanel.html#inputs">x</a><a href="../utilities.html">u</a><a href="https://x.dev/a.html">e</a>';
        expect(
            rewriteLegacyLinks(html, 'additional-documentation/guide.html', 1, redirects, pages)
        ).toBe(
            '<a href="../forms/select/SelectPanel.html#inputs">x</a><a href="../utilities.html">u</a><a href="https://x.dev/a.html">e</a>'
        );
    });

    it('leaves links alone whose path only contains an old folder name further down', () => {
        const html = '<a href="core/tokens/SelectPanel.html">t</a>';
        const map = { 'tokens/SelectPanel.html': 'core/tokens/SelectPanel.html' };
        expect(rewriteLegacyLinks(html, 'index.html', 0, map, new Set())).toBe(html);
    });
});
