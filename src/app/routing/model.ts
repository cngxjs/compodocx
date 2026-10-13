import type { SymbolId } from '../links/symbol-id';

/** A route field value: a string the checker knows, or the source text of an expression it cannot evaluate. */
export type RouteValue =
    | { readonly kind: 'literal'; readonly text: string }
    | { readonly kind: 'dynamic'; readonly source: string };

/** A guard, resolver, title or redirect function, matcher, provider or router feature. */
export interface RouteRef {
    /** Callee or identifier name; `''` for an inline function. */
    readonly name: string;
    /** Set when the name resolves to a documented symbol. */
    readonly symbol?: SymbolId;
    /** Exact source text, e.g. `roleGuard('admin', 'superadmin')`. */
    readonly source: string;
    /** True for a call expression. */
    readonly call: boolean;
}

/** What a route renders (`component` / `loadComponent`) or loads (`loadChildren`). */
export interface RouteTarget {
    readonly kind: 'symbol' | 'routes' | 'external' | 'unresolved';
    /** Exported name; a default export is named by its declaration, else `default`. */
    readonly name: string;
    /** The component (kind `symbol`) or route array variable (kind `routes`), when documented. */
    readonly symbol?: SymbolId;
    /** Module specifier of a lazy import. */
    readonly specifier?: string;
    readonly lazy: boolean;
    readonly source: string;
}

export const GUARD_KEYS = [
    'canActivate',
    'canActivateChild',
    'canDeactivate',
    'canMatch',
    'canLoad'
] as const;

export type GuardKey = (typeof GUARD_KEYS)[number];

export interface RouteNode {
    /** Stable within one build: root index and child index path (`0.2.1`). */
    readonly id: string;
    /** `null` for a route with only a `matcher` and for a runtime-built child list. */
    readonly path: RouteValue | null;
    /** Parent full path + own path, dynamic segments as `{source}`; the root is `/`. */
    readonly fullPath: string;
    readonly pathMatch?: 'full' | 'prefix';
    readonly matcher?: RouteRef;
    readonly outlet?: string;
    /** `component` or `loadComponent`. */
    readonly component?: RouteTarget;
    /** `loadChildren`. */
    readonly childrenFrom?: RouteTarget;
    /** Inline children, spreads followed, plus an expanded `loadChildren` route array. */
    readonly children: readonly RouteNode[];
    /** The call that builds this node's routes at runtime (a child list returned by a function). */
    readonly builtBy?: RouteRef;
    /** A string, or a redirect function. */
    readonly redirectTo?: RouteValue | RouteRef;
    /** A string, or a title resolver. */
    readonly title?: RouteValue | RouteRef;
    readonly guards: Readonly<Record<GuardKey, readonly RouteRef[]>>;
    readonly resolve: readonly { readonly key: string; readonly ref: RouteRef }[];
    readonly providers: readonly RouteRef[];
    /** Source text of the `data` value. */
    readonly data?: string;
    /** Source text of the `runGuardsAndResolvers` value. */
    readonly runGuardsAndResolvers?: string;
    /** The route array variable this route literal belongs to. */
    readonly array?: SymbolId;
    /** Declaring file, relative to the cwd. */
    readonly file: string;
    readonly line: number;
}

export interface RouteBootstrap {
    readonly file: string;
    readonly line: number;
    readonly component?: SymbolId;
    /** Name of the bootstrapped component as written. */
    readonly componentName?: string;
}

export interface RouteRoot {
    readonly id: string;
    readonly kind: 'router' | 'unmounted';
    readonly bootstraps: readonly RouteBootstrap[];
    /** The application config variable holding the `provideRouter` call, when named. */
    readonly config?: SymbolId;
    readonly configName?: string;
    /** `provideRouter(routes, ...features)`. */
    readonly features: readonly RouteRef[];
    /** The routes argument (router) or the array itself (unmounted), when it is a named array. */
    readonly array?: SymbolId;
    readonly arrayName?: string;
    readonly routes: readonly RouteNode[];
}

/** Something the model skipped or could not follow. Logged at debug level. */
export interface RouteNote {
    readonly file: string;
    readonly line: number;
    readonly what: string;
}

export interface RoutingModel {
    readonly roots: readonly RouteRoot[];
    /** Route nodes over all roots. */
    readonly count: number;
    /** Component -> ids of the route nodes rendering it. */
    readonly byTarget: ReadonlyMap<SymbolId, readonly string[]>;
    /** Route array variable -> full paths it is mounted at. */
    readonly mountedAt: ReadonlyMap<SymbolId, readonly string[]>;
    readonly notes: readonly RouteNote[];
}

export const emptyGuards = (): Record<GuardKey, readonly RouteRef[]> => ({
    canActivate: [],
    canActivateChild: [],
    canDeactivate: [],
    canMatch: [],
    canLoad: []
});

export const EMPTY_ROUTING: RoutingModel = {
    roots: [],
    count: 0,
    byTarget: new Map(),
    mountedAt: new Map(),
    notes: []
};

/** `parent/own`; `''` adds nothing, the root is `/`. */
export const joinPath = (parent: string, own: string): string => {
    if (own === '') {
        return parent;
    }
    return parent === '/' ? `/${own}` : `${parent}/${own}`;
};

/** The full-path segment of a value: the text, or `{source}` when dynamic. */
export const pathSegment = (value: RouteValue): string =>
    value.kind === 'literal' ? value.text : `{${value.source}}`;
