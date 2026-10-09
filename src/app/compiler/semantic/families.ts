import type { FamilyLink, FeatureId, FeatureModel } from './features';
import { compareText } from './model';

export interface FamilySymbol {
    /** `factKey` of the symbol. */
    readonly key: string;
    /** Presentation kind (`component`, `directive`, `pipe`, `class`, `injectable`, ...). */
    readonly kind: string;
    /** `factKey`s of the symbols that use this one. */
    readonly usedBy: readonly string[];
}

const WRAPPER_KINDS: ReadonlySet<string> = new Set(['component', 'directive', 'pipe']);
const WRAPPED_KINDS: ReadonlySet<string> = new Set([
    'component',
    'directive',
    'pipe',
    'class',
    'injectable'
]);

/** Share of all features a wrapped feature may be used by before it counts as a hub. */
const HUB_SHARE = 0.25;

interface Edge {
    count: number;
    wraps: boolean;
}

/**
 * "Builds on" links between features of different entry points, from symbol
 * "used by" edges between documented symbols. `from` uses `to`. A link is
 * `wraps` when a component, directive or pipe of `from` uses a component,
 * directive, pipe, class or injectable of `to` and `to` is used by at most a
 * quarter of all features; otherwise `same-name` when both labels are equal.
 * A shared name without an edge never links.
 */
export const linkFamilies = (
    model: FeatureModel,
    symbols: readonly FamilySymbol[]
): readonly FamilyLink[] => {
    const features = new Map(model.features.map(feature => [feature.id, feature]));
    const kinds = new Map(symbols.map(symbol => [symbol.key, symbol.kind]));
    const scopeOf = (id: FeatureId): string => features.get(id)?.entryPoint ?? '';
    const edges = new Map<string, Edge>();
    for (const symbol of symbols) {
        const to = model.featureOf.get(symbol.key);
        if (to === undefined) {
            continue;
        }
        for (const user of symbol.usedBy) {
            const from = model.featureOf.get(user);
            if (from === undefined || scopeOf(from) === scopeOf(to)) {
                continue;
            }
            const key = `${from}\0${to}`;
            const edge = edges.get(key) ?? { count: 0, wraps: false };
            edge.count++;
            if (WRAPPER_KINDS.has(kinds.get(user) ?? '') && WRAPPED_KINDS.has(symbol.kind)) {
                edge.wraps = true;
            }
            edges.set(key, edge);
        }
    }
    const inDegree = new Map<FeatureId, number>();
    for (const key of edges.keys()) {
        const to = key.slice(key.indexOf('\0') + 1);
        inDegree.set(to, (inDegree.get(to) ?? 0) + 1);
    }
    const hubLimit = HUB_SHARE * model.features.length;
    const links: FamilyLink[] = [];
    for (const [key, edge] of edges) {
        const [from, to] = key.split('\0');
        if (edge.wraps && (inDegree.get(to) ?? 0) <= hubLimit) {
            links.push({ from, to, reason: 'wraps', edges: edge.count });
        } else if (features.get(from)?.label === features.get(to)?.label) {
            links.push({ from, to, reason: 'same-name', edges: edge.count });
        }
    }
    return links.sort((a, b) => compareText(a.from, b.from) || compareText(a.to, b.to));
};
