import { compareText, factKey, type SemanticModel } from '../compiler/semantic/model';
import type { DiView } from '../di/model';
import { hrefFor, hrefText, ROOT_DEPTH } from '../links/layout';
import { placedLink } from '../links/resolve';
import { type TableKind, toSymbolKey } from '../links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../links/symbol-table';
import type {
    GraphEdge,
    GraphEdgeKind,
    GraphFeature,
    GraphKind,
    GraphModel,
    GraphNode
} from './format';

const KIND_OF: Partial<Record<TableKind, GraphKind>> = {
    component: 'component',
    directive: 'directive',
    pipe: 'pipe',
    injectable: 'service',
    service: 'service',
    token: 'token'
};

/** Kinds a template `imports` entry or a `hostDirectives` entry can name. */
const IMPORTABLE: ReadonlySet<GraphKind> = new Set<GraphKind>(['component', 'directive', 'pipe']);
const COMPOSABLE: ReadonlySet<GraphKind> = new Set<GraphKind>(['directive', 'component']);

type Named = { readonly name?: unknown };

const namesOf = (list: unknown): string[] =>
    Array.isArray(list)
        ? list.flatMap((item: unknown) => {
              const name = typeof item === 'string' ? item : (item as Named | null)?.name;
              return typeof name === 'string' && name !== '' ? [name] : [];
          })
        : [];

/** A provider function or constant (DI role `provider`) is a node of its own kind. */
const graphKind = (
    entry: SymbolEntry,
    semantic: SemanticModel | undefined
): GraphKind | undefined => {
    const kind = KIND_OF[entry.ref.kind];
    if (kind) {
        return kind;
    }
    const isMisc = entry.ref.kind === 'function' || entry.ref.kind === 'variable';
    const role = semantic?.facts.get(factKey(toSymbolKey(entry.ref)))?.di?.role;
    return isMisc && role === 'provider' ? 'provider' : undefined;
};

interface Member {
    readonly node: GraphNode;
    readonly entry: SymbolEntry;
}

/**
 * The project-wide dependency graph: components, directives, pipes,
 * services, tokens and provider functions that an entry point exports, with
 * four kinds of relations. Template imports that are no project symbol
 * become external nodes; they are only ever edge targets. Pure; sorted by
 * id so the output is byte-stable.
 */
export const buildGraphModel = (
    symbols: SymbolTable,
    semantic: SemanticModel | undefined,
    di: DiView | undefined
): GraphModel => {
    const features = semantic?.features;
    const members: Member[] = [];
    for (const entry of symbols.byId.values()) {
        const kind = graphKind(entry, semantic);
        const facts = semantic?.facts.get(factKey(toSymbolKey(entry.ref)));
        if (!kind || facts?.notExported) {
            continue;
        }
        const link = placedLink(symbols, entry, di);
        const feature = features?.featureOf.get(factKey(toSymbolKey(entry.ref)));
        members.push({
            entry,
            node: {
                id: entry.id,
                name: entry.ref.name,
                kind,
                ...(feature ? { feature } : {}),
                ...(link
                    ? { url: hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor), 'bare') }
                    : {})
            }
        });
    }
    members.sort((a, b) => compareText(a.node.id, b.node.id));

    const byKey = new Map(members.map(m => [factKey(toSymbolKey(m.entry.ref)), m.node]));
    const byName = new Map<string, GraphNode[]>();
    for (const { node } of members) {
        byName.set(node.name, [...(byName.get(node.name) ?? []), node]);
    }
    const externals = new Map<string, GraphNode>();

    /**
     * The node a name in `from`'s metadata stands for: a node of an allowed
     * kind (the one in `from`'s feature first), an external node when no
     * project symbol has the name, else none (a hidden or undrawn symbol).
     */
    const resolveName = (
        from: GraphNode,
        name: string,
        kinds: ReadonlySet<GraphKind>
    ): GraphNode | undefined => {
        const candidates = (byName.get(name) ?? []).filter(n => kinds.has(n.kind));
        if (candidates.length > 0) {
            return candidates.find(n => n.feature === from.feature) ?? candidates[0];
        }
        if (symbols.byName.has(name)) {
            return undefined;
        }
        const known = externals.get(name);
        if (known) {
            return known;
        }
        const external: GraphNode = { id: `external:${name}`, name, kind: 'external' };
        externals.set(name, external);
        return external;
    };

    const edges = new Map<string, GraphEdge>();
    const add = (source: GraphNode, target: GraphNode | undefined, kind: GraphEdgeKind) => {
        if (!target || target.id === source.id) {
            return;
        }
        const key = `${source.id}\u0000${target.id}\u0000${kind}`;
        edges.set(key, { source: source.id, target: target.id, kind });
    };

    for (const { node, entry } of members) {
        const data = entry.data as {
            readonly imports?: unknown;
            readonly hostDirectives?: unknown;
        };
        if (node.kind === 'component') {
            for (const name of namesOf(data.imports)) {
                add(node, resolveName(node, name, IMPORTABLE), 'imports');
            }
        }
        if (node.kind === 'component' || node.kind === 'directive') {
            for (const name of namesOf(data.hostDirectives)) {
                add(node, resolveName(node, name, COMPOSABLE), 'composes');
            }
        }
        const facts = semantic?.facts.get(factKey(toSymbolKey(entry.ref)));
        for (const key of facts?.di?.readsTokens ?? []) {
            add(node, byKey.get(factKey(key)), 'injects');
        }
        for (const key of facts?.di?.providesTokens ?? []) {
            add(node, byKey.get(factKey(key)), 'provides');
        }
    }

    const nodes = [
        ...members.map(m => m.node),
        ...[...externals.values()].sort((a, b) => compareText(a.id, b.id))
    ];
    const featureIds = new Set(nodes.flatMap(n => (n.feature ? [n.feature] : [])));
    const graphFeatures: GraphFeature[] = (features?.features ?? [])
        .filter(f => featureIds.has(f.id))
        .map(f => ({
            id: f.id,
            label: f.label,
            ...(f.entryPoint ? { entryPoint: f.entryPoint } : {})
        }))
        .sort((a, b) => compareText(a.id, b.id));

    return {
        nodes,
        edges: [...edges.values()].sort(
            (a, b) =>
                compareText(a.source, b.source) ||
                compareText(a.target, b.target) ||
                compareText(a.kind, b.kind)
        ),
        features: graphFeatures
    };
};
