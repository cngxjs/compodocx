import * as d3 from 'd3';
import { describe, expect, it } from 'vitest';

import {
    GRAPH_SCHEMA_VERSION,
    type GraphModel,
    graphFile,
    groupOf,
    type LayoutNode,
    layoutSteps,
    nodeRadius,
    runLayout
} from '../../../../src/app/graph';
import { graphScript } from '../../../../src/app/page-generator/shared-scripts';

const node = (id: string, feature: string, kind = 'component' as const) => ({
    id,
    name: id,
    kind,
    feature
});

// Two features of four symbols each, connected by one edge, plus a token and an external.
const MODEL: GraphModel = {
    nodes: [
        ...['a1', 'a2', 'a3', 'a4'].map(id => node(id, 'fa')),
        ...['b1', 'b2', 'b3', 'b4'].map(id => node(id, 'fb')),
        { id: 't', name: 't', kind: 'token', feature: 'fb' },
        { id: 'external:X', name: 'X', kind: 'external' }
    ],
    edges: [
        { source: 'a1', target: 'a2', kind: 'imports' },
        { source: 'a1', target: 'a3', kind: 'imports' },
        { source: 'a3', target: 'a4', kind: 'composes' },
        { source: 'b1', target: 'b2', kind: 'imports' },
        { source: 'b2', target: 'b3', kind: 'imports' },
        { source: 'b3', target: 'b4', kind: 'imports' },
        { source: 'a1', target: 'b1', kind: 'imports' },
        { source: 'b1', target: 't', kind: 'injects' },
        { source: 'a2', target: 'external:X', kind: 'imports' }
    ],
    features: [
        { id: 'fa', label: 'a' },
        { id: 'fb', label: 'b' }
    ]
};

const centroid = (nodes: readonly { x?: number; y?: number }[]) => ({
    x: nodes.reduce((sum, n) => sum + (n.x ?? 0), 0) / nodes.length,
    y: nodes.reduce((sum, n) => sum + (n.y ?? 0), 0) / nodes.length
});

describe('graph layout', () => {
    it('grows the radius with the edge count, capped', () => {
        expect(nodeRadius(0)).toBe(4.5);
        expect(nodeRadius(4)).toBeGreaterThan(nodeRadius(1));
        expect(nodeRadius(10_000)).toBe(12.5);
    });

    it('groups a node by its feature, externals and the rest apart', () => {
        expect(groupOf({ feature: 'fa', kind: 'component' })).toBe('fa');
        expect(groupOf({ kind: 'external' })).toBe('~external');
        expect(groupOf({ kind: 'pipe' })).toBe('~none');
    });

    it('lays the same input out the same way every time', () => {
        expect(JSON.stringify(graphFile(d3, MODEL))).toBe(JSON.stringify(graphFile(d3, MODEL)));
    });

    it('keeps each feature together and apart from the other', () => {
        const nodes = graphFile(d3, MODEL).nodes;
        const a = nodes.filter(n => n.feature === 'fa');
        const b = nodes.filter(n => n.feature === 'fb' && n.x !== undefined);
        const ca = centroid(a);
        const cb = centroid(b);
        const spread = (list: typeof a, c: { x: number; y: number }) =>
            Math.max(...list.map(n => Math.hypot((n.x ?? 0) - c.x, (n.y ?? 0) - c.y)));
        const between = Math.hypot(ca.x - cb.x, ca.y - cb.y);
        expect(between).toBeGreaterThan(spread(a, ca));
        expect(between).toBeGreaterThan(spread(b, cb));
    });

    it('never lets two symbols overlap', () => {
        const nodes = graphFile(d3, MODEL).nodes.filter(n => n.x !== undefined);
        for (const [i, p] of nodes.entries()) {
            for (const q of nodes.slice(i + 1)) {
                const gap = Math.hypot((p.x ?? 0) - (q.x ?? 0), (p.y ?? 0) - (q.y ?? 0));
                expect(gap).toBeGreaterThan((p.r ?? 0) + (q.r ?? 0));
            }
        }
    });

    it('lays out only the default kinds; tokens and externals keep no position', () => {
        const file = graphFile(d3, MODEL);
        expect(file.schemaVersion).toBe(GRAPH_SCHEMA_VERSION);
        const placed = file.nodes.filter(n => n.x !== undefined).map(n => n.id);
        expect(placed).toEqual(['a1', 'a2', 'a3', 'a4', 'b1', 'b2', 'b3', 'b4']);
        expect(file.nodes.find(n => n.id === 't')).toEqual(MODEL.nodes[8]);
        expect(file.edges).toBe(MODEL.edges);
    });

    it('rounds positions to one decimal', () => {
        for (const n of graphFile(d3, MODEL).nodes.filter(n => n.x !== undefined)) {
            expect(Math.round((n.x ?? 0) * 10) / 10).toBe(n.x);
            expect(Math.round((n.y ?? 0) * 10) / 10).toBe(n.y);
        }
    });

    it('starts from known positions, so a re-layout stays close', () => {
        const first: LayoutNode[] = MODEL.nodes.map(n => ({ id: n.id, group: groupOf(n), r: 6 }));
        runLayout(d3, first, MODEL.edges);
        const again = first.map(n => ({ ...n }));
        runLayout(d3, again, MODEL.edges);
        for (const [i, n] of again.entries()) {
            const moved = Math.hypot(
                (n.x ?? 0) - (first[i].x ?? 0),
                (n.y ?? 0) - (first[i].y ?? 0)
            );
            expect(moved).toBeLessThan(40);
        }
    });

    it('runs in steps, so the client can spread it over frames', () => {
        const nodes: LayoutNode[] = MODEL.nodes.map(n => ({ id: n.id, group: groupOf(n), r: 6 }));
        expect([...layoutSteps(d3, nodes, MODEL.edges)].length).toBeGreaterThan(5);
    });

    it('writes the file as a classic script', () => {
        const script = graphScript({ schemaVersion: 1, nodes: [], edges: [], features: [] });
        expect(script).toBe(
            'window.__CDX_GRAPH__={"schemaVersion":1,"nodes":[],"edges":[],"features":[]};\n'
        );
    });
});
