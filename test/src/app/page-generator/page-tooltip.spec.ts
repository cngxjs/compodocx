import { describe, expect, it } from 'vitest';

import { linkTooltip, pageSubtitle } from '../../../../src/app/page-generator/page-tooltip';

const md = (...lines: string[]): string => lines.join('\n');

describe('pageSubtitle', () => {
    it('takes the H2 directly after the H1', () => {
        expect(pageSubtitle(md('# E0100', '', '## Unknown option', '', 'Body.'))).toBe(
            'Unknown option'
        );
    });

    it('accepts a heading of depth 6 after the H1', () => {
        expect(pageSubtitle(md('# Guide', '###### Short form'))).toBe('Short form');
    });

    it('skips a leading @aiGenerated comment', () => {
        expect(pageSubtitle(md('<!-- @aiGenerated -->', '', '# E0100', '## Unknown option'))).toBe(
            'Unknown option'
        );
    });

    it('skips a leading comment with a synonym and a value', () => {
        expect(pageSubtitle(md('<!-- @ai 2026-05 -->', '# E0100', '', '## Unknown option'))).toBe(
            'Unknown option'
        );
        expect(
            pageSubtitle(md('<!-- @aigen model=x -->', '', '', '# E0100', '## Unknown option'))
        ).toBe('Unknown option');
    });

    it('skips leading blank lines', () => {
        expect(pageSubtitle(md('', '', '# E0100', '', '', '## Unknown option'))).toBe(
            'Unknown option'
        );
    });

    it('gives none with a paragraph between the headings', () => {
        expect(pageSubtitle(md('# Guide', '', 'Intro.', '', '## Install'))).toBeUndefined();
    });

    it('gives none when the first heading is not an H1', () => {
        expect(pageSubtitle(md('## Install', '### Steps'))).toBeUndefined();
        expect(pageSubtitle(md('Intro.', '', '# Guide', '## Install'))).toBeUndefined();
    });

    it('gives none for an H1 alone or an H1 followed by an H1', () => {
        expect(pageSubtitle(md('# Guide', '', 'Body.'))).toBeUndefined();
        expect(pageSubtitle('# Guide')).toBeUndefined();
        expect(pageSubtitle(md('# Guide', '# Other'))).toBeUndefined();
    });

    it('gives none for an empty document', () => {
        expect(pageSubtitle('')).toBeUndefined();
        expect(pageSubtitle('\n\n')).toBeUndefined();
    });

    it('reads setext headings', () => {
        expect(pageSubtitle(md('E0100', '=====', '', 'Unknown option', '--------------'))).toBe(
            'Unknown option'
        );
    });

    it('flattens inline code, emphasis and links', () => {
        expect(
            pageSubtitle(md('# E0102', '## Path `a & b` is **very** *odd*, see [docs](x.html)'))
        ).toBe('Path a & b is very odd, see docs');
    });

    it('drops images and inline html', () => {
        expect(pageSubtitle(md('# E0102', '## Value ![icon](i.png) <span>too</span> big'))).toBe(
            'Value too big'
        );
    });

    it('decodes the escapes of marked exactly once', () => {
        expect(pageSubtitle(md('# E0102', '## A & B < C > "q" \'s'))).toBe('A & B < C > "q" \'s');
        expect(pageSubtitle(md('# E0102', '## x \\* y'))).toBe('x * y');
        // An entity the author wrote reads like the rendered page; others stay as written.
        expect(pageSubtitle(md('# E0102', '## &amp; stays'))).toBe('& stays');
        expect(pageSubtitle(md('# E0102', '## &copy; 2026'))).toBe('&copy; 2026');
    });

    it('collapses whitespace', () => {
        expect(pageSubtitle(md('# E0102', '##   Lots   of    space   '))).toBe('Lots of space');
    });

    it('gives none for an empty subtitle heading', () => {
        expect(pageSubtitle(md('# E0102', '##'))).toBeUndefined();
        expect(pageSubtitle(md('# E0102', '## ![only](i.png)'))).toBeUndefined();
    });

    it('takes a section heading directly after the H1 (documented false positive)', () => {
        expect(pageSubtitle(md('# API Reference', '', '## Services'))).toBe('Services');
    });
});

describe('linkTooltip', () => {
    const raw = md('# E0100', '## Unknown option');

    it('gives none when disabled, even with an override', () => {
        expect(
            linkTooltip({ enabled: false, override: 'Custom', raw, label: 'E0100' })
        ).toBeUndefined();
        expect(
            linkTooltip({ enabled: false, override: undefined, raw, label: 'E0100' })
        ).toBeUndefined();
    });

    it('uses the derived subtitle without an override', () => {
        expect(linkTooltip({ enabled: true, override: undefined, raw, label: 'E0100' })).toBe(
            'Unknown option'
        );
    });

    it('lets the override win over the subtitle', () => {
        expect(linkTooltip({ enabled: true, override: 'Custom', raw, label: 'E0100' })).toBe(
            'Custom'
        );
    });

    it('trims the override and collapses its whitespace', () => {
        expect(
            linkTooltip({ enabled: true, override: '  Custom   text ', raw, label: 'E0100' })
        ).toBe('Custom text');
    });

    it('turns the tooltip off with an empty or blank override', () => {
        expect(linkTooltip({ enabled: true, override: '', raw, label: 'E0100' })).toBeUndefined();
        expect(
            linkTooltip({ enabled: true, override: '   ', raw, label: 'E0100' })
        ).toBeUndefined();
    });

    it('drops a derived subtitle contained in the label', () => {
        expect(
            linkTooltip({
                enabled: true,
                override: undefined,
                raw: md('# E0101', '## Value out of range'),
                label: 'E0101: Value out of range'
            })
        ).toBeUndefined();
    });

    it('compares case-insensitively and ignores whitespace runs', () => {
        expect(
            linkTooltip({
                enabled: true,
                override: undefined,
                raw: md('# E0101', '## value   OUT of range'),
                label: 'E0101:  Value out of  range'
            })
        ).toBeUndefined();
    });

    it('drops an override contained in the label', () => {
        expect(
            linkTooltip({ enabled: true, override: 'e0100', raw, label: 'E0100' })
        ).toBeUndefined();
    });

    it('keeps a tooltip that only partly overlaps the label', () => {
        expect(
            linkTooltip({
                enabled: true,
                override: 'Value out of range, really',
                raw,
                label: 'Value out of range'
            })
        ).toBe('Value out of range, really');
    });

    it('gives none without a subtitle and without an override', () => {
        expect(
            linkTooltip({ enabled: true, override: undefined, raw: '# E0105', label: 'E0105' })
        ).toBeUndefined();
    });
});
