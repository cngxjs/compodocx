import { beforeAll, describe, expect, it } from 'vitest';

import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import { emptyGuards, indexRouting, type RouteNode } from '../../../../src/app/routing';
import { BlockRoutedAt } from '../../../../src/templates/blocks/BlockRoutedAt';
import { routedAt } from '../../../../src/templates/helpers/routed-at';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const PAGE = 'component:src/page.ts#Page' as SymbolId;
const ROUTES = 'variable:src/routes.ts#routes' as SymbolId;
const PARTNERS = 'variable:src/partners.ts#PARTNERS' as SymbolId;
const AUTH = 'guard:src/guards.ts#authGuard' as SymbolId;
const USER = 'resolver:src/guards.ts#userResolver' as SymbolId;
const AUTH_ITEM = { name: 'authGuard', file: 'src/guards.ts', functionalKind: 'guard' };
const USER_ITEM = { name: 'userResolver', file: 'src/guards.ts', functionalKind: 'resolver' };

const ref = (name: string, symbol: SymbolId, source = name) => ({
    name,
    symbol,
    source,
    call: source !== name
});

const node = (id: string, fullPath: string, fields: Partial<RouteNode> = {}): RouteNode => ({
    id,
    path: { kind: 'literal', text: fullPath },
    fullPath,
    children: [],
    guards: emptyGuards(),
    resolve: [],
    providers: [],
    file: 'src/routes.ts',
    line: 1,
    ...fields
});

const data = {
    symbols: buildSymbolTable({
        components: [{ name: 'Page', file: 'src/page.ts' }],
        miscellaneous: {
            variables: [
                { name: 'routes', file: 'src/routes.ts' },
                { name: 'PARTNERS', file: 'src/partners.ts' },
                { name: 'other', file: 'src/other.ts' },
                AUTH_ITEM
            ],
            functions: [USER_ITEM]
        }
    }),
    routing: indexRouting(
        [
            {
                id: '0',
                kind: 'router',
                bootstraps: [],
                features: [],
                routes: [
                    node('0-0', '/a', {
                        array: ROUTES,
                        component: {
                            kind: 'symbol',
                            name: 'Page',
                            symbol: PAGE,
                            lazy: false,
                            source: 'Page'
                        }
                    }),
                    node('0-1', '/b', {
                        array: ROUTES,
                        guards: { ...emptyGuards(), canActivate: [ref('authGuard', AUTH)] },
                        children: [
                            node('0-1-0', '/b/c', {
                                guards: {
                                    ...emptyGuards(),
                                    canMatch: [ref('authGuard', AUTH, 'authGuard()')]
                                },
                                resolve: [{ key: 'user', ref: ref('userResolver', USER) }]
                            })
                        ]
                    })
                ]
            },
            {
                id: '1',
                kind: 'unmounted',
                bootstraps: [],
                features: [],
                array: PARTNERS,
                routes: [node('1-0', '/p', { array: PARTNERS })]
            }
        ],
        []
    )
};

describe('Routed at / Mounted at / Used in routes', () => {
    it('links the routes rendering a component', () => {
        const html = BlockRoutedAt(
            routedAt(data, 'component', { name: 'Page', file: 'src/page.ts' }, 1)
        );
        expect(html).toContain('id="routed-at"');
        expect(html).toContain('href="../routes.html#route-0-0"');
        expect(html).toContain('>/a</code>');
    });

    it('links the places a route array is mounted at, or its unmounted section', () => {
        const mounted = BlockRoutedAt(
            routedAt(data, 'variable', { name: 'routes', file: 'src/routes.ts' }, 0)
        );
        expect(mounted).toContain('Mounted at');
        expect(mounted).toContain('href="./routes.html#route-0-0"');
        expect(mounted).toContain('>/</code>');
        const unmounted = BlockRoutedAt(
            routedAt(data, 'variable', { name: 'PARTNERS', file: 'src/partners.ts' }, 0)
        );
        expect(unmounted).toContain('href="./routes.html#route-1"');
        expect(unmounted).toContain('>Unmounted routes</code>');
    });

    it('links the routes using a guard, each with its role', () => {
        const html = BlockRoutedAt(routedAt(data, 'variable', AUTH_ITEM, 1));
        expect(html).toContain('id="used-in-routes"');
        expect(html).toContain('Used in routes');
        expect(html).toContain('href="../routes.html#route-0-1"');
        expect(html).toContain('>/b - canActivate</code>');
        expect(html).toContain('href="../routes.html#route-0-1-0"');
        expect(html).toContain('>/b/c - canMatch</code>');
    });

    it('names the resolve key of a resolver', () => {
        const html = BlockRoutedAt(routedAt(data, 'function', USER_ITEM, 0));
        expect(html).toContain('href="./routes.html#route-0-1-0"');
        expect(html).toContain('>/b/c - resolve: user</code>');
    });

    it('passes the role to an override only for Used in routes', () => {
        const guard = routedAt(data, 'variable', AUTH_ITEM, 0);
        expect(guard?.links.map(link => link.role)).toEqual(['canActivate', 'canMatch']);
        const page = routedAt(data, 'component', { name: 'Page', file: 'src/page.ts' }, 0);
        expect(page?.links.every(link => link.role === undefined)).toBe(true);
    });

    it('renders nothing for a guard with routes disabled', () => {
        expect(
            BlockRoutedAt(routedAt({ ...data, disableRoutes: true }, 'variable', AUTH_ITEM, 0))
        ).toBe('');
    });

    it('renders nothing for a symbol outside every route, or with routes disabled', () => {
        expect(
            BlockRoutedAt(routedAt(data, 'variable', { name: 'other', file: 'src/other.ts' }, 0))
        ).toBe('');
        expect(
            BlockRoutedAt(
                routedAt(
                    { ...data, disableRoutes: true },
                    'component',
                    { name: 'Page', file: 'src/page.ts' },
                    0
                )
            )
        ).toBe('');
    });
});
