import { beforeAll, describe, expect, it } from 'vitest';

import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import { emptyGuards, type RouteNode, type RouteRoot } from '../../../../src/app/routing';
import { featureRouteRows, RouteTree } from '../../../../src/templates/pages/Routes';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const USERS = 'component:src/users.ts#Users' as SymbolId;
const AUDIT = 'component:src/audit.ts#Audit' as SymbolId;

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

const target = (name: string, symbol: SymbolId) => ({
    kind: 'symbol' as const,
    name,
    symbol,
    lazy: false,
    source: name
});

const root: RouteRoot = {
    id: '0',
    kind: 'router',
    bootstraps: [],
    features: [],
    routes: [
        node('0-0', '/home'),
        node('0-1', '/admin', {
            guards: {
                ...emptyGuards(),
                canMatch: [{ name: 'adminMatch', source: 'adminMatch', call: false }]
            },
            children: [
                node('0-1-0', '/admin/users', { component: target('Users', USERS) }),
                node('0-1-1', '/admin/audit', {
                    children: [
                        node('0-1-1-0', '/admin/audit', { component: target('Audit', AUDIT) })
                    ]
                }),
                node('0-1-2', '/admin/other')
            ]
        })
    ]
};

const members = new Set([USERS, AUDIT]);

describe('feature routes', () => {
    it('keeps the routes of the feature and their parents as context, in tree order', () => {
        const rows = featureRouteRows([root], id => members.has(id));
        expect(rows.map(row => [row.node.id, row.depth, row.context])).toEqual([
            ['0-1', 0, true],
            ['0-1-0', 1, false],
            ['0-1-1', 1, true],
            ['0-1-1-0', 2, false]
        ]);
    });

    it('renders the tree with each path linked to its row on the routes page', () => {
        const rows = featureRouteRows([root], id => members.has(id));
        const html = RouteTree(rows, {
            depth: 1,
            table: buildSymbolTable({ components: [] }),
            linkRows: true
        }).replace(/ __(self|source)="[^"]*"/g, '');
        expect(html).toContain('<ol class="cdx-routes-tree">');
        expect(html).toContain(
            '<li data-cdx-route="0-1" class="cdx-routes-row cdx-routes-depth-0 cdx-routes-row--context" data-cdx-route-depth="0">'
        );
        expect(html).toContain(
            '<a class="cdx-routes-path-link" href="../routes.html#route-0-1-0"><span class="cdx-routes-path-slash">/</span><span class="cdx-routes-path-own">users</span></a>'
        );
        expect(html).toContain('data-cdx-route-fact="canMatch"');
        expect(html).not.toContain('id="route-');
        expect(html).not.toContain('cdx-member-permalink');
    });

    it('has no rows without a route of the feature', () => {
        expect(featureRouteRows([root], () => false)).toEqual([]);
    });
});
