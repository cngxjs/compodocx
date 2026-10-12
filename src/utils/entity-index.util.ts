import { type DiView, hiddenFilter } from '../app/di/model';
import { hrefFor, hrefText, routeAnchor } from '../app/links/layout';
import { placedLink } from '../app/links/resolve';
import {
    buildSymbolTable,
    type EngineData,
    lookupEntry,
    policyKinds,
    type SymbolTable
} from '../app/links/symbol-table';
import type { RouteNode, RoutingModel } from '../app/routing/model';

export interface EntityIndexEntry {
    href: string;
    kind: string;
}

export type EntityIndex = Record<string, EntityIndexEntry>;

const INDEX_KIND: Readonly<Record<string, string>> = { enumeration: 'enum' };

/** Key prefix of the route entries; symbol names never contain `:`. */
export const ROUTE_ENTRY_PREFIX = 'route:';

/**
 * One entry per distinct full path of the route model, linking its first
 * row on the routes page (`route:/users` -> `routes.html#route-0-2`). The
 * command palette matches them without the search index.
 */
export const routeEntries = (model: RoutingModel | undefined): EntityIndex => {
    const entries: EntityIndex = {};
    const walk = (nodes: readonly RouteNode[]): void => {
        for (const node of nodes) {
            const key = `${ROUTE_ENTRY_PREFIX}${node.fullPath}`;
            if (entries[key] === undefined) {
                const href = hrefFor({ type: 'root', page: 'routes' }, 0, routeAnchor(node.id));
                entries[key] = { href: hrefText(href, 'bare'), kind: 'route' };
            }
            walk(node.children);
        }
    };
    for (const root of model?.roots ?? []) {
        walk(root.routes);
    }
    return entries;
};

/**
 * Build the entity index from mainData. Call after entity collection, before
 * rendering. Keys are bare names; a name that several symbols carry resolves
 * through the `entity-index` lookup policy. Hrefs are root-relative.
 */
export function buildEntityIndex(mainData: Record<string, unknown>): EntityIndex {
    // The run's table carries every page's folder; a bare engine snapshot (tests) builds one.
    const table =
        (mainData.symbols as SymbolTable | undefined) ?? buildSymbolTable(mainData as EngineData);
    const names = new Set<string>();
    for (const kind of policyKinds('entity-index')) {
        for (const entry of table.byId.values()) {
            if (entry.ref.kind === kind) {
                names.add(entry.ref.name);
            }
        }
    }

    const di = mainData.di as DiView | undefined;
    const hidden = hiddenFilter(di);
    const index: EntityIndex = {};
    for (const name of names) {
        const entry = lookupEntry(table, name, 'entity-index', undefined, hidden);
        const link = entry && placedLink(table, entry, di);
        if (!entry || !link) {
            continue;
        }
        const href = hrefFor(link.target, 0, link.anchor);
        index[name] = {
            href: hrefText(href, 'bare'),
            kind: INDEX_KIND[entry.ref.kind] ?? entry.ref.kind
        };
    }
    const routing = mainData.disableRoutes
        ? undefined
        : (mainData.routing as RoutingModel | undefined);
    return { ...index, ...routeEntries(routing) };
}
