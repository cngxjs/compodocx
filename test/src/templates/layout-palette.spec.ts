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
        content: '',
        menuHtml: ''
    });

describe('command palette axes attribute', () => {
    it('lists the declared axes with their labels', () => {
        const html = render({
            classificationAxes: { level: { label: 'Level' }, tier: { label: 'Tier "x"' } }
        });
        const raw = /data-cdx-axes="([^"]*)"/.exec(html)?.[1] ?? '';
        expect(JSON.parse(raw.replaceAll('&#34;', '"').replaceAll('&amp;', '&'))).toEqual([
            { name: 'level', label: 'Level' },
            { name: 'tier', label: 'Tier "x"' }
        ]);
    });

    it('has no attribute without declared axes', () => {
        expect(render({ classificationAxes: {} })).toContain('id="cdx-command-palette"');
        expect(render({ classificationAxes: {} })).not.toContain('data-cdx-axes');
        expect(render({})).not.toContain('data-cdx-axes');
    });

    it('has no palette with search disabled', () => {
        expect(
            render({ disableSearch: true, classificationAxes: { level: { label: 'Level' } } })
        ).not.toContain('cdx-command-palette');
    });
});
