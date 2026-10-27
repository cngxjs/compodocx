import { describe, expect, it } from 'vitest';

import { GRAPH_KINDS } from '../../../src/app/graph/format';
import {
    edgeGeometry,
    glyphMarkup,
    HULL_PAD,
    hullPoints,
    islandLabelAnchor,
    kindColor,
    labelOrder
} from '../../../src/client/graph-draw';

describe('graph glyphs', () => {
    it('draws every kind as circles only', () => {
        for (const kind of GRAPH_KINDS) {
            const shapes = [...glyphMarkup(kind, 8).matchAll(/<(\w+)/g)].map(m => m[1]);
            expect(shapes.every(s => s === 'circle' || s === 'path')).toBe(true);
            expect(glyphMarkup(kind, 8)).toContain(kindColor(kind));
        }
    });

    it('tells the kinds apart without colour', () => {
        const shapes = GRAPH_KINDS.map(kind =>
            glyphMarkup(kind, 8).replaceAll(kindColor(kind), 'C')
        );
        expect(new Set(shapes).size).toBe(GRAPH_KINDS.length);
    });

    it('fills components and rings directives', () => {
        expect(glyphMarkup('component', 8)).toBe(
            '<circle r="8" fill="var(--color-cdx-graph-kind-component)"/>'
        );
        expect(glyphMarkup('directive', 8)).toContain(
            'stroke="var(--color-cdx-graph-kind-directive)"'
        );
        expect(glyphMarkup('external', 8)).toContain('stroke-dasharray');
    });

    it('reads one colour token per kind', () => {
        expect(kindColor('provider')).toBe('var(--color-cdx-graph-kind-provider)');
    });
});

describe('edgeGeometry', () => {
    const a = { x: 0, y: 0, r: 5 };
    const b = { x: 100, y: 0, r: 10 };

    it('runs from rim to rim', () => {
        const geo = edgeGeometry(a, b, 1);
        expect(geo.x1).toBeCloseTo(6.5);
        expect(geo.x2).toBeCloseTo(87.5);
        expect(geo.y1).toBe(0);
    });

    it('keeps the direction head the same length on screen', () => {
        expect(edgeGeometry(a, b, 1).x2 - edgeGeometry(a, b, 1).hx).toBeCloseTo(11);
        expect(edgeGeometry(a, b, 2).x2 - edgeGeometry(a, b, 2).hx).toBeCloseTo(5.5);
    });

    it('never starts the head before the edge', () => {
        const close = edgeGeometry(a, { x: 12, y: 0, r: 5 }, 0.1);
        expect(close.hx).toBeGreaterThanOrEqual(close.x1);
        expect(close.x2).toBeGreaterThanOrEqual(close.x1);
    });
});

describe('islands', () => {
    it('samples a ring around each member', () => {
        const points = hullPoints([{ x: 0, y: 0, r: 6 }], 4);
        expect(points).toHaveLength(4);
        expect(points[0][0]).toBeCloseTo(6 + HULL_PAD);
    });

    it('puts the island name above its top member', () => {
        const anchor = islandLabelAnchor([
            { x: 0, y: 0, r: 5 },
            { x: 20, y: 40, r: 5 }
        ]);
        expect(anchor.x).toBe(10);
        expect(anchor.y).toBeLessThan(-5 - HULL_PAD);
    });
});

describe('labelOrder', () => {
    it('labels the most connected nodes first, then by name', () => {
        const order = labelOrder([
            { degree: 1, name: 'b' },
            { degree: 3, name: 'z' },
            { degree: 1, name: 'a' }
        ]);
        expect(order).toEqual([1, 2, 0]);
    });
});
