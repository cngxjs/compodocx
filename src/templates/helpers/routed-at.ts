import { hrefFor, hrefText, routeAnchor } from '../../app/links/layout';
import type { TableKind } from '../../app/links/symbol-id';
import type { SymbolTable } from '../../app/links/symbol-table';
import { entryInFile } from '../../app/links/symbol-table';
import { mountsOf, routedNodes } from '../../app/routing/lookup';
import type { RoutingModel } from '../../app/routing/model';
import { t } from './i18n';

/** One link of a Routed at / Mounted at list: a full path and its row on the routes page. */
export interface RoutedAtLink {
    readonly label: string;
    readonly href: string;
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

/**
 * The Routed at list of a component (the routes rendering it) or the Mounted
 * at list of a route array variable (the full paths it is mounted at, or its
 * unmounted section). Undefined when the symbol is not part of any route.
 */
export const routedAt = (
    data: RouteData,
    kind: TableKind,
    item: { readonly name?: string; readonly file?: string },
    depth: number
): RoutedAtProps | undefined => {
    const { routing: model, symbols } = data;
    if (model === undefined || symbols === undefined || data.disableRoutes || !item.name) {
        return undefined;
    }
    const entry = entryInFile(symbols, kind, item.name, item.file);
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
