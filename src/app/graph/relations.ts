import { compareText } from '../compiler/semantic/model';
import { GRAPH_EDGE_KINDS, type GraphEdgeKind, type GraphModel } from './format';

export interface SymbolRelations {
    readonly name: string;
    /** Relation kinds in a fixed order, each with its target names sorted. */
    readonly relations: readonly {
        readonly kind: GraphEdgeKind;
        readonly targets: readonly string[];
    }[];
}

export interface FeatureRelations {
    /** Feature label; undefined for the symbols without a feature. */
    readonly feature?: string;
    readonly symbols: readonly SymbolRelations[];
}

const byText = (a: string, b: string) =>
    compareText(a.toLowerCase(), b.toLowerCase()) || compareText(a, b);

/**
 * The text alternative of a graph: per feature, every symbol with a relation
 * and what it uses, injects, composes or provides. Features in model order,
 * the symbols without a feature last; symbols and targets by name.
 */
export const relationsByFeature = (model: GraphModel): FeatureRelations[] => {
    const byId = new Map(model.nodes.map(n => [n.id, n]));
    const outgoing = new Map<string, Map<GraphEdgeKind, string[]>>();
    for (const e of model.edges) {
        const target = byId.get(e.target)?.name ?? e.target;
        const kinds = outgoing.get(e.source) ?? new Map<GraphEdgeKind, string[]>();
        kinds.set(e.kind, [...(kinds.get(e.kind) ?? []), target]);
        outgoing.set(e.source, kinds);
    }
    const groups = new Map<string | undefined, SymbolRelations[]>();
    for (const [id, kinds] of outgoing) {
        const node = byId.get(id);
        if (!node) {
            continue;
        }
        const relations = GRAPH_EDGE_KINDS.flatMap(kind => {
            const targets = kinds.get(kind);
            return targets ? [{ kind, targets: [...new Set(targets)].sort(byText) }] : [];
        });
        groups.set(node.feature, [
            ...(groups.get(node.feature) ?? []),
            { name: node.name, relations }
        ]);
    }
    const sorted = (symbols: readonly SymbolRelations[]) =>
        [...symbols].sort((a, b) => byText(a.name, b.name));
    const featured = model.features.flatMap(f => {
        const symbols = groups.get(f.id);
        return symbols ? [{ feature: f.label, symbols: sorted(symbols) }] : [];
    });
    const known = new Set(model.features.map(f => f.id));
    const rest = [...groups].flatMap(([feature, symbols]) =>
        feature === undefined || !known.has(feature) ? symbols : []
    );
    return rest.length > 0 ? [...featured, { symbols: sorted(rest) }] : featured;
};
