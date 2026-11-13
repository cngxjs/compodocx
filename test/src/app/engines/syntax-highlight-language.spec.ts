import { beforeAll, describe, expect, it } from 'vitest';
import {
    highlightCode,
    initHighlighter,
    resolveLanguage
} from '../../../../src/app/engines/syntax-highlight.engine';

/** github-light keyword colour. */
const KEYWORD_COLOUR = 'color:#D73A49';

describe('resolveLanguage', () => {
    it('keeps TypeScript for blocks without a language', () => {
        expect(resolveLanguage(undefined)).toBe('typescript');
        expect(resolveLanguage('none')).toBe('typescript');
    });

    it('maps aliases to the loaded language', () => {
        expect(resolveLanguage('sh')).toBe('bash');
        expect(resolveLanguage('yml')).toBe('yaml');
        expect(resolveLanguage('TS')).toBe('typescript');
    });

    it('falls back to plain text for a language that is not loaded', () => {
        expect(resolveLanguage('cobol')).toBe('text');
    });
});

describe('highlightCode language fallback', () => {
    beforeAll(async () => {
        await initHighlighter();
    });

    it('does not colour an unknown language as TypeScript', () => {
        const html = highlightCode('const a = 1;', { lang: 'cobol' });
        expect(html).not.toContain(KEYWORD_COLOUR);
    });

    it('colours an aliased language', () => {
        expect(highlightCode('const a = 1;', { lang: 'ts' })).toContain(KEYWORD_COLOUR);
    });
});
