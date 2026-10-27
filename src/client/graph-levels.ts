/**
 * Dependency levels for the build-up animation: a symbol sits one level
 * above the highest level of what it uses, so primitives come first. A
 * cycle shares one level. Pure, no DOM.
 */

interface Edge {
    readonly source: string;
    readonly target: string;
}

/**
 * Strongly connected components (iterative Tarjan), numbered in the order
 * they complete: a component completes after every component it reaches.
 */
const components = (
    ids: readonly string[],
    out: ReadonlyMap<string, readonly string[]>
): { readonly of: Map<string, number>; readonly count: number } => {
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const of = new Map<string, number>();
    let next = 0;
    let count = 0;
    const visit = (id: string) => {
        index.set(id, next);
        low.set(id, next);
        next++;
        stack.push(id);
        onStack.add(id);
    };
    for (const start of ids) {
        if (index.has(start)) {
            continue;
        }
        visit(start);
        const work: [string, number][] = [[start, 0]];
        while (work.length > 0) {
            const top = work[work.length - 1];
            const [v, i] = top;
            const targets = out.get(v) ?? [];
            if (i < targets.length) {
                top[1]++;
                const w = targets[i];
                if (!index.has(w)) {
                    visit(w);
                    work.push([w, 0]);
                } else if (onStack.has(w)) {
                    low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
                }
                continue;
            }
            work.pop();
            const parent = work[work.length - 1];
            if (parent) {
                low.set(parent[0], Math.min(low.get(parent[0]) ?? 0, low.get(v) ?? 0));
            }
            if (low.get(v) === index.get(v)) {
                let w: string | undefined;
                do {
                    w = stack.pop();
                    if (w !== undefined) {
                        onStack.delete(w);
                        of.set(w, count);
                    }
                } while (w !== undefined && w !== v);
                count++;
            }
        }
    }
    return { of, count };
};

/** The level of every id; edges point from the user to what it uses. */
export const dependencyLevels = (
    ids: readonly string[],
    edges: readonly Edge[]
): Map<string, number> => {
    const known = new Set(ids);
    const out = new Map<string, string[]>(ids.map(id => [id, []]));
    for (const e of edges) {
        if (known.has(e.source) && known.has(e.target)) {
            out.get(e.source)?.push(e.target);
        }
    }
    const { of, count } = components(ids, out);
    const reaches = new Map<number, Set<number>>();
    for (const [v, targets] of out) {
        for (const w of targets) {
            const a = of.get(v) ?? 0;
            const b = of.get(w) ?? 0;
            if (a !== b) {
                reaches.set(a, (reaches.get(a) ?? new Set()).add(b));
            }
        }
    }
    // Components complete after everything they reach, so their targets have a level already.
    const level: number[] = [];
    for (let c = 0; c < count; c++) {
        let l = 0;
        for (const b of reaches.get(c) ?? []) {
            l = Math.max(l, (level[b] ?? 0) + 1);
        }
        level[c] = l;
    }
    return new Map(ids.map(id => [id, level[of.get(id) ?? 0] ?? 0]));
};

/** Time between two dependency levels of the build-up. */
export const BUILD_STEP_MS = 520;
/** Level 0 holds most symbols; its islands appear one after another within this span. */
export const LEVEL0_MAX_MS = 1200;
const ISLAND_STEP_MAX_MS = 220;
const JITTER_MS = 90;

export interface ScheduleNode {
    readonly id: string;
    readonly group: string;
    readonly x: number;
    readonly y: number;
    readonly level: number;
}

export interface BuildSchedule {
    /** When each node appears, in ms from the start. */
    readonly at: ReadonlyMap<string, number>;
    /** When level 1 starts. */
    readonly level0Ms: number;
    /** Highest level. */
    readonly top: number;
    /** When the last node has appeared. */
    readonly endMs: number;
}

/** Small per-node delay from its id, so a level does not appear in lockstep. */
const jitter = (id: string): number => {
    let h = 0;
    for (const ch of id) {
        h = (h * 31 + ch.charCodeAt(0)) | 0;
    }
    return Math.abs(h) % JITTER_MS;
};

/**
 * When each node of the build-up appears. Level 0 appears island by island,
 * from the island nearest the middle outward, within `LEVEL0_MAX_MS`; each
 * further level follows `BUILD_STEP_MS` after the one before.
 */
export const buildSchedule = (nodes: readonly ScheduleNode[]): BuildSchedule => {
    const cx = nodes.reduce((sum, n) => sum + n.x, 0) / Math.max(1, nodes.length);
    const cy = nodes.reduce((sum, n) => sum + n.y, 0) / Math.max(1, nodes.length);
    const groups = new Map<string, ScheduleNode[]>();
    for (const n of nodes.filter(node => node.level === 0)) {
        groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
    }
    const distance = (members: readonly ScheduleNode[]) => {
        const gx = members.reduce((sum, n) => sum + n.x, 0) / members.length;
        const gy = members.reduce((sum, n) => sum + n.y, 0) / members.length;
        return Math.hypot(gx - cx, gy - cy);
    };
    const order = [...groups]
        .map(([group, members]) => ({ group, distance: distance(members) }))
        .sort((a, b) => a.distance - b.distance || (a.group < b.group ? -1 : 1))
        .map(g => g.group);
    const rank = new Map(order.map((group, i) => [group, i]));
    const islandStep =
        order.length > 1 ? Math.min(ISLAND_STEP_MAX_MS, LEVEL0_MAX_MS / (order.length - 1)) : 0;
    const level0Ms = (order.length - 1) * islandStep + 300;
    const top = nodes.reduce((max, n) => Math.max(max, n.level), 0);
    const at = new Map(
        nodes.map(n => [
            n.id,
            (n.level === 0
                ? (rank.get(n.group) ?? 0) * islandStep
                : level0Ms + (n.level - 1) * BUILD_STEP_MS) + jitter(n.id)
        ])
    );
    const endMs = Math.max(0, ...at.values()) + JITTER_MS;
    return { at, level0Ms, top, endMs };
};

/** The level the build-up shows `elapsed` ms after its start. */
export const levelAt = (schedule: BuildSchedule, elapsed: number): number =>
    elapsed < schedule.level0Ms
        ? 0
        : Math.min(schedule.top, 1 + Math.floor((elapsed - schedule.level0Ms) / BUILD_STEP_MS));
