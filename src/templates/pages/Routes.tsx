import Html from '@kitajs/html';
import type { DiView } from '../../app/di';
import { hrefFor, hrefText, routeAnchor } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import type { SymbolId } from '../../app/links/symbol-id';
import type { SymbolTable } from '../../app/links/symbol-table';
import {
    GUARD_KEYS,
    type RouteNode,
    type RouteRef,
    type RouteRoot,
    type RouteTarget,
    type RouteValue,
    type RoutingModel
} from '../../app/routing/model';
import { highlightedCodeWrap, t } from '../helpers';

/** What the `routes` override receives besides the main data. */
export interface RoutesPageData {
    readonly depth: number;
    readonly routing?: RoutingModel;
    readonly symbols?: SymbolTable;
    readonly di?: DiView;
}

interface Ctx {
    readonly depth: number;
    readonly table?: SymbolTable;
    readonly di?: DiView;
}

const esc = (text: string): string => Html.escapeHtml(text) as string;

const code = (text: string): string => `<code>${esc(text)}</code>`;

/** Link to a documented symbol's page, or undefined for a hidden or unknown symbol. */
const symbolHref = (id: SymbolId | undefined, ctx: Ctx): string | undefined => {
    const entry = id && ctx.table?.byId.get(id);
    const link = entry && ctx.table && placedLink(ctx.table, entry, ctx.di);
    return link ? hrefText(hrefFor(link.target, ctx.depth, link.anchor)) : undefined;
};

const linked = (html: string, href: string | undefined): string =>
    href ? `<a href="${esc(href)}">${html}</a>` : html;

/** A guard, resolver, provider or feature: its source, linked to the callee when documented. */
const refHtml = (ref: RouteRef, ctx: Ctx): string =>
    `<span class="cdx-routes-ref">${linked(code(ref.source), symbolHref(ref.symbol, ctx))}</span>`;

const isRef = (value: RouteValue | RouteRef): value is RouteRef => 'call' in value;

const valueHtml = (value: RouteValue | RouteRef, ctx: Ctx): string => {
    if (isRef(value)) {
        return refHtml(value, ctx);
    }
    return value.kind === 'literal' ? code(value.text) : code(value.source);
};

const lazyBadge = (): string => `<span class="cdx-routes-lazy">${esc(t('lazy'))}</span>`;

const targetHtml = (target: RouteTarget, ctx: Ctx): string => {
    const lazy = target.lazy ? ` ${lazyBadge()}` : '';
    if (target.kind === 'external') {
        return `${code(target.specifier ?? '')} ${esc(target.name)}${lazy}`;
    }
    if (target.kind === 'unresolved') {
        return `${code(target.source)}${lazy}`;
    }
    return `${linked(code(target.name), symbolHref(target.symbol, ctx))}${lazy}`;
};

/** Parent part muted, own segment emphasised; a route without its own segment is all muted. */
const pathHtml = (node: RouteNode, parent: string): string => {
    const prefix = parent === '/' ? '/' : `${parent}/`;
    if (node.fullPath === parent || !node.fullPath.startsWith(prefix)) {
        return `<span class="cdx-routes-path-parent">${esc(node.fullPath)}</span>`;
    }
    const own = node.fullPath.slice(prefix.length);
    return `<span class="cdx-routes-path-parent">${esc(prefix)}</span><span class="cdx-routes-path-own">${esc(own)}</span>`;
};

const targetCell = (node: RouteNode, ctx: Ctx): string => {
    const parts: string[] = [];
    if (node.component) {
        parts.push(targetHtml(node.component, ctx));
    }
    if (node.childrenFrom) {
        parts.push(targetHtml(node.childrenFrom, ctx));
    }
    if (node.builtBy) {
        parts.push(`${esc(t('built-by'))} ${refHtml(node.builtBy, ctx)}`);
    }
    if (node.redirectTo) {
        parts.push(
            `<span class="cdx-routes-redirect">-&gt; ${esc(t('redirect'))}</span> ${valueHtml(node.redirectTo, ctx)}`
        );
    }
    if (node.outlet) {
        parts.push(
            `<span class="cdx-routes-outlet">${esc(t('route-outlet'))} ${code(node.outlet)}</span>`
        );
    }
    if (node.matcher) {
        parts.push(refHtml(node.matcher, ctx));
    }
    return parts.join('<br />');
};

const guardsCell = (node: RouteNode, ctx: Ctx): string =>
    GUARD_KEYS.filter(key => node.guards[key].length > 0)
        .map(
            key =>
                `<div class="cdx-routes-guard"><span class="cdx-routes-guard-key">${key}</span> ${node.guards[
                    key
                ]
                    .map(ref => refHtml(ref, ctx))
                    .join(' ')}</div>`
        )
        .join('');

const resolveCell = (node: RouteNode, ctx: Ctx): string =>
    node.resolve.map(entry => `<div>${code(entry.key)}: ${refHtml(entry.ref, ctx)}</div>`).join('');

const dataCell = (node: RouteNode): string =>
    node.data === undefined
        ? ''
        : `<details class="cdx-routes-data"><summary>${esc(t('route-data'))}</summary>${highlightedCodeWrap(node.data)}</details>`;

interface Column {
    readonly key: string;
    readonly label: string;
    readonly cell: (node: RouteNode, ctx: Ctx) => string;
    readonly has: (node: RouteNode) => boolean;
}

