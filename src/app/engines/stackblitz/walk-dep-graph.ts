import type { Result } from '../../../lib';
import { STACKBLITZ_DEP_DEPTH, STACKBLITZ_FILE_COUNT_CAP } from './constants';

// Local POSIX basename — keeps this module free of a node:path import so it
// stays trivially portable. Splits on both separators for cross-platform paths.
const posixBasename = (file: string): string => {
    const parts = file.replaceAll('\\', '/').split('/');
    return parts[parts.length - 1] || file;
};

/**
 * One entry in the playground dep graph. `imports` is a list of named
 * dependencies (entity names) that the resolver knows how to map back to
 * source. `internal` flags @internal-tagged exports so they can be filtered
 * out before serialisation — private code never leaks into a public
 * StackBlitz project.
 */
export interface DepGraphNode {
    name: string;
    /** POSIX-formatted absolute or workspace-relative source path. */
    file: string;
    sourceCode: string;
    imports: string[];
    internal?: boolean;
}

export type DepGraphResolver = (name: string) => DepGraphNode | null | undefined;

export interface WalkOptions {
    /** Maximum depth to follow. Defaults to {@link STACKBLITZ_DEP_DEPTH}. */
    depth?: number;
    /** Hard cap on returned files. Defaults to {@link STACKBLITZ_FILE_COUNT_CAP}. */
    maxFiles?: number;
}

export type WalkResult = Result<DepGraphNode[]>;

/**
 * Walks the dependency graph rooted at `rootName` in BFS order. Filters out
 * @internal-tagged nodes, dedupes by name, and aborts with a descriptive
 * error when either the depth or file-count cap is exceeded. Pure function:
 * the resolver is the single I/O boundary — production callers wire it to
 * the live source provider, tests pass a static map.
 */
export function walkDepGraph(
    rootName: string,
    resolve: DepGraphResolver,
    options: WalkOptions = {}
): WalkResult {
    const maxDepth = options.depth ?? STACKBLITZ_DEP_DEPTH;
    const maxFiles = options.maxFiles ?? STACKBLITZ_FILE_COUNT_CAP;

    const root = resolve(rootName);
    if (!root) {
        return { ok: false, message: `Cannot locate source for "${rootName}"` };
    }
    if (root.internal) {
        return { ok: false, message: `"${rootName}" is marked @internal` };
    }

    const visited = new Set<string>([rootName]);
    const collected: DepGraphNode[] = [root];
    const queue: Array<{ name: string; depth: number }> = (root.imports ?? []).map(name => ({
        name,
        depth: 1
    }));

    while (queue.length > 0) {
        const next = queue.shift();
        if (!next) {
            break;
        }
        if (visited.has(next.name)) {
            continue;
        }
        visited.add(next.name);
        if (next.depth > maxDepth) {
            continue;
        }
        const node = resolve(next.name);
        if (!node || node.internal) {
            continue;
        }
        if (collected.length >= maxFiles) {
            const walked = collected.map(n => posixBasename(n.file)).join(', ');
            return {
                ok: false,
                message:
                    `Playground dep walk for "${rootName}" exceeded the ${maxFiles}-file cap ` +
                    `(playgroundFileCountCap). Walked: ${walked}. ` +
                    `Trim the example's imports or raise playgroundFileCountCap.`
            };
        }
        collected.push(node);
        for (const dep of node.imports ?? []) {
            if (!visited.has(dep)) {
                queue.push({ name: dep, depth: next.depth + 1 });
            }
        }
    }

    return { ok: true, value: collected };
}
