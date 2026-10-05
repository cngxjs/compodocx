import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * `providedIn` is read from the `@Injectable` decorator and from the options
 * argument of `new InjectionToken(...)`. Both store the bare value for string
 * literals (no surrounding quotes) so services and tokens agree.
 */
describe('AngularDependencies - providedIn extraction', () => {
    let tmpDir: string;
    let result: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-provided-in-')));
        fs.writeFileSync(
            path.join(tmpDir, 'services.ts'),
            `import { Injectable, InjectionToken } from '@angular/core';

/** Application-wide store. */
@Injectable({ providedIn: 'root' })
export class RootStore {}

/** Shared across applications. */
@Injectable({ providedIn: 'platform' })
export class PlatformStore {}

/** Provided by whoever needs it. */
@Injectable()
export class LocalStore {}

/** Base URL for API calls. */
export const API_URL = new InjectionToken<string>('API_URL', {
    providedIn: 'root',
    factory: () => '/api'
});
`
        );
        const deps = new AngularDependencies([path.join(tmpDir, 'services.ts')], {
            tsconfigDirectory: tmpDir
        });
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const injectable = (name: string) => result.injectables.find((i: any) => i.name === name);

    it("stores providedIn: 'root' as root", () => {
        expect(injectable('RootStore').providedIn).toBe('root');
    });

    it("stores providedIn: 'platform' as platform", () => {
        expect(injectable('PlatformStore').providedIn).toBe('platform');
    });

    it('leaves providedIn absent when the decorator has none', () => {
        const store = injectable('LocalStore');
        expect(store).toBeDefined();
        expect(store).not.toHaveProperty('providedIn');
    });

    it('stores a token providedIn without quotes', () => {
        const token = result.tokens.find((t: any) => t.name === 'API_URL');
        expect(token.providedIn).toBe('root');
    });
});