const COLUMNS: readonly Column[] = [
    {
        key: 'guards',
        label: 'guards',
        cell: guardsCell,
        has: node => GUARD_KEYS.some(key => node.guards[key].length > 0)
    },
    {
        key: 'resolve',
        label: 'route-resolve',
        cell: resolveCell,
        has: node => node.resolve.length > 0
    },
    {
        key: 'title',
        label: 'route-title',
        cell: (node, ctx) => (node.title ? valueHtml(node.title, ctx) : ''),
        has: node => node.title !== undefined
    },
    {
        key: 'providers',
        label: 'providers',
        cell: (node, ctx) => node.providers.map(ref => refHtml(ref, ctx)).join(' '),
        has: node => node.providers.length > 0
    },
    { key: 'data', label: 'route-data', cell: dataCell, has: node => node.data !== undefined }
];

interface Row {
    readonly node: RouteNode;
    readonly parent: string;
    readonly depth: number;
}

const flatten = (nodes: readonly RouteNode[], parent: string, depth: number): Row[] =>
    nodes.flatMap(node => [
        { node, parent, depth },
        ...flatten(node.children, node.fullPath, depth + 1)
    ]);

/** Visual indentation stops at this depth; deeper rows share its indent. */
const MAX_INDENT = 6;

const RouteRow = (row: Row, columns: readonly Column[], ctx: Ctx): string =>
    `<tr id="${routeAnchor(row.node.id)}" class="cdx-routes-row cdx-routes-depth-${Math.min(row.depth, MAX_INDENT)}" data-cdx-route-depth="${row.depth}">` +
    `<td class="cdx-routes-path">${pathHtml(row.node, row.parent)}<a class="cdx-member-permalink" href="#${routeAnchor(row.node.id)}" aria-label="${esc(row.node.fullPath)}">#</a></td>` +
    `<td class="cdx-routes-target">${targetCell(row.node, ctx)}</td>` +
    columns
        .map(column => `<td class="cdx-routes-${column.key}">${column.cell(row.node, ctx)}</td>`)
        .join('') +
    `</tr>`;

const rootTitle = (root: RouteRoot): string => {
    if (root.kind === 'unmounted') {
        return `${t('unmounted-routes')}${root.arrayName ? ` ${root.arrayName}` : ''}`;
    }
    const file = root.bootstraps[0]?.file;
    return file ? `${t('router')} ${file.slice(file.lastIndexOf('/') + 1)}` : t('router');
};

const Meta = (root: RouteRoot, ctx: Ctx): string => {
    const items: string[] = [];
    for (const bootstrap of root.bootstraps) {
        const component = bootstrap.componentName
            ? ` ${linked(code(bootstrap.componentName), symbolHref(bootstrap.component, ctx))}`
            : '';
        items.push(
            `<div><dt>${esc(t('bootstrap'))}</dt><dd>${code(`${bootstrap.file}:${bootstrap.line}`)}${component}</dd></div>`
        );
    }
    if (root.configName) {
        items.push(
            `<div><dt>${esc(t('configuration'))}</dt><dd>${linked(code(root.configName), symbolHref(root.config, ctx))}</dd></div>`
        );
    }
    if (root.arrayName) {
        items.push(
            `<div><dt>${esc(t('route-array'))}</dt><dd>${linked(code(root.arrayName), symbolHref(root.array, ctx))}</dd></div>`
        );
    }
    if (root.features.length > 0) {
        items.push(
            `<div><dt>${esc(t('router-features'))}</dt><dd>${root.features.map(ref => refHtml(ref, ctx)).join(' ')}</dd></div>`
        );
    }
    return items.length > 0 ? `<dl class="cdx-routes-meta">${items.join('')}</dl>` : '';
};

const RootSection = (root: RouteRoot, ctx: Ctx): string => {
    const rows = flatten(root.routes, '/', 0);
    const columns = COLUMNS.filter(column => rows.some(row => column.has(row.node)));
    const anchor = routeAnchor(root.id);
    return (
        `<section class="cdx-content-section cdx-routes-root" data-compodoc="routes-root" data-cdx-route-kind="${root.kind}">` +
        `<h2 class="cdx-section-heading" id="${anchor}">${esc(rootTitle(root))}<a class="cdx-member-permalink" href="#${anchor}">#</a></h2>` +
        Meta(root, ctx) +
        `<div class="cdx-routes-table-wrap"><table class="cdx-table cdx-routes-table">` +
        `<thead><tr><th scope="col">${esc(t('full-path'))}</th><th scope="col">${esc(t('route-target'))}</th>` +
        columns.map(column => `<th scope="col">${esc(t(column.label))}</th>`).join('') +
        `</tr></thead><tbody>` +
        rows.map(row => RouteRow(row, columns, ctx)).join('') +
        `</tbody></table></div></section>`
    );
};

/**
 * The routes page (`routes.html`): one section per router and per unmounted
 * route array, each a table of its routes in tree order (indented by depth),
 * with targets, guards, resolvers, titles, providers and data. Empty columns
 * are left out per section. Needs no script. Override name: `routes`.
 */
export const Routes = (props: RoutesPageData): string => {
    const ctx: Ctx = { depth: props.depth, table: props.symbols, di: props.di };
    const roots = props.routing?.roots ?? [];
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-primary)">
                <h1 class="cdx-entity-hero-name">{t('routes')}</h1>
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--count">{props.routing?.count ?? 0}</span>
                </div>
            </div>
            {roots.map(root => RootSection(root, ctx)).join('')}
        </>
    ) as string;
};
