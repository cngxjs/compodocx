/**
 * The dependency graph as the build writes it and the client reads it.
 * Imports nothing, so the client bundle shares it.
 */

/** Version of the written graph data; bump it when a field is renamed or removed. */
export const GRAPH_SCHEMA_VERSION = 1 as const;

/** Node kinds in drawing order. Services cover `@Injectable` and `@Service` classes. */
export const GRAPH_KINDS = [
    'component',
    'directive',
    'pipe',
    'service',
    'token',
    'provider',
    'external'
] as const;

export type GraphKind = (typeof GRAPH_KINDS)[number];

/** Kinds the graph starts without; their filter chips start unpressed. */
export const GRAPH_KINDS_OFF: ReadonlySet<GraphKind> = new Set<GraphKind>([
    'token',
    'provider',
    'external'
]);

export const GRAPH_EDGE_KINDS = ['imports', 'composes', 'injects', 'provides'] as const;

/**
 * `imports`: uses it in its template (`imports`); `composes`: `hostDirectives`;
 * `injects`: reads the token or service with `inject()`; `provides`: a provider
 * function provides the token.
 */
export type GraphEdgeKind = (typeof GRAPH_EDGE_KINDS)[number];

export interface GraphNode {
    /** The symbol id, or `external:<name>` for an import from outside the project. */
    readonly id: string;
    readonly name: string;
    readonly kind: GraphKind;
    /** Feature id; absent for externals and symbols without a feature. */
    readonly feature?: string;
    /** Page of the symbol, relative to the site root; absent for externals. */
    readonly url?: string;
}

export interface GraphEdge {
    /** The node that uses, composes, injects or provides. */
    readonly source: string;
    readonly target: string;
    readonly kind: GraphEdgeKind;
}

export interface GraphFeature {
    readonly id: string;
    readonly label: string;
    readonly entryPoint?: string;
}

export interface GraphModel {
    readonly nodes: readonly GraphNode[];
    readonly edges: readonly GraphEdge[];
    /** Only the features a node belongs to. */
    readonly features: readonly GraphFeature[];
}

/** A node as written: the layout position and radius for the default filter state. */
export interface GraphFileNode extends GraphNode {
    /** Absent for a node of a kind the graph starts without. */
    readonly x?: number;
    readonly y?: number;
    readonly r?: number;
}

/** The graph data a page loads (`js/graph.js`, `window.__CDX_GRAPH__`). */
export interface GraphFile {
    readonly schemaVersion: typeof GRAPH_SCHEMA_VERSION;
    readonly nodes: readonly GraphFileNode[];
    readonly edges: readonly GraphEdge[];
    readonly features: readonly GraphFeature[];
}

/** The nodes and edges of the kinds in `kinds`; edges need both ends shown. */
export const visibleGraph = <N extends GraphNode, E extends GraphEdge>(
    graph: { readonly nodes: readonly N[]; readonly edges: readonly E[] },
    kinds: ReadonlySet<GraphKind>
): { nodes: N[]; edges: E[] } => {
    const nodes = graph.nodes.filter(n => kinds.has(n.kind));
    const ids = new Set(nodes.map(n => n.id));
    const edges = graph.edges.filter(
        e => e.source !== e.target && ids.has(e.source) && ids.has(e.target)
    );
    return { nodes, edges };
};

/** The kinds a graph shows first: every kind it has, without the ones that start off. */
export const defaultKinds = (nodes: readonly Pick<GraphNode, 'kind'>[]): Set<GraphKind> =>
    new Set(nodes.map(n => n.kind).filter(kind => !GRAPH_KINDS_OFF.has(kind)));
