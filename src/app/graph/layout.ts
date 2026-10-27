/**
 * Layout of the dependency graph in two stages: features as discs that keep
 * connected features side by side, then each feature's symbols inside its
 * disc. The build runs it once for the default filter state; the client
 * runs it again, from the current positions, when the filters change. It
 * takes the d3 force functions as an argument and imports nothing at
 * runtime, so both share it.
 */

import type { GraphEdge, GraphNode } from './format';

/** The d3-force functions the layout uses (a subset of the `d3` module). */
export type ForceApi = Pick<
    typeof import('d3'),
    'forceSimulation' | 'forceLink' | 'forceManyBody' | 'forceCollide' | 'forceX' | 'forceY'
>;

export interface LayoutNode {
    readonly id: string;
    /** The island a node lives in: its feature, or a shared group without one. */
    readonly group: string;
    readonly r: number;
    x?: number;
    y?: number;
}

interface Disc {
    readonly id: string;
    readonly r: number;
    x?: number;
    y?: number;
}

/** Node radius from its edge count. */
export const nodeRadius = (degree: number): number => 4.5 + Math.min(8, Math.sqrt(degree) * 1.8);

/** Island of a node: its feature, else one group for externals and one for the rest. */
export const groupOf = (node: Pick<GraphNode, 'feature' | 'kind'>): string =>
    node.feature ?? (node.kind === 'external' ? '~external' : '~none');

/** Edge count per node id, both directions. */
export const degreesOf = (
    edges: readonly Pick<GraphEdge, 'source' | 'target'>[]
): Map<string, number> => {
    const count = new Map<string, number>();
    for (const e of edges) {
        count.set(e.source, (count.get(e.source) ?? 0) + 1);
        count.set(e.target, (count.get(e.target) ?? 0) + 1);
    }
    return count;
};

/** Deterministic random source, so a graph lays out the same way every time. */
export const seededRandom = (): (() => number) => {
    let state = 1;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
};

const DISC_TICKS = 400;
const WARM_DISC_TICKS = 200;
const NODE_TICKS = 260;
/** Ticks per step of the generator; one step fits a frame on large projects. */
const TICKS_PER_STEP = 20;

/**
 * Lay `nodes` out in place; `edges` are between node ids. Nodes that already
 * have a position start there (a filter change glides instead of jumping).
 * A generator: each step runs a slice of the ticks, so the client can spread
 * the work over animation frames; `runLayout` runs it to the end.
 */
export function* layoutSteps(
    force: ForceApi,
    nodes: readonly LayoutNode[],
    edges: readonly Pick<GraphEdge, 'source' | 'target'>[]
): Generator<void, void, void> {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const groups = new Map<string, LayoutNode[]>();
    for (const n of nodes) {
        groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
    }
    const warm = nodes.some(n => n.x !== undefined);

    // Stage 1: features as discs, sized by their members, never overlapping.
    const discs: Disc[] = [...groups].map(([id, members]) => {
        const area = members.reduce((sum, n) => sum + (n.r + 8) ** 2, 0);
        const placed = members.filter(n => n.x !== undefined);
        const centre =
            placed.length > 0
                ? {
                      x: placed.reduce((sum, n) => sum + (n.x ?? 0), 0) / placed.length,
                      y: placed.reduce((sum, n) => sum + (n.y ?? 0), 0) / placed.length
                  }
                : {};
        return { id, r: Math.sqrt(area) * 1.35 + 12, ...centre };
    });
    const weights = new Map<string, number>();
    for (const e of edges) {
        const a = byId.get(e.source)?.group;
        const b = byId.get(e.target)?.group;
        if (a === undefined || b === undefined || a === b) {
            continue;
        }
        const key = a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
        weights.set(key, (weights.get(key) ?? 0) + 1);
    }
    const discLinks = [...weights].map(([key, w]) => {
        const [source, target] = key.split('\u0000');
        return { source, target, w };
    });
    const discSim = force
        .forceSimulation<Disc>(discs)
        .randomSource(seededRandom())
        .force(
            'link',
            force
                .forceLink<Disc, { source: string | Disc; target: string | Disc; w: number }>(
                    discLinks
                )
                .id(d => d.id)
                .distance(l => (l.source as Disc).r + (l.target as Disc).r + 24)
                .strength(l => Math.min(0.6, 0.08 * l.w))
        )
        .force(
            'charge',
            force.forceManyBody<Disc>().strength(d => -d.r * 2.2)
        )
        .force(
            'collide',
            force
                .forceCollide<Disc>(d => d.r + 14)
                .strength(1)
                .iterations(4)
        )
        .force('x', force.forceX<Disc>(0).strength(0.05))
        .force('y', force.forceY<Disc>(0).strength(0.05))
        .stop();
    for (let done = 0, total = warm ? WARM_DISC_TICKS : DISC_TICKS; done < total; ) {
        const ticks = Math.min(TICKS_PER_STEP * 4, total - done);
        discSim.tick(ticks);
        done += ticks;
        yield;
    }
    const centre = new Map(discs.map(d => [d.id, { x: d.x ?? 0, y: d.y ?? 0 }]));

    // Stage 2: symbols inside their island; only edges inside a feature shape it.
    const random = seededRandom();
    for (const n of nodes) {
        if (n.x === undefined || n.y === undefined) {
            const c = centre.get(n.group) ?? { x: 0, y: 0 };
            n.x = c.x + (random() - 0.5) * 10;
            n.y = c.y + (random() - 0.5) * 10;
        }
    }
    const inner = edges
        .filter(e => {
            const a = byId.get(e.source);
            const b = byId.get(e.target);
            return a && b && a !== b && a.group === b.group;
        })
        .map(e => ({ source: e.source, target: e.target }));
    const centreOf = (n: LayoutNode) => centre.get(n.group) ?? { x: 0, y: 0 };
    const nodeSim = force
        .forceSimulation<LayoutNode>([...nodes])
        .randomSource(seededRandom())
        .force(
            'link',
            force
                .forceLink<
                    LayoutNode,
                    { source: string | LayoutNode; target: string | LayoutNode }
                >(inner)
                .id(n => n.id)
                .distance(24)
                .strength(0.5)
        )
        .force('charge', force.forceManyBody<LayoutNode>().strength(-16).distanceMax(70))
        .force('collide', force.forceCollide<LayoutNode>(n => n.r + 7).iterations(2))
        .force('fx', force.forceX<LayoutNode>(n => centreOf(n).x).strength(0.22))
        .force('fy', force.forceY<LayoutNode>(n => centreOf(n).y).strength(0.22))
        .stop();
    for (let done = 0; done < NODE_TICKS; ) {
        const ticks = Math.min(TICKS_PER_STEP, NODE_TICKS - done);
        nodeSim.tick(ticks);
        done += ticks;
        yield;
    }
}

/** Run the whole layout at once. */
export const runLayout = (
    force: ForceApi,
    nodes: readonly LayoutNode[],
    edges: readonly Pick<GraphEdge, 'source' | 'target'>[]
): void => {
    for (const _ of layoutSteps(force, nodes, edges)) {
        // each step mutates the nodes
    }
};
