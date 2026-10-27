import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import {
    GraphKindChips,
    GraphKindLegend,
    GraphLegend,
    GraphRelationLegend,
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
