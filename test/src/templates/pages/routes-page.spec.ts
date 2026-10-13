import { beforeAll, describe, expect, it } from 'vitest';

import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import {
    emptyGuards,
    indexRouting,
    type RouteNode,
    type RouteRoot
} from '../../../../src/app/routing';
import { Routes } from '../../../../src/templates/pages/Routes';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const PAGE = 'component:src/page.ts#Page' as SymbolId;

const node = (id: string, fullPath: string, fields: Partial<RouteNode> = {}): RouteNode => ({
    id,
    path: { kind: 'literal', text: fullPath.slice(fullPath.lastIndexOf('/') + 1) },
    fullPath,
    children: [],
    guards: emptyGuards(),
    resolve: [],
    providers: [],
    file: 'src/routes.ts',
    line: 1,
    ...fields
});

const router: RouteRoot = {
    id: '0',
    kind: 'router',
    bootstraps: [{ file: 'src/main.ts', line: 3, componentName: 'App' }],
    configName: 'appConfig',
    features: [{ name: 'withHashLocation', source: 'withHashLocation()', call: true }],
    arrayName: 'routes',
    routes: [
        node('0-0', '/', {
            path: { kind: 'literal', text: '' },
            redirectTo: { kind: 'literal', text: 'home' }
        }),
        node('0-1', '/home', {
            component: {
                kind: 'symbol',
                name: 'Page',
                symbol: PAGE,
                lazy: true,
                source: '() => import(...)'
            },
            guards: {
                ...emptyGuards(),
                canActivate: [{ name: 'authGuard', source: 'authGuard', call: false }]
            },
            children: [node('0-1-0', '/home/detail')]
        }),
        node('0-2', '/remote', {
            childrenFrom: {
                kind: 'external',
                name: 'REMOTE',
                specifier: '@acme/remote',
                lazy: true,
                source: '...'
            }
        })
    ]
};

const unmounted: RouteRoot = {
    id: '1',
    kind: 'unmounted',
    bootstraps: [],
    features: [],
    arrayName: 'PARTNERS',
    routes: [node('1-0', '/partners', { data: "{ section: 'b2b' }" })]
};

const render = (roots: readonly RouteRoot[]): string =>
    Routes({
        depth: 0,
        routing: indexRouting(roots, []),
        symbols: buildSymbolTable({ components: [{ name: 'Page', file: 'src/page.ts' }] })
    });

describe('routes page', () => {
    it('renders one section per root with an anchored heading', () => {
        const html = render([router, unmounted]);
        expect(html).toContain('id="route-0"');
        expect(html).toContain('Router main.ts');
        expect(html).toContain('id="route-1"');
        expect(html).toContain('Unmounted routes PARTNERS');
        expect(html.match(/<tr id="route-/g)).toHaveLength(5);
        expect(html).toContain('<tr id="route-0-1-0" class="cdx-routes-row cdx-routes-depth-1"');
    });

    it('leaves out columns no route of the section uses', () => {
        const html = render([router]);
        expect(html).toContain('>Guards</th>');
        expect(html).not.toContain('>Data</th>');
        expect(html).not.toContain('>Resolve</th>');
        const partners = render([unmounted]);
        expect(partners).toContain('>Data</th>');
        expect(partners).not.toContain('>Guards</th>');
    });

    it('links a documented target and marks it lazy', () => {
        const html = render([router]);
        expect(html).toMatch(
            /<a href="[^"]*Page\.html"><code>Page<\/code><\/a> <span class="cdx-routes-lazy">lazy<\/span>/
        );
    });

    it('renders a redirect row', () => {
        expect(render([router])).toContain('-&gt; Redirect</span> <code>home</code>');
    });

    it('shows an external target by its specifier as code', () => {
        expect(render([router])).toContain('<code>@acme/remote</code> REMOTE');
    });

    it('lists the router features and the bootstrap', () => {
        const html = render([router]);
        expect(html).toContain(
            '<dt>Router features</dt><dd><span class="cdx-routes-ref"><code>withHashLocation()</code></span></dd>'
        );
        expect(html).toContain('<code>src/main.ts:3</code> <code>App</code>');
    });
});
