import { describe, expect, it } from 'vitest';
import { buildSymbolTable } from '../../../../src/app/links';
import { themeResolver } from '../../../../src/app/run/styles';
import { buildStyleModel, resolveThemes } from '../../../../src/app/styles';
import { hasTheming, themingFor } from '../../../../src/templates/helpers/theming';
import type { ThemeToken } from '../../../../src/utils/theme-doc-parser';

const card = { name: 'StyCard', file: 'kit/card.ts' };
const highlight = { name: 'StyHighlight', file: 'kit/highlight.ts' };
const symbols = buildSymbolTable({ components: [card], directives: [highlight] }, { cwd: '/' });
const styles = resolveThemes(
    buildStyleModel([
        {
            file: 'kit/theming/sty-highlight.css',
            content:
                '/**\n * Highlight styles.\n * @overview\n * @themes StyHighlight, StyCard\n */\n' +
                '/**\n * Background.\n */\n:root { --sty-hl-bg: yellow; }\n'
        }
    ]),
    themeResolver(symbols)
).model;
const ownToken = { name: '--own', description: 'Own.' } as ThemeToken;

describe('themingFor', () => {
    it('keeps a component without linked files exactly as its engine fields say', () => {
        const theming = themingFor(
            { ...card, themeTokens: [ownToken], themeOverview: 'Own intro.' },
            'component',
            { symbols, styles: undefined }
        );
        expect(theming.tokens).toEqual([ownToken]);
        expect(theming.overview).toBe('Own intro.');
        expect(theming.linked).toEqual([]);
        expect(hasTheming(theming)).toBe(true);
    });

    it('joins linked tokens, sources and the overview under the file name', () => {
        const theming = themingFor(
            { ...card, themeTokens: [ownToken], themeOverview: 'Own intro.' },
            'component',
            { symbols, styles }
        );
        expect(theming.tokens.map(token => token.name)).toEqual(['--own', '--sty-hl-bg']);
        expect(theming.overview).toBe('Own intro.\n\n#### sty-highlight.css\n\nHighlight styles.');
        expect(theming.sources.map(source => source.file)).toEqual([
            'kit/theming/sty-highlight.css'
        ]);
        expect(theming.linked).toEqual([
            { file: 'kit/theming/sty-highlight.css', label: 'sty-highlight.css' }
        ]);
    });

    it('gives a directive the tab of the files that theme it, nothing otherwise', () => {
        expect(hasTheming(themingFor(highlight, 'directive', { symbols, styles }))).toBe(true);
        expect(
            hasTheming(
                themingFor({ name: 'Other', file: 'x.ts' }, 'directive', { symbols, styles })
            )
        ).toBe(false);
    });
});
