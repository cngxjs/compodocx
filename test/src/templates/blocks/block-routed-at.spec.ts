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
                { name: 'other', file: 'src/other.ts' }
            ]
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
                    node('0-1', '/b', { array: ROUTES })
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

describe('Routed at / Mounted at', () => {
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
