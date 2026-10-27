import {
    defaultKinds,
    GRAPH_SCHEMA_VERSION,
    type GraphFile,
    type GraphModel,
    visibleGraph
} from './format';
import {
    degreesOf,
    type ForceApi,
    groupOf,
    type LayoutNode,
    nodeRadius,
    runLayout
} from './layout';

/** The written graph as the pages see it. */
export interface GraphOutput {
    readonly model: GraphModel;
    /** Cache key of the graph script (`?v=`). */
    readonly version: string;
    /** Nodes the graph shows first; the page reserves their height. */
    readonly shown: number;
}

/** One decimal is below a pixel at every zoom the graph offers and keeps the file small. */
const round = (value: number): number => Math.round(value * 10) / 10;

/**
 * The graph file: the model with every node of the default filter state laid
 * out. Same model, same file.
 */
export const graphFile = (force: ForceApi, model: GraphModel): GraphFile => {
    const visible = visibleGraph(model, defaultKinds(model.nodes));
    const degree = degreesOf(visible.edges);
    const layout: LayoutNode[] = visible.nodes.map(n => ({
        id: n.id,
        group: groupOf(n),
        r: nodeRadius(degree.get(n.id) ?? 0)
    }));
    runLayout(force, layout, visible.edges);
    const placed = new Map(layout.map(n => [n.id, n]));
    return {
        schemaVersion: GRAPH_SCHEMA_VERSION,
        nodes: model.nodes.map(n => {
            const at = placed.get(n.id);
            return at ? { ...n, x: round(at.x ?? 0), y: round(at.y ?? 0), r: round(at.r) } : n;
        }),
        edges: model.edges,
        features: model.features
    };
};
