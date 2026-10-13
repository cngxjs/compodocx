import { describe, expect, it } from 'vitest';

import { buildRouting, declarationKey, unresolvedLazy } from '../../../../src/app/routing';
import { memoryProgram } from './program';
import { routeTree } from './tree';

const BOOT = `import { bootstrapApplication } from '@angular/platform-browser';\n`;
const ROUTER = `import { provideRouter, Routes, withHashLocation } from '@angular/router';\n`;

const treeOf = (files: Record<string, string>): string => {
    const program = memoryProgram(files);
    return routeTree(
        buildRouting({
            program,
            files: Object.keys(files),
            cwd: '/p',
            symbolOf: declarationKey('/p'),
            lazy: () => unresolvedLazy
        })
    );
};

describe('router roots', () => {
    it('reads an inline config', () => {
        expect(
            treeOf({
                '/p/main.ts': `${BOOT}${ROUTER}class App {}
bootstrapApplication(App, { providers: [provideRouter([{ path: 'a' }], withHashLocation())] });`
            })
        ).toBe(`router bootstrap=main.ts(App) features=[withHashLocation()]
  /a -> (none)`);
    });

    it('follows a named config and a named route array across files', () => {
        expect(
            treeOf({
                '/p/main.ts': `${BOOT}import { appConfig } from './config';
class App {}
bootstrapApplication(App, appConfig);`,
                '/p/config.ts': `${ROUTER}import { routes } from './routes';
export const appConfig = { providers: [provideRouter(routes)] };`,
                '/p/routes.ts': `${ROUTER}export const routes: Routes = [{ path: 'a' }];`
            })
        ).toBe(`router bootstrap=main.ts(App) config=appConfig array=routes
  /a -> (none)`);
    });

    it('reads mergeApplicationConfig and spread provider arrays', () => {
        expect(
            treeOf({
                '/p/main.ts': `${BOOT}import { mergeApplicationConfig } from '@angular/core';
${ROUTER}class App {}
const ROUTING = [provideRouter([{ path: 'b' }])];
const base = { providers: [...ROUTING] };
const extra = { providers: [] };
bootstrapApplication(App, mergeApplicationConfig(extra, base));`
            })
        ).toBe(`router bootstrap=main.ts(App) config=base
  /b -> (none)`);
    });

    it('finds a bootstrap inside a condition or a function', () => {
        expect(
            treeOf({
                '/p/main.ts': `${BOOT}${ROUTER}class App {}
declare const prod: boolean;
function start() {
    if (prod) {
        bootstrapApplication(App, { providers: [provideRouter([{ path: 'a' }])] }).catch(() => {});
    }
}`
            })
        ).toBe(`router bootstrap=main.ts(App)
  /a -> (none)`);
    });

    it('shares one root between two bootstraps of the same config', () => {
        expect(
            treeOf({
                '/p/main.ts': `${BOOT}import { config } from './config';
class App {}
bootstrapApplication(App, config);`,
                '/p/server.ts': `${BOOT}import { config } from './config';
class App {}
bootstrapApplication(App, config);`,
                '/p/config.ts': `${ROUTER}export const config = { providers: [provideRouter([{ path: 'a' }])] };`
            })
        ).toBe(`router bootstrap=main.ts(App) bootstrap=server.ts(App) config=config
  /a -> (none)`);
    });

    it('does not make a config that is never bootstrapped a root', () => {
        expect(
            treeOf({
                '/p/test-config.ts': `${ROUTER}export const testConfig = { providers: [provideRouter([{ path: 'a' }])] };`
            })
        ).toBe('');
    });

    it('lists exported route arrays no router mounts, and ignores unexported ones', () => {
        const program = memoryProgram({
            '/p/main.ts': `${BOOT}${ROUTER}import { MOUNTED } from './feature';
class App {}
bootstrapApplication(App, { providers: [provideRouter(MOUNTED)] });`,
            '/p/feature.ts': `${ROUTER}export const MOUNTED: Routes = [{ path: 'm' }];
export const SHIPPED: Routes = [{ path: 's' }, ...PART];
export const PART: Routes = [{ path: 'p' }];
const DRAFT: Routes = [{ path: 'd' }];`
        });
        const model = buildRouting({
            program,
            files: ['/p/main.ts', '/p/feature.ts'],
            cwd: '/p',
            symbolOf: declarationKey('/p'),
            lazy: () => unresolvedLazy
        });
        expect(routeTree(model)).toBe(`router bootstrap=main.ts(App) array=MOUNTED
  /m -> (none)
unmounted array=SHIPPED
  /s -> (none)
  /p -> (none)`);
        expect(model.notes.map(n => n.what)).toEqual([
            'route array DRAFT is neither exported nor mounted (ignored)'
        ]);
    });

    it('ignores provideRouter and bootstrapApplication from other modules', () => {
        expect(
            treeOf({
                '/p/main.ts': `import { bootstrapApplication } from './my-platform';
import { provideRouter } from './my-router';
class App {}
bootstrapApplication(App, { providers: [provideRouter([{ path: 'a' }])] });`
            })
        ).toBe('');
    });

    it('counts routes and indexes targets and mounts', () => {
        const program = memoryProgram({
            '/p/main.ts': `${BOOT}${ROUTER}import { CHILD } from './child';
export class App {}
export class Page {}
export const routes: Routes = [{ path: 'a', component: Page, children: CHILD }];
bootstrapApplication(App, { providers: [provideRouter(routes)] });`,
            '/p/child.ts': `${ROUTER}export const CHILD: Routes = [{ path: 'b' }, { path: 'c' }];`
        });
        const model = buildRouting({
            program,
            files: ['/p/main.ts', '/p/child.ts'],
            cwd: '/p',
            symbolOf: declarationKey('/p'),
            lazy: () => unresolvedLazy
        });
        expect(model.count).toBe(3);
        expect([...model.byTarget]).toEqual([['main.ts#Page', ['0-0']]]);
        expect([...model.mountedAt]).toEqual([
            ['main.ts#routes', ['/']],
            ['child.ts#CHILD', ['/a']]
        ]);
    });
});
