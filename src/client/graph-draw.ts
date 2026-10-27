/**
 * Pure drawing helpers for the dependency graph: node glyphs, edge geometry,
 * island outlines and label order. No DOM and no D3, so they run in unit tests.
 */

import type { GraphKind } from '../app/graph/format';

export interface Placed {
    readonly x: number;
    readonly y: number;
    readonly r: number;
}

/** Colour of a node kind; themes override each kind separately. */
export const kindColor = (kind: GraphKind): string => `var(--color-cdx-graph-kind-${kind})`;

const BG = 'var(--color-cdx-graph-bg, var(--color-cdx-bg-alt))';

/**
 * SVG markup of a node glyph centred on 0,0. Every kind is a circle; the fill
 * tells the kinds apart, so they stay distinct where a theme colours two
 * kinds alike: component filled, directive a ring, pipe a half-filled ring,
 * service a ring with a core, token a small dot, provider a ring with an
 * inner ring, external a dashed ring.
 */
export const glyphMarkup = (kind: GraphKind, r: number): string => {
    const c = kindColor(kind);
    const w = Math.max(1.4, r * 0.32);
    const inner = r - w / 2;
    const ring = (extra = '') =>
        `<circle r="${inner}" fill="${BG}" stroke="${c}" stroke-width="${w}"${extra}/>`;
    switch (kind) {
        case 'component':
            return `<circle r="${r}" fill="${c}"/>`;
        case 'directive':
            return ring();
        case 'pipe':
            return `${ring()}<path d="M0,${-inner}A${inner},${inner} 0 0 0 0,${inner}Z" fill="${c}"/>`;
        case 'service':
            return `${ring()}<circle r="${r * 0.42}" fill="${c}"/>`;
        case 'token':
            return `<circle r="${Math.max(2.2, r * 0.55)}" fill="${c}"/>`;
        case 'provider':
            return `${ring()}<circle r="${r * 0.42}" fill="none" stroke="${c}" stroke-width="${w * 0.8}"/>`;
        case 'external':
            return ring(' stroke-dasharray="2.5 2"');
    }
};

/** Length of the bright direction head at the target end, in screen pixels. */
const HEAD_PX = 11;

export interface EdgeGeometry {
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    /** Start of the direction head; it ends at `x2`, `y2`. */
    readonly hx: number;
    readonly hy: number;
}

/**
 * An edge from the rim of `source` to just before the rim of `target`, with
 * the direction head on its last `HEAD_PX` screen pixels at zoom `k`.
 */
export const edgeGeometry = (source: Placed, target: Placed, k: number): EdgeGeometry => {
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;
    const start = source.r + 1.5;
    const end = Math.max(start, length - target.r - 2.5);
    const head = Math.max(start, end - HEAD_PX / Math.max(k, 0.4));
    return {
        x1: source.x + ux * start,
        y1: source.y + uy * start,
        x2: source.x + ux * end,
        y2: source.y + uy * end,
        hx: source.x + ux * head,
        hy: source.y + uy * head
    };
};

/** Space between a member and its island outline. */
export const HULL_PAD = 14;

/** Points on a ring around each member; their convex hull is the island outline. */
export const hullPoints = (members: readonly Placed[], samples = 10): [number, number][] =>
    members.flatMap(n =>
        Array.from({ length: samples }, (_, i): [number, number] => {
            const angle = (Math.PI * 2 * i) / samples;
            const r = n.r + HULL_PAD;
            return [n.x + r * Math.cos(angle), n.y + r * Math.sin(angle)];
        })
    );

/** Where an island's name sits: centred above its top member. */
export const islandLabelAnchor = (members: readonly Placed[]): { x: number; y: number } => ({
    x: members.reduce((sum, n) => sum + n.x, 0) / Math.max(1, members.length),
    y: Math.min(...members.map(n => n.y - n.r)) - HULL_PAD - 4
});

/** Indices in label priority: most connected first, then by name. */
export const labelOrder = (
    nodes: readonly { readonly degree: number; readonly name: string }[]
): number[] =>
    nodes
        .map((_, i) => i)
        .sort(
            (a, b) =>
                nodes[b].degree - nodes[a].degree || nodes[a].name.localeCompare(nodes[b].name)
        );
