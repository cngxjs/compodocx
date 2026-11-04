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
import { HeroCounts } from '../components/HeroCounts';
import { IconGitBranch } from '../components/Icons';
import { highlightedCodeWrap, pagefindMetaBlock, t } from '../helpers';

/** What the `routes` override receives besides the main data. */
export interface RoutesPageData {
    readonly depth: number;
    readonly routing?: RoutingModel;
    readonly symbols?: SymbolTable;
    readonly di?: DiView;
}

/** What a route tree needs to render. */
export interface RouteTreeContext {
    readonly depth: number;
    readonly table?: SymbolTable;
    readonly di?: DiView;
    /**
     * Link each path to its row on the routes page instead of anchoring the
     * row itself (a route tree on another page, e.g. a feature page).
     */
    readonly linkRows?: boolean;
}

type Ctx = RouteTreeContext;

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

/** Path text with a break opportunity after every slash, so long paths wrap at segments. */
const pathText = (text: string): string => esc(text).replaceAll('/', '/<wbr />');

/** Segment text with dynamic parts (`{source}`) set apart from literal ones. */
const segmentHtml = (text: string): string =>
    text
        .split(/(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/)
        .filter(part => part !== '')
        .map(part =>
            part.startsWith('{') && part.endsWith('}')
                ? `<span class="cdx-routes-path-dynamic">${pathText(part)}</span>`
                : pathText(part)
        )
        .join('');

/**
 * A top-level route shows its full path; a nested route only its own
 * segment (its parent is the row above it), `''` for an empty path. A
 * route whose path does not extend its parent's shows its full path.
 */
const pathHtml = (node: RouteNode, parent: string, depth: number): string => {
    const prefix = parent === '/' ? '/' : `${parent}/`;
    const extendsParent = node.fullPath !== parent && node.fullPath.startsWith(prefix);
    if (depth > 0 && node.fullPath === parent) {
        return `<span class="cdx-routes-path-empty">''</span>`;
    }
    const own = extendsParent ? node.fullPath.slice(prefix.length) : node.fullPath;
    const lead = extendsParent ? '/' : '';
    const slash = lead ? `<span class="cdx-routes-path-slash">${lead}</span>` : '';
    return `${slash}<span class="cdx-routes-path-own">${segmentHtml(own)}</span>`;
};

const targetHtmlOf = (node: RouteNode, ctx: Ctx): string => {
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
    return parts.map(part => `<span class="cdx-routes-target-part">${part}</span>`).join('');
};

/** One fact of a route: the route property it comes from and its values. */
const fact = (key: string, values: string): string =>
    `<li class="cdx-routes-fact" data-cdx-route-fact="${esc(key)}"><span class="cdx-routes-fact-key">${esc(key)}</span>${values}</li>`;

/** Guards, resolvers, title and providers of a route, each under its route property. */
const factsHtml = (node: RouteNode, ctx: Ctx): string => {
    const facts = [
        ...GUARD_KEYS.filter(key => node.guards[key].length > 0).map(key =>
            fact(key, node.guards[key].map(ref => refHtml(ref, ctx)).join(''))
        ),
        ...node.resolve.map(entry =>
            fact('resolve', `${code(`${entry.key}:`)} ${refHtml(entry.ref, ctx)}`)
        ),
        ...(node.title ? [fact('title', valueHtml(node.title, ctx))] : []),
        ...(node.providers.length > 0
            ? [fact('providers', node.providers.map(ref => refHtml(ref, ctx)).join(''))]
            : [])
    ];
    return facts.length > 0 ? `<ul class="cdx-routes-facts">${facts.join('')}</ul>` : '';
};

const dataHtml = (node: RouteNode): string =>
    node.data === undefined
        ? ''
        : `<details class="cdx-routes-data"><summary>${esc(t('route-data'))}</summary>${highlightedCodeWrap(node.data)}</details>`;

/** One route of a tree, with the full path of its parent and its depth. */
export interface RouteRow {
    readonly node: RouteNode;
    readonly parent: string;
    readonly depth: number;
    /** Shown for context only: the parent of a route the tree is about. */
    readonly context?: boolean;
}

type Row = RouteRow;

const flatten = (nodes: readonly RouteNode[], parent: string, depth: number): Row[] =>
    nodes.flatMap(node => [
        { node, parent, depth },
        ...flatten(node.children, node.fullPath, depth + 1)
    ]);

/**
 * The routes whose component or lazily loaded route array is a member
 * (`isMember`), with the routes above them as context, in tree order.
 */
export const featureRouteRows = (
    roots: readonly RouteRoot[],
    isMember: (id: SymbolId) => boolean
): RouteRow[] => {
    const owns = (node: RouteNode): boolean =>
        [node.component, node.childrenFrom].some(
            target => target?.symbol !== undefined && isMember(target.symbol)
        );
    const rowsOf = (nodes: readonly RouteNode[], parent: string, depth: number): RouteRow[] =>
        nodes.flatMap(node => {
            const below = rowsOf(node.children, node.fullPath, depth + 1);
            if (owns(node)) {
                return [{ node, parent, depth, context: false }, ...below];
            }
            return below.length > 0 ? [{ node, parent, depth, context: true }, ...below] : [];
        });
    return roots.flatMap(root => rowsOf(root.routes, '/', 0));
};

/** Visual indentation stops at this depth; deeper rows share its indent. */
const MAX_INDENT = 6;

/** The path cell: anchored on the routes page, linked to it elsewhere. */
const pathCell = (row: Row, ctx: Ctx): string => {
    const anchor = routeAnchor(row.node.id);
    const path = pathHtml(row.node, row.parent, row.depth);
    const body = ctx.linkRows
        ? `<a class="cdx-routes-path-link" href="${esc(hrefText(hrefFor({ type: 'root', page: 'routes' }, ctx.depth, anchor)))}">${path}</a>`
        : `${path}<a class="cdx-member-permalink" href="#${anchor}" aria-label="${esc(row.node.fullPath)}">#</a>`;
    return `<div class="cdx-routes-path" title="${esc(row.node.fullPath)}">${body}</div>`;
};

const RouteRowHtml = (row: Row, ctx: Ctx): string => {
    const at = ctx.linkRows
        ? `data-cdx-route="${row.node.id}"`
        : `id="${routeAnchor(row.node.id)}"`;
    const classes = [
        'cdx-routes-row',
        `cdx-routes-depth-${Math.min(row.depth, MAX_INDENT)}`,
        ...(row.context ? ['cdx-routes-row--context'] : [])
    ].join(' ');
    return (
        `<li ${at} class="${classes}" data-cdx-route-depth="${row.depth}">` +
        pathCell(row, ctx) +
        `<div class="cdx-routes-detail"><div class="cdx-routes-target">${targetHtmlOf(row.node, ctx)}</div>` +
        factsHtml(row.node, ctx) +
        dataHtml(row.node) +
        `</div></li>`
    );
};

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

/**
 * A list of routes in tree order (indented by depth): the path, the target,
 * and the guards, resolvers, title and providers as facts, plus the data.
 */
export const RouteTree = (rows: readonly RouteRow[], ctx: RouteTreeContext): string =>
    `<ol class="cdx-routes-tree">${rows.map(row => RouteRowHtml(row, ctx)).join('')}</ol>`;

const RootSection = (root: RouteRoot, ctx: Ctx): string => {
    const rows = flatten(root.routes, '/', 0);
    const anchor = routeAnchor(root.id);
    return (
        `<section class="cdx-content-section cdx-routes-root" data-compodoc="routes-root" data-cdx-route-kind="${root.kind}">` +
        `<h2 class="cdx-section-heading" id="${anchor}">${esc(rootTitle(root))}<a class="cdx-member-permalink" href="#${anchor}">#</a></h2>` +
        Meta(root, ctx) +
        RouteTree(rows, ctx) +
        `</section>`
    );
};

/**
 * The routes page (`routes.html`): one section per router and per unmounted
 * route array, each a list of its routes in tree order (indented by depth):
 * the full path, the target, and the guards, resolvers, title and providers
 * as facts named by their route property, plus the route data. Needs no
 * script. Override name: `routes`.
 */
export const Routes = (props: RoutesPageData): string => {
    const ctx: Ctx = { depth: props.depth, table: props.symbols, di: props.di };
    const roots = props.routing?.roots ?? [];
    const routers = roots.filter(root => root.kind === 'router').length;
    const rows = roots.flatMap(root => flatten(root.routes, '/', 0));
    const lazy = rows.filter(row => row.node.component?.lazy || row.node.childrenFrom?.lazy);
    return (
        <>
            <div
                class="cdx-entity-hero"
                style="--cdx-hero-color: var(--color-cdx-entity-component)"
            >
                {pagefindMetaBlock({ kind: 'route' })}
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconGitBranch()}
                </div>
                <h1 class="cdx-entity-hero-name">
                    <span>{t('routes')}</span>
                </h1>
                <p class="cdx-entity-hero-description">{t('routes-description')}</p>
                {HeroCounts([
                    [t('routes'), props.routing?.count ?? 0],
                    [t('router'), routers],
                    [t('unmounted-routes'), roots.length - routers],
                    [t('lazy-routes'), lazy.length]
                ])}
            </div>
            {roots.map(root => RootSection(root, ctx)).join('')}
        </>
    ) as string;
};
