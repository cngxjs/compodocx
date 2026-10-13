import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import type { SymbolId } from '../../../../src/app/links/symbol-id';
import {
    extractRoutes,
    type RouteArrayDeclaration,
    type RouteEnv,
    type RouteNode,
    type RouteNote,
    routeArrayDeclarations,
    unresolvedLazy
} from '../../../../src/app/routing';
import { memoryProgram } from './program';

const ROUTER = `import { Route, Routes } from '@angular/router';\n`;

/** Routes of the last route array of `/p/app.ts`. */
const extract = (
    files: Record<string, string>
): { routes: readonly RouteNode[]; notes: RouteNote[] } => {
    const program = memoryProgram(files);
    const checker = program.getTypeChecker();
    const env: RouteEnv = {
        checker,
        cwd: '/p',
        symbolOf: node => {
            const name = (node as ts.NamedDeclaration).name;
            return name && ts.isIdentifier(name)
                ? (`sym:${node.getSourceFile().fileName.slice(3)}#${name.text}` as SymbolId)
                : undefined;
        },
        lazy: unresolvedLazy
    };
    const sourceFile = program.getSourceFile('/p/app.ts') as ts.SourceFile;
    const first = routeArrayDeclarations(sourceFile).at(-1) as RouteArrayDeclaration;
    const notes: RouteNote[] = [];
    const array = env.symbolOf(first.node);
    const routes = extractRoutes(
        env,
        { expression: first.initializer, ...(array ? { array } : {}) },
        { fullPath: '/', id: '0' },
        notes
    );
    return { routes, notes };
};

const paths = (nodes: readonly RouteNode[]): string[] =>
    nodes.flatMap(node => [node.fullPath, ...paths(node.children)]);

describe('route extraction', () => {
    it('reads every route field', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}
class Page {}
const guardA = () => true;
const resolveUser = () => 'u';
function provideX() { return []; }
export const routes: Routes = [{
    path: 'page',
    pathMatch: 'prefix',
    outlet: 'aside',
    component: Page,
    title: 'Page',
    canActivate: [guardA],
    canActivateChild: [guardA],
    canDeactivate: [guardA],
    canMatch: [guardA],
    canLoad: [guardA],
    resolve: { user: resolveUser },
    providers: [provideX()],
    data: { flag: true },
    runGuardsAndResolvers: 'always'
}];`
        });
        const [node] = routes;
        expect(node.path).toEqual({ kind: 'literal', text: 'page' });
        expect(node.fullPath).toBe('/page');
        expect(node.pathMatch).toBe('prefix');
        expect(node.outlet).toBe('aside');
        expect(node.component).toMatchObject({ kind: 'symbol', name: 'Page', lazy: false });
        expect(node.component?.symbol).toBe('sym:app.ts#Page');
        expect(node.title).toEqual({ kind: 'literal', text: 'Page' });
        for (const key of [
            'canActivate',
            'canActivateChild',
            'canDeactivate',
            'canMatch',
            'canLoad'
        ] as const) {
            expect(node.guards[key].map(ref => ref.name)).toEqual(['guardA']);
        }
        expect(node.resolve).toEqual([
            {
                key: 'user',
                ref: {
                    name: 'resolveUser',
                    symbol: 'sym:app.ts#resolveUser',
                    source: 'resolveUser',
                    call: false
                }
            }
        ]);
        expect(node.providers).toEqual([
            { name: 'provideX', symbol: 'sym:app.ts#provideX', source: 'provideX()', call: true }
        ]);
        expect(node.data).toBe('{ flag: true }');
        expect(node.runGuardsAndResolvers).toBe("'always'");
        expect(node.array).toBe('sym:app.ts#routes');
        expect(node.file).toBe('app.ts');
        expect(node.line).toBe(7);
    });

    it('always has the five guard keys', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [{ path: 'a' }];`
        });
        expect(routes[0].guards).toEqual({
            canActivate: [],
            canActivateChild: [],
            canDeactivate: [],
            canMatch: [],
            canLoad: []
        });
        expect(routes[0].resolve).toEqual([]);
        expect(routes[0].providers).toEqual([]);
    });

    it('joins full paths: empty path, params and the wildcard', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [
    { path: '', redirectTo: 'users', pathMatch: 'full' },
    { path: 'users', children: [
        { path: '' },
        { path: ':id', children: [{ path: 'edit' }] }
    ] },
    { path: '**', redirectTo: 'users' }
];`
        });
        expect(paths(routes)).toEqual([
            '/',
            '/users',
            '/users',
            '/users/:id',
            '/users/:id/edit',
            '/**'
        ]);
        expect(routes[0].redirectTo).toEqual({ kind: 'literal', text: 'users' });
        expect(routes[0].pathMatch).toBe('full');
    });

    it('numbers nodes by their index path', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [{ path: 'a' }, { path: 'b', children: [{ path: 'c' }] }];`
        });
        expect(routes.map(n => n.id)).toEqual(['0-0', '0-1']);
        expect(routes[1].children[0].id).toBe('0-1-0');
    });

    it('follows spreads of route arrays, imported under an alias too', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}import { ADMIN as AdminRoutes } from './admin';
const LOCAL = [{ path: 'local' }];
export const r: Routes = [...LOCAL, ...AdminRoutes, { path: 'last' }];`,
            '/p/admin.ts': `${ROUTER}export const ADMIN: Routes = [{ path: 'admin' }, { path: 'audit' }];`
        });
        expect(routes.map(n => n.fullPath)).toEqual(['/local', '/admin', '/audit', '/last']);
        expect(routes.map(n => n.id)).toEqual(['0-0', '0-1', '0-2', '0-3']);
        expect(routes[1].array).toBe('sym:admin.ts#ADMIN');
        expect(routes[1].file).toBe('admin.ts');
        expect(routes[3].array).toBe('sym:app.ts#r');
    });

    it('follows a children identifier', () => {
        const { routes, notes } = extract({
            '/p/app.ts': `${ROUTER}const CHILDREN: Routes = [{ path: 'x' }];
