import type { EntityKind } from '../../app/engines/dependencies.engine';
import { hrefFor, hrefText, routeAnchor } from '../../app/links/layout';
import { presentationKind, qualifiedName, type TableKind } from '../../app/links/symbol-id';
import type { SymbolTable } from '../../app/links/symbol-table';
import { entryInFile } from '../../app/links/symbol-table';
import { mountsOf, type RouteUseAt, routedNodes, routeUsesOf } from '../../app/routing/lookup';
import type { RoutingModel } from '../../app/routing/model';
import { t } from './i18n';

/** One link of a Routed at / Mounted at / Used in routes list: a full path and its row on the routes page. */
export interface RoutedAtLink {
    readonly label: string;
    readonly href: string;
    /** Used in routes only: how the route uses the symbol (`canActivate`, `resolve: user`, `title`). */
    readonly role?: string;
}

/** What the `block-routed-at` override receives. */
export interface RoutedAtProps {
    readonly id: string;
    readonly title: string;
    readonly links: readonly RoutedAtLink[];
}

interface RouteData {
    readonly routing?: RoutingModel;
    readonly symbols?: SymbolTable;
    readonly disableRoutes?: boolean;
}

const routesHref = (id: string, depth: number): string =>
    hrefText(hrefFor({ type: 'root', page: 'routes' }, depth, routeAnchor(id)));

const roleLabel = (use: RouteUseAt): string =>
    use.role === 'resolve' ? `resolve: ${use.key}` : use.role;

/**
 * The Routed at list of a component (the routes rendering it), the Used in
 * routes list of a guard, resolver or title resolver (each route with its
 * role) or the Mounted at list of a route array variable (the full paths it
 * is mounted at, or its unmounted section). Undefined when the symbol is not
 * part of any route.
 */
export const routedAt = (
    data: RouteData,
    kind: TableKind,
    item: { readonly name?: string; readonly file?: string; readonly functionalKind?: string },
    depth: number
): RoutedAtProps | undefined => {
    const { routing: model, symbols } = data;
    if (model === undefined || symbols === undefined || data.disableRoutes || !item.name) {
        return undefined;
    }
    // A functional guard or resolver is listed under its presentation kind.
    const tableKind = presentationKind(kind as EntityKind, item);
    const entry = entryInFile(symbols, tableKind, qualifiedName(item), item.file);
    if (!entry) {
        return undefined;
    }
    const routed = routedNodes(model, entry.id);
    if (routed.length > 0) {
        return {
            id: 'routed-at',
            title: t('routed-at'),
            links: routed.map(node => ({ label: node.fullPath, href: routesHref(node.id, depth) }))
        };
    }
    const uses = routeUsesOf(model, entry.id);
    if (uses.length > 0) {
        return {
            id: 'used-in-routes',
            title: t('used-in-routes'),
            links: uses.map(use => ({
                label: use.route.fullPath,
                role: roleLabel(use),
                href: routesHref(use.node, depth)
            }))
        };
    }
    const mounts = mountsOf(model, entry.id);
    if (mounts.length > 0) {
        return {
            id: 'mounted-at',
            title: t('mounted-at'),
            links: mounts.map(mount => ({
                label: mount.place,
                href: routesHref(mount.node, depth)
            }))
        };
    }
    const unmounted = model.roots.find(
        root => root.kind === 'unmounted' && root.array === entry.id
    );
    return unmounted
        ? {
              id: 'mounted-at',
              title: t('mounted-at'),
              links: [{ label: t('unmounted-routes'), href: routesHref(unmounted.id, depth) }]
          }
        : undefined;
};
