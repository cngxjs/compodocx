import { describe, expect, it } from 'vitest';
import { parseDisableMarkdownPages } from '../../../src/utils/markdown-pages';

describe('parseDisableMarkdownPages', () => {
    it('keeps the known pages, trimmed, lower-cased and once each', () => {
        expect(parseDisableMarkdownPages(['changelog', ' License', 'changelog'])).toEqual({
            pages: ['changelog', 'license'],
            warnings: []
        });
    });

    it('drops an unknown page with a warning, README included', () => {
        const parsed = parseDisableMarkdownPages(['readme', 'todo']);
        expect(parsed.pages).toEqual(['todo']);
        expect(parsed.warnings).toEqual([
            'disableMarkdownPages: unknown page "readme" ignored (expected changelog, contributing, license, todo)'
        ]);
    });

    it('ignores empty entries from a trailing comma', () => {
        expect(parseDisableMarkdownPages(['license', '']).pages).toEqual(['license']);
    });

    it('drops anything but a list with one warning', () => {
        const parsed = parseDisableMarkdownPages('changelog');
        expect(parsed.pages).toEqual([]);
        expect(parsed.warnings).toHaveLength(1);
    });
});
