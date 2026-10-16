import { describe, expect, it } from 'vitest';

import { Layout } from '../../../src/templates/Layout';

const render = (extra: Record<string, unknown>) =>
    Layout({
        data: {
            documentationMainName: 'Docs',
            depth: 0,
            context: 'readme',
            name: 'index',
            ...extra
        },
        content: ''
    });

const RESTORE = "localStorage.getItem('compodocx-theme')";

describe('stored theme restore script', () => {
    it('is emitted with the theme picker for the built-in themes', () => {
        for (const theme of [undefined, 'default', 'gitbook']) {
            const html = render({ theme });
            expect(html).toContain(RESTORE);
            expect(html).toContain('data-cdx-theme-picker');
        }
    });

    it('is not emitted for a locked custom or named theme', () => {
        for (const theme of ['custom', 'ocean']) {
            const html = render({ theme });
            expect(html).not.toContain(RESTORE);
            expect(html).not.toContain('data-cdx-theme-picker');
            expect(html).toContain(`href="./styles/${theme}.css"`);
        }
    });
});