export const r: Routes = [{ path: 'p', children: CHILDREN }];`
        });
        expect(notes).toEqual([]);
        expect(routes[0].children.map(n => n.fullPath)).toEqual(['/p/x']);
        expect(routes[0].children[0].array).toBe('sym:app.ts#CHILDREN');
    });

    it('keeps a list built by a call as one node', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}function build(p: string): Route[] { return []; }
export const r: Routes = [{ path: 'reports', children: build('daily') }, ...build('x')];`
        });
        expect(routes[0].children).toHaveLength(1);
        expect(routes[0].children[0]).toMatchObject({
            path: null,
            fullPath: "/reports/{build('daily')}",
            builtBy: { name: 'build', source: "build('daily')", call: true }
        });
        expect(routes[1]).toMatchObject({ fullPath: "/{build('x')}", id: '0-1' });
    });

    it('notes unknown keys and skips unknown elements', () => {
        const { routes, notes } = extract({
            '/p/app.ts': `${ROUTER}const other = 1;
export const r: Routes = [{ path: 'a', colour: 'red' }, other as any, { path: 'b' }];`
        });
        expect(routes.map(n => n.fullPath)).toEqual(['/a', '/b']);
        expect(routes.map(n => n.id)).toEqual(['0-0', '0-1']);
        expect(notes.map(n => n.what)).toEqual([
            'unknown route key: colour',
            'route element not read: other as any'
        ]);
    });

    it('keeps a guard call as source with the callee linked', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export function roleGuard(...r: string[]) { return () => true; }
export const r: Routes = [{ path: 'a', canActivate: [roleGuard('admin', 'owner')] }];`
        });
        expect(routes[0].guards.canActivate).toEqual([
            {
                name: 'roleGuard',
                symbol: 'sym:app.ts#roleGuard',
                source: "roleGuard('admin', 'owner')",
                call: true
            }
        ]);
    });

    it('reads redirect and title functions as references', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const toHome = () => 'home';
export function helpTitle() { return 'Help'; }
export const r: Routes = [
    { path: 'a', redirectTo: toHome },
    { path: 'b', redirectTo: () => '/x', title: helpTitle }
];`
        });
        expect(routes[0].redirectTo).toEqual({
            name: 'toHome',
            symbol: 'sym:app.ts#toHome',
            source: 'toHome',
            call: false
        });
        expect(routes[1].redirectTo).toEqual({ name: '', source: "() => '/x'", call: false });
        expect(routes[1].title).toMatchObject({ name: 'helpTitle', call: false });
    });

    it('evaluates enum members, consts and templates of consts; keeps the rest as source', () => {
        const { routes, notes } = extract({
            '/p/app.ts': `${ROUTER}enum Section { Home = 'home' }
const ACCOUNT = 'account';
class Paths { static about = 'about'; }
const PATHS = { help: 'help' };
const FULL = { full: 'full' };
export const r: Routes = [
    { path: Section.Home },
    { path: \`\${ACCOUNT}/edit\` },
    { path: Paths.about },
    { path: PATHS.help, pathMatch: FULL.full }
];`
        });
        expect(routes.map(n => n.path)).toEqual([
            { kind: 'literal', text: 'home' },
            { kind: 'literal', text: 'account/edit' },
            { kind: 'dynamic', source: 'Paths.about' },
            { kind: 'dynamic', source: 'PATHS.help' }
        ]);
        expect(routes.map(n => n.fullPath)).toEqual([
            '/home',
            '/account/edit',
            '/{Paths.about}',
            '/{PATHS.help}'
        ]);
        expect(routes[3].pathMatch).toBeUndefined();
        expect(notes.map(n => n.what)).toEqual(['pathMatch not evaluated: FULL.full']);
    });

    it('builds the full path of a matcher route from the matcher', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export function legacy() { return null; }
export const r: Routes = [{ matcher: legacy }];`
        });
        expect(routes[0]).toMatchObject({
            path: null,
            fullPath: '/{legacy}',
            matcher: { name: 'legacy', call: false }
        });
    });

    it('stops at a cycle', () => {
        const { routes, notes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [{ path: 'a', children: r }];`
        });
        expect(routes[0].children).toEqual([]);
        expect(notes.map(n => n.what)).toEqual(['route array cycle: r']);
    });

    it('leaves lazy targets unresolved without a resolver', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [
    { path: 'a', loadComponent: () => import('./a').then(m => m.A) },
    { path: 'b', loadChildren: () => import('./b') }
];`
        });
        expect(routes[0].component).toEqual({
            kind: 'unresolved',
            name: '',
            lazy: true,
            source: "() => import('./a').then(m => m.A)"
        });
        expect(routes[1].childrenFrom).toMatchObject({ kind: 'unresolved', lazy: true });
        expect(routes[1].children).toEqual([]);
    });

    it('reads a string component as unresolved', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}export const r: Routes = [{ path: 'a', component: 'Home' as any }];`
        });
        expect(routes[0].component).toEqual({
            kind: 'unresolved',
            name: '',
            lazy: false,
            source: "'Home' as any"
        });
    });

    it('reads shorthand properties', () => {
        const { routes } = extract({
            '/p/app.ts': `${ROUTER}const path = 'short';
export const r: Routes = [{ path }];`
        });
        expect(routes[0].fullPath).toBe('/short');
    });
});
