import { marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { leadInParagraph } from '../../../../src/app/engines/markdown-lead-in';

/** marked's default paragraph output for the same inline HTML. */
const markedDefault = (text: string): string => new marked.Renderer().paragraph(text);

describe('leadInParagraph', () => {
    it('gives a bold label ending in a period its own classes', () => {
        expect(leadInParagraph('<strong>Parts.</strong> The header stays fixed.')).toBe(
            '<p class="cdx-leadin"><strong class="cdx-leadin-label">Parts<span class="cdx-leadin-punct">.</span></strong> <span class="cdx-leadin-text">The header stays fixed.</span></p>\n'
        );
    });

    it('accepts a label ending in a colon', () => {
        expect(leadInParagraph('<strong>Note:</strong> read <code>x</code>.')).toBe(
            '<p class="cdx-leadin"><strong class="cdx-leadin-label">Note<span class="cdx-leadin-punct">:</span></strong> <span class="cdx-leadin-text">read <code>x</code>.</span></p>\n'
        );
    });

    it('leaves bold text in the middle of a sentence alone', () => {
        const text = 'Use <strong>this.</strong> carefully.';
        expect(leadInParagraph(text)).toBe(markedDefault(text));
    });

    it('leaves a label over 40 characters alone', () => {
        const text = `<strong>${'x'.repeat(41)}.</strong> Text.`;
        expect(leadInParagraph(text)).toBe(markedDefault(text));
    });

    it('leaves a label with inline code alone', () => {
        const text = '<strong>The <code>x</code> input.</strong> Text.';
        expect(leadInParagraph(text)).toBe(markedDefault(text));
    });

    it('renders a plain paragraph byte-identical to marked', () => {
        const text = 'Just a <em>plain</em> paragraph.\nSecond line.';
        expect(leadInParagraph(text)).toBe(markedDefault(text));
    });
});
