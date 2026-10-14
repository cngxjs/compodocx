import { describe, expect, it } from 'vitest';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import { buildSymbolTable } from '../../../../src/app/links/symbol-table';
import {
    emptyGuards,
    exportRoutes,
    indexRouting,
    type RouteNode,
    type RouteRoot,
    withRouteFacts
} from '../../../../src/app/routing';
import { emitRoutes } from '../../../../src/llm-md/routes';

const PAGE = 'component:src/page.ts#Page' as SymbolId;
const GUARD = 'function:src/guards.ts#roleGuard' as SymbolId;

const node = (fields: Partial<RouteNode>): RouteNode => ({
    id: '0-0',
    path: { kind: 'literal', text: 'a' },
    fullPath: '/a',
    children: [],
    guards: emptyGuards(),
    resolve: [],
    providers: [],
    file: 'src/routes.ts',
    line: 3,
    ...fields
});

const ROOT: RouteRoot = {
    id: '0',
    kind: 'router',
    bootstraps: [{ file: 'src/main.ts', line: 4, componentName: 'App' }],
    configName: 'appConfig',
    features: [{ name: 'withHashLocation', source: 'withHashLocation()', call: true }],
    arrayName: 'routes',
    routes: [
        node({
            component: {
                kind: 'symbol',
                name: 'Page',
                symbol: PAGE,
                lazy: true,
                source: '() => import(...)'
            },
            guards: {
                ...emptyGuards(),
                canActivate: [
                    { name: 'roleGuard', symbol: GUARD, source: "roleGuard('admin')", call: true }
                ]
            },
            data: '{ beta: true }',
            children: [
                node({
                    id: '0-0-0',
                    path: { kind: 'dynamic', source: 'PATHS.x' },
                    fullPath: '/a/{PATHS.x}',
                    redirectTo: { kind: 'literal', text: 'b' }
                })
            ]
        })
    ]
};

const TABLE = buildSymbolTable({
    components: [{ name: 'Page', file: 'src/page.ts' }],
    miscellaneous: { functions: [{ name: 'roleGuard', file: 'src/guards.ts' }] }
});

describe('route export', () => {
    it('writes names and declaring files, never symbol ids, and drops empty fields', () => {
        const [root] = exportRoutes(indexRouting([ROOT], []), TABLE);
        expect(root).toEqual({
            kind: 'router',
            bootstraps: [{ file: 'src/main.ts', line: 4, component: 'App' }],
            config: 'appConfig',
            features: [{ name: 'withHashLocation', source: 'withHashLocation()', call: true }],
            array: 'routes',
            routes: [
                {
                    path: 'a',
                    fullPath: '/a',
                    component: {
                        kind: 'symbol',
                        name: 'Page',
                        file: 'src/page.ts',
                        lazy: true,
                        source: '() => import(...)'
                    },
                    canActivate: [
                        {
                            name: 'roleGuard',
                            file: 'src/guards.ts',
                            source: "roleGuard('admin')",
                            call: true
                        }
                    ],
                    data: '{ beta: true }',
                    file: 'src/routes.ts',
                    line: 3,
                    children: [
                        {
                            path: 'PATHS.x',
                            pathDynamic: true,
                            fullPath: '/a/{PATHS.x}',
                            redirectTo: 'b',
                            file: 'src/routes.ts',
                            line: 3
                        }
                    ]
                }
            ]
        });
    });

    it('renders the llm-md routes as nested lists without data', () => {
        const text = emitRoutes(exportRoutes(indexRouting([ROOT], []), TABLE));
        expect(text).toBe(
            [
                '### Router (src/main.ts, appConfig)',
                '',
                'Router features: `withHashLocation()`',
                '',
                "- `/a` -> Page (lazy) canActivate: `roleGuard('admin')`",
                '  - `/a/{PATHS.x}` -> redirect b'
            ].join('\n')
        );
        expect(emitRoutes([])).toBe('');
    });

    it('prints pathMatch, matcher and runGuardsAndResolvers on the route line', () => {
        const text = emitRoutes([
            {
                kind: 'unmounted',
                array: 'R',
                routes: [
                    { path: '', fullPath: '/', file: 'f.ts', line: 1, pathMatch: 'full' },
                    {
                        path: null,
                        fullPath: '/{legacyMatcher}',
                        file: 'f.ts',
                        line: 2,
                        matcher: { name: 'legacyMatcher', file: 'f.ts', source: 'legacyMatcher' }
                    },
                    {
                        path: 'a',
                        fullPath: '/a',
                        file: 'f.ts',
                        line: 3,
                        runGuardsAndResolvers: "'always'"
                    }
                ]
            }
        ]);
        expect(text).toBe(
            [
                '### Unmounted routes (R)',
                '',
                '- `/` pathMatch: full',
                '- `/{legacyMatcher}` matcher: `legacyMatcher`',
                "- `/a` runGuardsAndResolvers: 'always'"
            ].join('\n')
        );
    });

    it('heads an unmounted root with its array', () => {
        const text = emitRoutes([
            {
                kind: 'unmounted',
                array: 'PARTNER_ROUTES',
                routes: [{ path: 'p', fullPath: '/p', file: 'f.ts', line: 1 }]
            }
        ]);
        expect(text).toBe('### Unmounted routes (PARTNER_ROUTES)\n\n- `/p`');
    });

    it('joins routedAt into components and mountedAt into route array variables', () => {
        const model = indexRouting(
            [
                {
                    ...ROOT,
                    routes: [
                        { ...ROOT.routes[0], array: 'variable:src/routes.ts#routes' as SymbolId }
                    ]
                }
            ],
            []
        );
        const table = buildSymbolTable({
            components: [
                { name: 'Page', file: 'src/page.ts' },
                { name: 'Other', file: 'src/o.ts' }
            ],
            miscellaneous: { variables: [{ name: 'routes', file: 'src/routes.ts' }] }
        });
        const join = withRouteFacts(model, table);
        expect(
            join(
                [
                    { name: 'Page', file: 'src/page.ts' },
                    { name: 'Other', file: 'src/o.ts' }
                ],
                'component'
            )
        ).toEqual([
            { name: 'Page', file: 'src/page.ts', routedAt: ['/a'] },
            { name: 'Other', file: 'src/o.ts' }
        ]);
        expect(join([{ name: 'routes', file: 'src/routes.ts' }], 'variable')).toEqual([
            { name: 'routes', file: 'src/routes.ts', mountedAt: ['/'] }
        ]);
        expect(withRouteFacts(undefined, table)([{ name: 'Page' }], 'component')).toEqual([
            { name: 'Page' }
        ]);
    });
});
