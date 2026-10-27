/**
 * Pure helpers for the dependency graph: which labels fit without
 * overlapping, the zoom transform that fits the layout and the height the
 * page reserves. No DOM and no D3, so they run in unit tests.
 */

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
