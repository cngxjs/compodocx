import { marked } from 'marked';
import { describe, expect, it } from 'vitest';
import { leadInListItem, leadInParagraph } from '../../../../src/app/engines/markdown-lead-in';

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

describe('leadInListItem', () => {
    const markedItem = (text: string, task: boolean): string =>
        new marked.Renderer().listitem(text, task, false);

    it('gives a tight item with a bold label li.cdx-leadin', () => {
        expect(leadInListItem('<strong>Focus.</strong> Moves into the panel.', false)).toBe(
            '<li class="cdx-leadin"><strong class="cdx-leadin-label">Focus<span class="cdx-leadin-punct">.</span></strong> <span class="cdx-leadin-text">Moves into the panel.</span></li>\n'
        );
    });

    it('leaves a task item alone', () => {
        const text = '<input disabled="" type="checkbox"> <strong>Done.</strong> Text';
        expect(leadInListItem(text, true)).toBe(markedItem(text, true));
    });

    it('renders an item without a label byte-identical to marked', () => {
        const text = 'Chrome 125+';
        expect(leadInListItem(text, false)).toBe(markedItem(text, false));
    });
});

describe('lead-in scope', () => {
    const markdown = '__Usage :__\n  value | firstUpper\n\n- **Focus.** Moves in.\n';

    it('applies to markdown page bodies', async () => {
        const { default: engine } = await import('../../../../src/app/engines/markdown.engine');
        const html = engine.render(markdown);
        expect(html).toContain('<p class="cdx-leadin">');
        expect(html).toContain('<li class="cdx-leadin">');
    });

    it('leaves JSDoc and export HTML as marked renders it', async () => {
        await import('../../../../src/app/engines/markdown.engine');
        const { markedAcl } = await import('../../../../src/utils/marked.acl');
        const html = markedAcl(markdown) as string;
        expect(html).toContain('<p><strong>Usage :</strong>\n  value | firstUpper</p>');
        expect(html).toContain('<li><strong>Focus.</strong> Moves in.</li>');
    });
});
