import { describe, expect, it } from 'vitest';
import {
    formatRelativeExampleUrlNotice,
    isAbsoluteUrl,
    relativeExampleUrls,
    resolveExampleUrl
} from '../../../src/utils/example-urls';

describe('resolveExampleUrl', () => {
    it.each([
        ['/#/forms/select', 'https://x.dev/demo', 'https://x.dev/demo/#/forms/select'],
        ['/#/forms/select', 'https://x.dev/demo/', 'https://x.dev/demo/#/forms/select'],
        ['forms/select', 'https://x.dev/demo', 'https://x.dev/demo/forms/select'],
        ['./a.html', 'http://localhost:4200', 'http://localhost:4200/./a.html']
    ])('appends %s to %s', (url, base, expected) => {
        expect(resolveExampleUrl(url, base)).toBe(expected);
    });

    it('keeps absolute URLs', () => {
        expect(resolveExampleUrl('https://a.dev/x', 'https://x.dev')).toBe('https://a.dev/x');
        expect(resolveExampleUrl('//a.dev/x', 'https://x.dev')).toBe('//a.dev/x');
    });

    it('keeps relative URLs without a base', () => {
        expect(resolveExampleUrl('/#/x', '')).toBe('/#/x');
    });
});

describe('isAbsoluteUrl', () => {
    it('knows schemes and protocol-relative URLs', () => {
        expect(isAbsoluteUrl('file:///a.html')).toBe(true);
        expect(isAbsoluteUrl('//host/a')).toBe(true);
        expect(isAbsoluteUrl('/a')).toBe(false);
        expect(isAbsoluteUrl('a/b')).toBe(false);
    });
});

describe('relative example URL notice', () => {
    it('lists the relative URLs of the entries', () => {
        const findings = relativeExampleUrls([
            { name: 'A', exampleUrls: ['/#/a', 'https://x.dev/a'] },
            { name: 'B' }
        ]);
        expect(findings).toEqual([{ name: 'A', url: '/#/a' }]);
        expect(formatRelativeExampleUrlNotice(findings)).toEqual([
            '1 example URL is relative and no exampleUrlBase is set; the Example tab loads them relative to the page',
            '  A: /#/a'
        ]);
    });

    it('shows ten and counts the rest', () => {
        const findings = Array.from({ length: 12 }, (_, i) => ({ name: `E${i}`, url: '/x' }));
        const notice = formatRelativeExampleUrlNotice(findings);
        expect(notice).toHaveLength(12);
        expect(notice.at(-1)).toBe('  ... and 2 more');
    });

    it('is empty without findings', () => {
        expect(formatRelativeExampleUrlNotice([])).toEqual([]);
    });
});
