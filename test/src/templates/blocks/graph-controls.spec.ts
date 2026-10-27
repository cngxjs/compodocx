import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import {
    GraphKindChips,
    GraphKindLegend,
    GraphLegend,
    GraphRelationLegend,
    GraphRelationList,
    GraphZoomControls
} from '../../../../src/templates/blocks/GraphControls';

beforeAll(() => {
    I18nEngine.init('en-US');
});

describe('GraphZoomControls', () => {
    it('renders the zoom buttons with the prefix', () => {
        const html = GraphZoomControls({ prefix: 'dep-' });
        expect(html).toContain('id="dep-zoom-in"');
        expect(html).toContain('id="dep-reset"');
        expect(html).toContain('id="dep-zoom-out"');
    });
});

describe('GraphKindChips', () => {
    const chipsOf = (html: string) =>
        [...html.matchAll(/data-cdx-kind="(\w+)" aria-pressed="(\w+)"/g)].map(m => [m[1], m[2]]);

    it('renders a chip per kind present, in kind order, with its count', () => {
        const html = GraphKindChips({
            nodes: [
                { kind: 'external' },
                { kind: 'service' },
                { kind: 'component' },
                { kind: 'component' }
            ]
        });
        expect(chipsOf(html)).toEqual([
            ['component', 'true'],
            ['service', 'true'],
            ['external', 'false']
        ]);
        expect(html).toMatch(/Components<\/span><span class="cdx-graph-chip-count"[^>]*>2</);
        expect(html).toContain('External imports');
        expect(html).toMatch(/<legend class="sr-only"[^>]*>Shown kinds<\/legend>/);
    });

    it('starts tokens, providers and externals unpressed', () => {
        const html = GraphKindChips({
            nodes: [{ kind: 'token' }, { kind: 'provider' }, { kind: 'pipe' }]
        });
        expect(chipsOf(html)).toEqual([
            ['pipe', 'true'],
            ['token', 'false'],
            ['provider', 'false']
        ]);
    });

    it('shows each kind with its glyph', () => {
        const html = GraphKindChips({ nodes: [{ kind: 'directive' }] });
        expect(html).toContain('cdx-graph-kind--directive');
        expect(html).toContain('stroke="currentColor"');
    });

    it('renders nothing for an empty graph', () => {
        expect(GraphKindChips({ nodes: [] })).toBe('');
    });
});

describe('GraphRelationLegend', () => {
    it('lists only the relation kinds the graph contains, in a fixed order', () => {
        const html = GraphRelationLegend({
            edges: [{ kind: 'provides' }, { kind: 'imports' }, { kind: 'imports' }]
        });
        expect([...html.matchAll(/data-cdx-edge="(\w+)"/g)].map(m => m[1])).toEqual([
            'imports',
            'provides'
        ]);
        expect(html).toContain('Relations');
        expect(html).toContain('Uses in template');
        expect(html).toContain('Provides');
    });

    it('draws composes as a double line', () => {
        const html = GraphRelationLegend({ edges: [{ kind: 'composes' }] });
        expect(html).toContain('cdx-graph-edge-inner');
        expect(GraphRelationLegend({ edges: [{ kind: 'injects' }] })).not.toContain(
            'cdx-graph-edge-inner'
        );
    });

    it('renders nothing for a graph without edges', () => {
        expect(GraphRelationLegend({ edges: [] })).toBe('');
    });
});

describe('GraphLegend', () => {
    it('renders a dot per item and nothing without items', () => {
        const html = GraphLegend({
            items: [{ colorVar: 'var(--color-cdx-entity-component)', labelKey: 'component' }]
        });
        expect(html).toContain('background: var(--color-cdx-entity-component)');
        expect(html).toContain('Component');
        expect(GraphLegend({ items: [] })).toBe('');
    });
});

describe('GraphKindLegend', () => {
    it('lists the kinds present with their glyphs, in kind order', () => {
        const html = GraphKindLegend({
            nodes: [{ kind: 'external' }, { kind: 'token' }, { kind: 'component' }]
        });
        expect([...html.matchAll(/data-cdx-kind="(\w+)"/g)].map(m => m[1])).toEqual([
            'component',
            'token',
            'external'
        ]);
        expect(html).toContain('cdx-graph-kind--token');
        expect(html).toContain('Tokens');
        expect(GraphKindLegend({ nodes: [] })).toBe('');
    });
});

describe('GraphRelationList', () => {
    const model = {
        nodes: [
            { id: 'a', name: 'A', kind: 'component' as const, feature: 'f' },
            { id: 'b', name: 'B', kind: 'service' as const, feature: 'f' },
            { id: 'c', name: 'C', kind: 'pipe' as const }
        ],
        edges: [
            { source: 'a', target: 'b', kind: 'injects' as const },
            { source: 'a', target: 'c', kind: 'imports' as const },
            { source: 'c', target: 'b', kind: 'injects' as const }
        ],
        features: [{ id: 'f', label: 'feature-f' }]
    };

    it('lists each symbol with its relations, grouped by feature', () => {
        const html = GraphRelationList({ model });
        expect(html).toContain('aria-label="Relations in the dependency graph"');
        expect(html).toMatch(
            /feature-f\s*<ul[^>]*><li[^>]*>A\. Uses in template: C\. Injects: B\.<\/li>/
        );
        expect(html).toMatch(/Without a feature\s*<ul[^>]*><li[^>]*>C\. Injects: B\.<\/li>/);
    });

    it('lists the symbols directly when the graph has no features', () => {
        const html = GraphRelationList({
            model: { ...model, nodes: model.nodes.map(({ feature: _f, ...n }) => n), features: [] }
        });
        expect(html).not.toContain('Without a feature');
        expect(html).toMatch(/<li[^>]*>A\. Uses in template: C\. Injects: B\.<\/li>/);
    });

    it('renders nothing for a graph without relations', () => {
        expect(GraphRelationList({ model: { ...model, edges: [] } })).toBe('');
    });
});
