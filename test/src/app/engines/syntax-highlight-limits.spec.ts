import { beforeAll, describe, expect, it } from 'vitest';
import {
    highlightCode,
    initHighlighter,
    SHIKI_MAX_LINE_LENGTH
} from '../../../../src/app/engines/syntax-highlight.engine';

/** github-light colours: string literal and keyword. */
const STRING_COLOUR = 'color:#032F62';
const KEYWORD_COLOUR = 'color:#D73A49';

/** `x = '<payload>';` with exactly `length` characters. */
const stringLine = (length: number): string => `x = '${'A'.repeat(length - 7)}';`;

const lines = (html: string): string[] => html.split('<span class="line"').slice(1);

describe('highlightCode line limits', () => {
    beforeAll(async () => {
        await initHighlighter();
    });

    it('builds the probe lines with the intended length', () => {
        expect(stringLine(SHIKI_MAX_LINE_LENGTH + 1)).toHaveLength(SHIKI_MAX_LINE_LENGTH + 1);
    });

    it('colours a line up to the limit', () => {
        const html = highlightCode(stringLine(SHIKI_MAX_LINE_LENGTH - 1));
        expect(html).toContain(STRING_COLOUR);
    });

    it('emits a line over the limit without colours', () => {
        const line = stringLine(SHIKI_MAX_LINE_LENGTH + 1);
        const html = highlightCode(line);
        expect(html).not.toContain(STRING_COLOUR);
        expect(html).toContain(`<span class="line"><span>${line}</span></span>`);
    });

    it('gives the same output on every call', () => {
        const code = `${stringLine(SHIKI_MAX_LINE_LENGTH + 1)}\nconst y = 1;`;
        expect(highlightCode(code)).toBe(highlightCode(code));
    });

    it('keeps the normal colours on the line after a skipped line', () => {
        const html = highlightCode(`${stringLine(SHIKI_MAX_LINE_LENGTH + 1)}\nconst y = 1;`);
        const [skipped, next] = lines(html);
        expect(skipped).not.toContain(STRING_COLOUR);
        expect(next).toContain(`${KEYWORD_COLOUR}`);
        expect(next).not.toContain(STRING_COLOUR);
    });

    it('applies the limit in source mode too', () => {
        const html = highlightCode(
            `${stringLine(SHIKI_MAX_LINE_LENGTH + 1)}\nconst y = '${'B'.repeat(10)}';`,
            { mode: 'source' }
        );
        const [skipped, next] = lines(html);
        expect(skipped).toContain('cdx-line-number');
        expect(skipped).not.toContain(STRING_COLOUR);
        expect(next).toContain(STRING_COLOUR);
    });
});
