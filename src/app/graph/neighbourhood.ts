import {
    GRAPH_SCHEMA_VERSION,
    type GraphFile,
    type GraphFileNode,
    type GraphModel,
    type GraphNode
} from './format';

const CENTRE_R = 12;
const NODE_R = 7;
/** Smallest arc radius; it grows with the neighbours so they keep apart. */
const MIN_ARC = 150;
const ARC_SPACING = 30;
/** Half the angle each side's arc spans. */
const HALF_SPAN = (Math.PI * 70) / 180;

/** Positions on an arc around 0,0, centred on `angle`, spread over at most `HALF_SPAN` each way. */
const arc = (count: number, angle: number, radius: number): { x: number; y: number }[] => {
    const step = count > 1 ? Math.min((HALF_SPAN * 2) / (count - 1), ARC_SPACING / radius) : 0;
    const start = angle - (step * (count - 1)) / 2;
    return Array.from({ length: count }, (_, i) => ({
        x: Math.round(Math.cos(start + step * i) * radius * 10) / 10,
        y: Math.round(Math.sin(start + step * i) * radius * 10) / 10
    }));
};

/**
 * The direct neighbourhood of one symbol: every relation it has, in both
 * directions and of every kind, one hop deep. The symbol sits in the middle,
 * what uses it on an arc to its left, what it uses on an arc to its right.
 * No features (no islands). Undefined for a symbol without relations.
 */
export const neighbourhood = (model: GraphModel, id: string): GraphFile | undefined => {
    const edges = model.edges.filter(e => e.source === id || e.target === id);
    if (edges.length === 0) {
        return undefined;
    }
    const byId = new Map(model.nodes.map(n => [n.id, n]));
    const centre = byId.get(id);
    if (!centre) {
        return undefined;
    }
    const byName = (a: string, b: string) =>
        (byId.get(a)?.name ?? a).localeCompare(byId.get(b)?.name ?? b);
    const uses = [...new Set(edges.filter(e => e.source === id).map(e => e.target))].sort(byName);
    const used = new Set(uses);
    const users = [
        ...new Set(edges.filter(e => e.target === id && !used.has(e.source)).map(e => e.source))
    ].sort(byName);
    const radius = Math.max(
        MIN_ARC,
        (Math.max(uses.length, users.length) * ARC_SPACING) / (HALF_SPAN * 2)
    );
    // Without islands no edge runs between two of them, so the nodes carry no feature.
    const plain = ({ feature: _feature, ...node }: GraphNode): GraphNode => node;
    const place = (ids: readonly string[], angle: number): GraphFileNode[] =>
        arc(ids.length, angle, radius).flatMap((at, i) => {
            const node = byId.get(ids[i]);
            return node ? [{ ...plain(node), ...at, r: NODE_R }] : [];
        });
    return {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: [
            { ...plain(centre), x: 0, y: 0, r: CENTRE_R },
            ...place(users, Math.PI),
            ...place(uses, 0)
        ],
        edges,
        features: []
    };
};
