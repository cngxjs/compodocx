import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createSemanticProgram } from '../../../../src/app/compiler/semantic';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import { buildSymbolTable } from '../../../../src/app/links/symbol-table';
import {
    buildRouting,
    declarationKey,
    lazyResolver,
    nameRouting,
    type RoutingModel,
    routeUsesOf,
    unresolvedLazy
} from '../../../../src/app/routing';
import { memoryProgram } from './program';

const ROUTER = `import { provideRouter, Routes } from '@angular/router';\n`;
const BOOT = `import { bootstrapApplication } from '@angular/platform-browser';\n`;

const modelOf = (files: Record<string, string>): RoutingModel =>
    buildRouting({
        program: memoryProgram(files),
        files: Object.keys(files),
        cwd: '/p',
        symbolOf: declarationKey('/p'),
        lazy: () => unresolvedLazy
    });

/** `fullPath role[ key]` per use of a symbol. */
const usesOf = (model: RoutingModel, id: string): string[] =>
    routeUsesOf(model, id as SymbolId).map(use =>
        [use.route.fullPath, use.role, use.key].filter(Boolean).join(' ')
    );

describe('routes using a guard, resolver or title resolver', () => {
    const model = modelOf({
        '/p/main.ts': `${BOOT}${ROUTER}import { authGuard, roleGuard, leaveGuard, userResolver, helpTitle } from './guards';
export class App {}
export const routes: Routes = [
    { path: 'a', canActivate: [authGuard], canDeactivate: [leaveGuard] },
    {
        path: 'b',
        canActivate: [authGuard, authGuard],
        canActivateChild: [authGuard],
        children: [{ path: 'c', canMatch: [roleGuard('admin')], resolve: { user: userResolver, again: userResolver } }]
    },
    { path: 'd', canActivate: [() => true], title: helpTitle, resolve: { inline: () => 'x' } },
    { path: 'e', title: 'Plain', canLoad: [roleGuard('owner')] }
];
bootstrapApplication(App, { providers: [provideRouter(routes)] });`,
        '/p/guards.ts': `export const authGuard = () => true;
export const leaveGuard = () => true;
export function roleGuard(role: string) { return () => role !== ''; }
export const userResolver = () => 'user';
export const helpTitle = () => 'Help';`
    });

    it('lists every route of a guard with its role, deduplicated', () => {
        expect(usesOf(model, 'guards.ts#authGuard')).toEqual([
            '/a canActivate',
            '/b canActivate',
            '/b canActivateChild'
        ]);
        expect(usesOf(model, 'guards.ts#leaveGuard')).toEqual(['/a canDeactivate']);
    });

    it('counts a guard factory call and a guard in a child route', () => {
        expect(usesOf(model, 'guards.ts#roleGuard')).toEqual(['/b/c canMatch', '/e canLoad']);
    });

    it('keeps the resolve key of a resolver', () => {
        expect(usesOf(model, 'guards.ts#userResolver')).toEqual([
            '/b/c resolve user',
            '/b/c resolve again'
        ]);
    });

    it('counts a title resolver, not a title string', () => {
        expect(usesOf(model, 'guards.ts#helpTitle')).toEqual(['/d title']);
    });

    it('indexes no inline function', () => {
        expect([...model.usedIn.keys()].sort()).toEqual([
            'guards.ts#authGuard',
            'guards.ts#helpTitle',
            'guards.ts#leaveGuard',
            'guards.ts#roleGuard',
            'guards.ts#userResolver'
        ]);
    });

    it('returns nothing for a symbol no route uses', () => {
        expect(routeUsesOf(model, 'main.ts#App' as SymbolId)).toEqual([]);
    });
});

const FILES: Record<string, string> = {
    'tsconfig.json': JSON.stringify({
        compilerOptions: { module: 'ES2022', moduleResolution: 'bundler', target: 'ES2022' },
        include: ['src/**/*.ts']
    }),
    'src/main.ts': `${BOOT}import { provideRouter } from '@angular/router';
import { routes } from './routes';
export class App {}
bootstrapApplication(App, { providers: [provideRouter(routes)] });`,
    'src/routes.ts': `import { Routes } from '@angular/router';
export const routes: Routes = [
    { path: 'admin', loadChildren: () => import('./admin.routes').then(m => m.ADMIN) }
];`,
    'src/admin.routes.ts': `import { Routes } from '@angular/router';
import { adminGuard } from './guards';
export const ADMIN: Routes = [{ path: 'users', canActivate: [adminGuard] }];`,
    'src/guards.ts': `export const adminGuard = () => true;`
};

describe('routes of a lazily loaded route array', () => {
    let dir: string;
    let named: RoutingModel;

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-used-in-'));
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
        const draft = buildRouting({
            program: program.value,
            files,
            cwd: dir,
            symbolOf,
            lazy: notes => lazyResolver(program.value, symbolOf, dir, notes)
        });
        named = nameRouting(
            draft,
            buildSymbolTable({
                miscellaneous: { variables: [{ name: 'adminGuard', file: 'src/guards.ts' }] }
            })
        );
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('lists the full path below the mount and keys it by the table id', () => {
        expect([...named.usedIn.keys()]).toEqual(['variable:src/guards.ts#adminGuard']);
        expect(usesOf(named, 'variable:src/guards.ts#adminGuard')).toEqual([
            '/admin/users canActivate'
        ]);
    });
});
