import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSemanticProgram } from '../../../../src/app/compiler/semantic';
import { buildSymbolTable } from '../../../../src/app/links/symbol-table';
import {
    buildRouting,
    declarationKey,
    lazyResolver,
    nameRouting,
    type RoutingModel
} from '../../../../src/app/routing';
import { routeTree } from './tree';

const ROUTER = `import { Routes } from '@angular/router';\n`;

const FILES: Record<string, string> = {
    'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ES2022', moduleResolution: 'bundler', target: 'ES2022' },
        include: ['src/**/*.ts']
    }),
    'src/main.ts': `import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from './routes';
export class App {}
bootstrapApplication(App, { providers: [provideRouter(routes)] });`,
    'src/routes.ts': `${ROUTER}import { roleGuard } from './guards';
export const routes: Routes = [
    { path: 'then', loadComponent: () => import('./pages/a').then(m => m.APage) },
    { path: 'destructure', loadComponent: () => import('./pages/a').then(({ APage }) => APage) },
    { path: 'await', loadComponent: async () => (await import('./pages/a')).APage },
    { path: 'default', loadComponent: () => import('./pages/b') },
    { path: 'reexport', loadComponent: () => import('./pages').then(m => m.APage) },
    { path: 'children', loadChildren: () => import('./feature/feature.routes').then(m => m.FEATURE) },
    { path: 'default-children', loadChildren: () => import('./feature/default.routes') },
    { path: 'package', loadChildren: () => import('@acme/remote').then(m => m.REMOTE) },
    { path: 'missing', loadChildren: () => import('./nowhere').then(m => m.X) },
    { path: 'call', loadChildren: makeLoader() },
    { path: 'guarded', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/a').then(m => m.APage) }
];
declare function makeLoader(): () => Promise<unknown>;`,
    'src/guards.ts': `export function roleGuard(role: string) { return () => role !== ''; }`,
    'src/pages/a.ts': `export class APage {}`,
    'src/pages/b.ts': `export default class BPage {}`,
    'src/pages/index.ts': `export { APage } from './a';`,
    'src/feature/feature.routes.ts': `${ROUTER}export const FEATURE: Routes = [{ path: 'inner', loadChildren: () => import('../feature/feature.routes').then(m => m.FEATURE) }];`,
    'src/feature/default.routes.ts': `import type { Route } from '@angular/router';
export default [{ path: 'x' }] as Route[];`
};

let dir: string;
let draft: RoutingModel;

beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-routing-'));
    for (const [file, text] of Object.entries(FILES)) {
        fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        fs.writeFileSync(path.join(dir, file), text);
    }
    const files = Object.keys(FILES)
        .filter(file => file.endsWith('.ts'))
        .map(file => path.join(dir, file));
    const program = createSemanticProgram(path.join(dir, 'tsconfig.json'), files);
    if (program.ok === false) {
        throw new Error(program.message);
    }
    const symbolOf = declarationKey(dir);
    draft = buildRouting({
        program: program.value,
        files,
        cwd: dir,
        symbolOf,
        lazy: notes => lazyResolver(program.value, symbolOf, dir, notes)
    });
});

afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
});

const line = (fullPath: string): string =>
    routeTree(draft)
        .split('\n')
        .find(l => l.trim().startsWith(`${fullPath} `)) ?? '';

describe('lazy route resolution', () => {
    it('reads the then, destructuring and await forms', () => {
        expect(line('/then')).toBe('  /then -> APage (lazy)');
        expect(line('/destructure')).toBe('  /destructure -> APage (lazy)');
        expect(line('/await')).toBe('  /await -> APage (lazy)');
    });

    it('names a default-exported class by its declaration', () => {
        expect(line('/default')).toBe('  /default -> BPage (lazy)');
    });

    it('follows a re-export to the declaring file', () => {
        const route = draft.roots[0].routes.find(r => r.fullPath === '/reexport');
        expect(route?.component).toMatchObject({ name: 'APage', symbol: 'src/pages/a.ts#APage' });
    });

    it('expands a lazy route array below its route', () => {
        const route = draft.roots[0].routes.find(r => r.fullPath === '/children');
        expect(route?.childrenFrom).toMatchObject({ kind: 'routes', name: 'FEATURE' });
        expect(route?.children.map(c => c.fullPath)).toEqual(['/children/inner']);
    });

    it('stops a lazy cycle with a note', () => {
        const inner = draft.roots[0].routes.find(r => r.fullPath === '/children')?.children[0];
        expect(inner?.children).toEqual([]);
        expect(draft.notes.some(n => n.what.startsWith('route array cycle'))).toBe(true);
    });

    it('expands an anonymous default-exported route array', () => {
        expect(line('/default-children')).toBe('  /default-children -> children default (lazy)');
        expect(line('/default-children/x')).toBe('    /default-children/x -> (none)');
    });

    it('keeps a package specifier as an external target', () => {
        expect(line('/package')).toBe('  /package -> children external @acme/remote#REMOTE (lazy)');
    });

    it('notes a relative import that does not resolve', () => {
        expect(line('/missing')).toContain('children unresolved');
        expect(draft.notes.map(n => n.what)).toContain('import not found: ./nowhere');
    });

    it('keeps a loader built by a call as unresolved source text', () => {
        expect(line('/call')).toBe('  /call -> children unresolved {makeLoader()} (lazy)');
    });

    it('names keys with the symbol table and drops undocumented ones', () => {
        const named = nameRouting(
            draft,
            buildSymbolTable({
                classes: [{ name: 'APage', file: 'src/pages/a.ts' }],
                miscellaneous: { functions: [{ name: 'roleGuard', file: 'src/guards.ts' }] }
            })
        );
        const guarded = named.roots[0].routes.find(r => r.fullPath === '/guarded');
        expect(guarded?.component?.symbol).toBe('class:src/pages/a.ts#APage');
        expect(guarded?.guards.canActivate[0].symbol).toBe('function:src/guards.ts#roleGuard');
        const byDefault = named.roots[0].routes.find(r => r.fullPath === '/default');
        expect(byDefault?.component?.symbol).toBeUndefined();
        expect(named.roots[0].array).toBeUndefined();
        expect([...named.byTarget.keys()]).toEqual(['class:src/pages/a.ts#APage']);
    });
});
