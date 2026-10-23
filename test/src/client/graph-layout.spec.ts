import { describe, expect, it } from 'vitest';

import {
    degrees,
    fitTransform,
    nonOverlapping,
    visibleGraph
} from '../../../src/client/graph-layout';

const graph = {
    nodes: [
        { name: 'A', type: 'component' },
        { name: 'B', type: 'directive' },
        { name: 'NgTemplateOutlet', type: 'external' }
    ],
    edges: [
        { source: 'A', target: 'B' },
        { source: 'A', target: 'NgTemplateOutlet' },
        { source: 'B', target: 'NgTemplateOutlet' },
        { source: 'A', target: 'A' },
        { source: 'A', target: 'Missing' }
    ]
};

describe('visibleGraph', () => {
    it('drops external nodes and their edges when externals are hidden', () => {
        expect(visibleGraph(graph, false)).toEqual({
            nodes: [graph.nodes[0], graph.nodes[1]],
            edges: [{ source: 'A', target: 'B' }]
        });
    });

    it('keeps external nodes when shown, but never self or dangling edges', () => {
        const visible = visibleGraph(graph, true);
        expect(visible.nodes).toHaveLength(3);
        expect(visible.edges).toEqual(graph.edges.slice(0, 3));
    });
});

describe('degrees', () => {
    it('counts edges in both directions', () => {
        expect(degrees(graph.edges.slice(0, 3))).toEqual(
            new Map([
                ['A', 2],
                ['B', 2],
                ['NgTemplateOutlet', 2]
            ])
        );
    });
});

describe('nonOverlapping', () => {
    const box = (x: number, y = 0) => ({ x, y, width: 10, height: 10 });

    it('keeps boxes in priority order and drops the ones that overlap a kept box', () => {
        const boxes = [box(0), box(5), box(20)];
        expect(nonOverlapping(boxes, [1, 0, 2])).toEqual(new Set([1, 2]));
        expect(nonOverlapping(boxes, [0, 1, 2])).toEqual(new Set([0, 2]));
    });

    it('treats boxes closer than the gap as overlapping', () => {
        expect(nonOverlapping([box(0), box(12)], [0, 1], 3)).toEqual(new Set([0]));
        expect(nonOverlapping([box(0), box(12)], [0, 1], 1)).toEqual(new Set([0, 1]));
    });

    it('drops boxes that overlap an obstacle', () => {
        expect(nonOverlapping([box(0), box(30)], [0, 1], 0, [box(25)])).toEqual(new Set([0]));
    });
});

describe('fitTransform', () => {
    it('centers the bounds and scales them into the padded viewport', () => {
        const t = fitTransform({ x: -100, y: -50, width: 200, height: 100 }, 440, 240, 20, 4);
        expect(t).toEqual({ x: 220, y: 120, k: 2 });
    });

    it('never scales above the maximum', () => {
        const t = fitTransform({ x: 0, y: 0, width: 10, height: 10 }, 800, 600, 0, 1.5);
        expect(t).toEqual({ x: 392.5, y: 292.5, k: 1.5 });
    });
});
