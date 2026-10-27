import { describe, expect, it } from 'vitest';

import { degreesOf, type GraphKind, visibleGraph } from '../../../src/app/graph';
import { fitTransform, graphHeight, nonOverlapping } from '../../../src/client/graph-layout';

const graph = {
    nodes: [
        { id: 'A', name: 'A', kind: 'component' as const },
        { id: 'B', name: 'B', kind: 'directive' as const },
        { id: 'external:NgTemplateOutlet', name: 'NgTemplateOutlet', kind: 'external' as const }
    ],
    edges: [
        { source: 'A', target: 'B', kind: 'composes' as const },
        { source: 'A', target: 'external:NgTemplateOutlet', kind: 'imports' as const },
        { source: 'B', target: 'external:NgTemplateOutlet', kind: 'imports' as const },
        { source: 'A', target: 'A', kind: 'imports' as const },
        { source: 'A', target: 'Missing', kind: 'imports' as const }
    ]
};
const kinds = (...list: GraphKind[]) => new Set(list);

describe('visibleGraph', () => {
    it('drops the nodes of hidden kinds and their edges', () => {
        expect(visibleGraph(graph, kinds('component', 'directive'))).toEqual({
            nodes: [graph.nodes[0], graph.nodes[1]],
            edges: [graph.edges[0]]
        });
    });

    it('keeps the nodes of shown kinds, but never self or dangling edges', () => {
        const visible = visibleGraph(graph, kinds('component', 'directive', 'external'));
        expect(visible.nodes).toHaveLength(3);
        expect(visible.edges).toEqual(graph.edges.slice(0, 3));
    });
});

describe('degreesOf', () => {
    it('counts edges in both directions', () => {
        expect(degreesOf(graph.edges.slice(0, 3))).toEqual(
            new Map([
                ['A', 2],
                ['B', 2],
                ['external:NgTemplateOutlet', 2]
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

describe('graphHeight', () => {
    it('grows with the node count between 450 and 700 pixels', () => {
        expect(graphHeight(3)).toBe(450);
        expect(graphHeight(22)).toBe(550);
        expect(graphHeight(400)).toBe(700);
    });
});
