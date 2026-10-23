/**
 * Pure helpers for the dependency graph: which nodes to draw, which labels
 * fit without overlapping, and the zoom transform that fits the layout.
 * No DOM and no D3, so they run in unit tests.
 */

export interface GraphInputNode {
    readonly name: string;
    readonly type: string;
    readonly url?: string;
}

export interface GraphInputEdge {
    readonly source: string;
    readonly target: string;
}

export interface GraphInput {
    readonly nodes: readonly GraphInputNode[];
    readonly edges: readonly GraphInputEdge[];
}

export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export interface FitTransform {
    readonly x: number;
    readonly y: number;
    readonly k: number;
}

/**
 * Height of the graph viewport in pixels for `count` drawn nodes. The page
 * reserves it before the client draws, so nothing below the graph jumps.
 */
export const graphHeight = (count: number): number => Math.max(450, Math.min(700, count * 25));

/** The nodes and edges to draw; external nodes and their edges only when shown. */
export const visibleGraph = (graph: GraphInput, showExternals: boolean): GraphInput => {
    const nodes = graph.nodes.filter(n => showExternals || n.type !== 'external');
    const names = new Set(nodes.map(n => n.name));
    const edges = graph.edges.filter(
        e => e.source !== e.target && names.has(e.source) && names.has(e.target)
    );
    return { nodes, edges };
};

/** Edge count per node name, both directions. */
export const degrees = (edges: readonly GraphInputEdge[]): Map<string, number> => {
    const count = new Map<string, number>();
    for (const e of edges) {
        count.set(e.source, (count.get(e.source) ?? 0) + 1);
        count.set(e.target, (count.get(e.target) ?? 0) + 1);
    }
    return count;
};

const overlaps = (a: Box, b: Box, gap: number): boolean =>
    a.x < b.x + b.width + gap &&
    b.x < a.x + a.width + gap &&
    a.y < b.y + b.height + gap &&
    b.y < a.y + a.height + gap;

/**
 * Indices of the boxes to keep, taken greedily in `order` (most important
 * first): a box is kept when it overlaps no obstacle and no box kept before it.
 */
export const nonOverlapping = (
    boxes: readonly Box[],
    order: readonly number[],
    gap = 0,
    obstacles: readonly Box[] = []
): Set<number> => {
    const kept: Box[] = [...obstacles];
    const keptIndices = new Set<number>();
    for (const index of order) {
        const box = boxes[index];
        if (!box || kept.some(other => overlaps(box, other, gap))) {
            continue;
        }
        kept.push(box);
        keptIndices.add(index);
    }
    return keptIndices;
};

/** The transform that centers `bounds` in the viewport with `pad` pixels around it. */
export const fitTransform = (
    bounds: Box,
    width: number,
    height: number,
    pad: number,
    maxScale: number
): FitTransform => {
    const innerWidth = Math.max(1, width - pad * 2);
    const innerHeight = Math.max(1, height - pad * 2);
    const k = Math.min(
        maxScale,
        innerWidth / Math.max(1, bounds.width),
        innerHeight / Math.max(1, bounds.height)
    );
    return {
        x: width / 2 - (bounds.x + bounds.width / 2) * k,
        y: height / 2 - (bounds.y + bounds.height / 2) * k,
        k
    };
};
