import { describe, expect, it } from 'vitest';

import { ContentSlotsSection } from '../../../../src/templates/blocks/ContentSlots';

describe('ContentSlotsSection', () => {
    const html = ContentSlotsSection(
        [{ name: 'default', description: 'Content of the wrapper `div`, which carries the host.' }],
        0
    );

    it('renders one metadata row per slot', () => {
        expect(html).to.match(/class="cdx-metadata-row"[^>]*data-cdx-slot="default"/);
        expect(html).to.match(/class="cdx-metadata-label"[^>]*>default</);
    });

    it('renders the markdown of the description inline', () => {
        expect(html).to.include('<code>div</code>');
        expect(html).to.not.include('`div`');
        expect(html).to.not.include('<p>');
    });

    it('renders nothing without slots', () => {
        expect(ContentSlotsSection([], 0)).toBe('');
        expect(ContentSlotsSection(undefined, 0)).toBe('');
    });
});
