import type { SymbolId } from '../links/symbol-id';
import type { RouteNode, RoutingModel } from './model';

const nodeIndexes = new WeakMap<RoutingModel, ReadonlyMap<string, RouteNode>>();

/** Route nodes by id, built once per model. */
export const nodesById = (model: RoutingModel): ReadonlyMap<string, RouteNode> => {
    const known = nodeIndexes.get(model);
    if (known) {
        return known;
    }
    const index = new Map<string, RouteNode>();
    const walk = (nodes: readonly RouteNode[]): void => {
        for (const node of nodes) {
            index.set(node.id, node);
            walk(node.children);
        }
    };
    for (const root of model.roots) {
        walk(root.routes);
    }
    nodeIndexes.set(model, index);
    return index;
};

/** The route nodes rendering a component, in tree order. */
export const routedNodes = (model: RoutingModel, id: SymbolId): readonly RouteNode[] =>
    (model.byTarget.get(id) ?? [])
        .map(nodeId => nodesById(model).get(nodeId))
        .filter((node): node is RouteNode => node !== undefined);

/** A place a route array is mounted at: the full path, and the first route there. */
export interface RouteMount {
    readonly place: string;
    readonly node: string;
}

/** The places a route array is mounted at in the routers, in tree order. */
export const mountsOf = (model: RoutingModel, id: SymbolId): readonly RouteMount[] => {
    const mounts: RouteMount[] = [];
    const walk = (nodes: readonly RouteNode[], parent: string): void => {
        for (const node of nodes) {
            if (node.array === id && !mounts.some(mount => mount.place === parent)) {
                mounts.push({ place: parent, node: node.id });
            }
            walk(node.children, node.fullPath);
        }
    };
    for (const root of model.roots.filter(r => r.kind === 'router')) {
        walk(root.routes, '/');
    }
    return mounts;
};
