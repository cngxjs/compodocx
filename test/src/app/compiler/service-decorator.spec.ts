import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Angular's `@Service` is recognised by its import from `@angular/core`; a
 * project decorator with the same name keeps its class a plain class.
 */
describe('AngularDependencies - Service decorator', () => {
    let tmpDir: string;
    let result: any;

    const files: Record<string, string> = {
        'services.ts': `import { Service, inject } from '@angular/core';

/** Auto-provided. */
@Service()
export class PlainService {}

/** Listed in a providers array. */
@Service({ autoProvided: false })
export class ManualService {
    constructor(private readonly name: string) {}
}

/** Explicitly auto-provided. */
@Service({ autoProvided: true })
export class ExplicitService {}

/** Abstract, with a default implementation. */
@Service({ factory: () => new ConsoleLogger() })
export abstract class Logger {
    abstract log(message: string): void;
}

/** Default logger. */
export class ConsoleLogger extends Logger {
    log(message: string): void {}
}
`,
        'aliased.ts': `import { Service as AngularService } from '@angular/core';
import * as core from '@angular/core';

/** Aliased import. */
@AngularService()
export class AliasedService {}

/** Namespace import. */
@core.Service()
export class NamespacedService {}
`,
        'local.ts': `/** A project decorator called Service. */
export function Service(_name?: string) {
    return (_target: unknown) => {};
}

/** Uses the project decorator. */
@Service('registry')
export class Registry {}
`,
        'other-package.ts': `import { Service } from 'some-di-library';

/** Service from another package. */
@Service()
export class ForeignService {}
`,
        'type-only.ts': `import type { Service } from '@angular/core';

declare const Service: () => ClassDecorator;

/** Type-only import, the decorator value is something else. */
@Service()
export class TypeOnlyService {}
`,
        'injectable.ts': `import { Injectable } from '@angular/core';

/** Classic injectable. */
@Injectable({ providedIn: 'root' })
export class ClassicStore {}
`
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-service-')));
        for (const [name, text] of Object.entries(files)) {
            fs.writeFileSync(path.join(tmpDir, name), text);
        }
        const deps = new AngularDependencies(
            Object.keys(files).map(name => path.join(tmpDir, name)),
            { tsconfigDirectory: tmpDir }
        );
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const service = (name: string) => result.services.find((s: any) => s.name === name);
    const names = (list: any[]) => list.map(entry => entry.name).sort();

    it('collects classes decorated with the Angular Service decorator', () => {
        expect(names(result.services)).toEqual([
            'AliasedService',
            'ExplicitService',
            'Logger',
            'ManualService',
            'NamespacedService',
            'PlainService'
        ]);
        expect(service('PlainService').type).toBe('service');
    });

    it('keeps classes with a Service decorator from elsewhere plain classes', () => {
        expect(names(result.classes)).toEqual([
            'ConsoleLogger',
            'ForeignService',
            'Registry',
            'TypeOnlyService'
        ]);
    });

    it('keeps the Injectable decorator an injectable', () => {
        expect(names(result.injectables)).toEqual(['ClassicStore']);
    });

    it('reads autoProvided when it is a boolean literal', () => {
        expect(service('ManualService').autoProvided).toBe(false);
        expect(service('ExplicitService').autoProvided).toBe(true);
        expect(service('PlainService')).not.toHaveProperty('autoProvided');
    });

    it('stores the factory source text', () => {
        expect(service('Logger').factory).toBe('() => new ConsoleLogger()');
        expect(service('PlainService')).not.toHaveProperty('factory');
    });

    it('documents the members of an abstract service', () => {
        expect(service('Logger').methods.map((m: any) => m.name)).toEqual(['log']);
    });

    it('does not document constructor injection of a service', () => {
        expect(service('ManualService')).not.toHaveProperty('constructorObj');
    });
});
