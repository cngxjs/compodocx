import { describe, expect, it } from 'vitest';

import { Layout } from '../../../src/templates/Layout';

const render = (extra: Record<string, unknown>) =>
    Layout({
        data: {
            documentationMainName: 'Acme <UI>',
            depth: 0,
            context: 'readme',
            name: 'index',
            ...extra
        },
        content: ''
    });

const header = (html: string): string =>
    html.match(/<div class="cdx-sidebar-header-row"[^>]*>[\s\S]*?<\/div>/)?.[0] ?? '';

describe('sidebar logo', () => {
    it('shows the project name without a custom logo', () => {
        const row = header(render({}));
        expect(row).toContain('class="cdx-sidebar-brand"');
        expect(row).not.toContain('<img');
    });

    it('shows a wordmark alone, with the project name as alt text', () => {
        const row = header(
            render({ customLogo: 'brand/logo.svg', logoLayoutResolved: 'wordmark' })
        );
        expect(row).toContain('class="cdx-sidebar-logo"');
        expect(row).toMatch(/<img src="\.\/images\/logo\.svg" alt="Acme <UI>"/);
        expect(row).not.toContain('cdx-sidebar-logo-name');
    });

    it('defaults to the wordmark layout when the layout was not resolved', () => {
        const row = header(render({ customLogo: 'brand/logo.svg' }));
        expect(row).toContain('class="cdx-sidebar-logo"');
        expect(row).not.toContain('cdx-sidebar-logo--icon');
    });

    it('shows an icon next to the project name, the image decorative', () => {
        const row = header(render({ customLogo: 'brand/icon.png', logoLayoutResolved: 'icon' }));
        expect(row).toContain('class="cdx-sidebar-logo cdx-sidebar-logo--icon"');
        expect(row).toMatch(/<img src="\.\/images\/icon\.png" alt=""/);
        expect(row).toMatch(/<span class="cdx-sidebar-logo-name"[^>]*>Acme &lt;UI/);
    });

    it('renders both images with a dark variant, in either layout', () => {
        for (const layout of ['wordmark', 'icon']) {
            const row = header(
                render({
                    customLogo: 'brand/logo.svg',
                    customLogoDark: 'brand/logo-dark.svg',
                    logoLayoutResolved: layout
                })
            );
            expect(row).toMatch(
                /<img class="cdx-sidebar-logo-img cdx-sidebar-logo-img--light" src="\.\/images\/logo\.svg"/
            );
            expect(row).toMatch(
                /<img class="cdx-sidebar-logo-img cdx-sidebar-logo-img--dark" src="\.\/images\/logo-dark\.svg"/
            );
        }
    });

    it('renders one plain image without a dark variant', () => {
        const row = header(
            render({ customLogo: 'brand/logo.svg', logoLayoutResolved: 'wordmark' })
        );
        expect(row).not.toContain('cdx-sidebar-logo-img');
        expect(row.match(/<img /g)).toHaveLength(1);
    });
});
