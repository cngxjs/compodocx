import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Exported consts typed as a functional guard, interceptor or resolver go
 * through the functional branch of the variable visitor. Guards and
 * interceptors get their own collections; resolvers have none and must stay
 * visible as regular variables tagged with `functionalKind: 'resolver'`
 * instead of being dropped.
 */
describe('AngularDependencies - functional resolver consts', () => {
    let tmpDir: string;
    let result: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-functional-')));
        fs.writeFileSync(
            path.join(tmpDir, 'routing.ts'),
            `import { CanActivateFn, ResolveFn } from '@angular/router';
import { HttpInterceptorFn } from '@angular/common/http';

export interface User {
    id: number;
}

/** Loads the user for the route. */
export const userResolver: ResolveFn<User> = () => ({ id: 1 });

/** Blocks anonymous visitors. */
export const authGuard: CanActivateFn = () => true;

/** Adds an auth header. */
export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
`
        );
        const deps = new AngularDependencies([path.join(tmpDir, 'routing.ts')], {
            tsconfigDirectory: tmpDir
        });
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('keeps a ResolveFn const as a variable tagged with functionalKind resolver', () => {
        const variable = result.miscellaneous.variables.find((v: any) => v.name === 'userResolver');
        expect(variable).toBeDefined();
        expect(variable.functionalKind).toBe('resolver');
        expect(variable.subtype).toBe('variable');
    });

    it('still routes a CanActivateFn const to guards', () => {
        expect(result.guards.map((g: any) => g.name)).toContain('authGuard');
        expect(result.miscellaneous.variables.map((v: any) => v.name)).not.toContain('authGuard');
    });

    it('still routes an HttpInterceptorFn const to interceptors', () => {
        expect(result.interceptors.map((i: any) => i.name)).toContain('authInterceptor');
        expect(result.miscellaneous.variables.map((v: any) => v.name)).not.toContain(
            'authInterceptor'
        );
    });
});
