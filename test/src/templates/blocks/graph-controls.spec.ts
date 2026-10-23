import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import {
    dependencyLegendItems,
    GraphLegend,
    GraphZoomControls
} from '../../../../src/templates/blocks/GraphControls';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('dependencyLegendItems', () => {
    it('lists only the node types the graph contains, in legend order', () => {
        const items = dependencyLegendItems([
            { type: 'external' },
            { type: 'component' },
            { type: 'component' },
            { type: 'directive' }
        ]);
        expect(items.map(i => i.labelKey)).toEqual([
            'component',
            'directive',
            'graph-external-imports'
        ]);
    });

    it('shows one injectable entry for injectables and services', () => {
        const items = dependencyLegendItems([{ type: 'service' }, { type: 'injectable' }]);
        expect(items).toEqual([
            { colorVar: 'var(--color-cdx-entity-service)', labelKey: 'injectable' }
        ]);
    });

    it('renders no legend for a graph without known types', () => {
        expect(GraphLegend({ items: dependencyLegendItems([{ type: 'unknown' }]) })).toBe('');
    });
});

describe('GraphZoomControls', () => {
    it('renders the external imports toggle only when there are external nodes', () => {
        expect(GraphZoomControls({ prefix: 'dep-' })).not.toContain('dep-externals');
        const html = GraphZoomControls({ prefix: 'dep-', externalCount: 4 });
        expect(html).toContain('id="dep-externals"');
        expect(html).toContain('aria-pressed="false"');
        expect(html).toMatch(
            /External imports <span class="cdx-graph-toggle-count"[^>]*>4<\/span>/
        );
    });
});
