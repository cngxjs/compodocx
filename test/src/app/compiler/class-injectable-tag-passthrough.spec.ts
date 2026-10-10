import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * The custom tag set (`@wcag`, `@since`, `@github`, `@selector`,
 * `@relatedTo`) is extracted into the IO object for every entity kind, but the
 * shape-building blocks in `angular-dependencies/index.ts` copy those fields
 * per kind. Class and injectable blocks had drifted — class dropped `since`,
 * injectable dropped `wcagLevel`/`a11yNote`/`taggedSelector`/
 * `relatedTo`. This spec pins that all three reference fields survive on both
 * shapes, mirroring the directive/component pipelines.
 */
describe('AngularDependencies — class/injectable custom-tag pass-through', () => {
    let tmpDir: string;
    let result: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-tag-passthrough-')));
        fs.writeFileSync(
            path.join(tmpDir, 'data-source.ts'),
            `/**
 * A reactive data source.
 * @category common/data
 * @docsKind primary
 * @wcag AA
 * @github https://github.com/cngxjs/cngx/blob/main/data-source.ts
 * @since 0.1.0
 * @selector cngx-data-source
 * @relatedTo SmartDataSource, Sort, Filter
 */
export class DataSource<T> {
    public value: T | undefined;
}

/** Plain class with no custom tags. */
export class PlainClass {
    public id = 1;
}
`
        );
        fs.writeFileSync(
            path.join(tmpDir, 'alerter.ts'),
            `import { Injectable } from '@angular/core';

/**
 * Announces alerts to assistive tech.
 * @category ui/feedback
 * @docsKind primary
 * @wcag AA
 * @github https://github.com/cngxjs/cngx/blob/main/alerter.ts
 * @since 0.1.0
 * @selector cngx-alerter
 * @relatedTo Alert, AlertStack
 */
@Injectable({ providedIn: 'root' })
export class Alerter {
    public announce(): void {}
}

/** Plain injectable with no custom tags. */
@Injectable({ providedIn: 'root' })
export class PlainService {
    public noop(): void {}
}
`
        );
        const deps = new AngularDependencies(
            [path.join(tmpDir, 'data-source.ts'), path.join(tmpDir, 'alerter.ts')],
            { tsconfigDirectory: tmpDir }
        );
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('propagates all custom tags onto a class shape', () => {
        const cls = result.classes.find((c: any) => c.name === 'DataSource');
        expect(cls).toBeDefined();
        expect(cls.since).toBe('0.1.0');
        // @category and @docsKind are no longer read.
        expect(cls.docsKind).toBeUndefined();
        expect(cls.category).toBeUndefined();
        expect(cls.wcagLevel).toBe('AA');
        expect(cls.githubUrl).toBe('https://github.com/cngxjs/cngx/blob/main/data-source.ts');
        expect(cls.taggedSelector).toBe('cngx-data-source');
        expect(cls.relatedTo).toEqual(['SmartDataSource', 'Sort', 'Filter']);
    });

    it('leaves custom-tag fields absent on an untagged class', () => {
        const cls = result.classes.find((c: any) => c.name === 'PlainClass');
        expect(cls).toBeDefined();
        expect(cls.since).toBeUndefined();
        expect(cls.docsKind).toBeUndefined();
        expect(cls.wcagLevel).toBeUndefined();
        expect(cls.taggedSelector).toBeUndefined();
        expect(cls.relatedTo).toBeUndefined();
    });

    it('propagates all custom tags onto an injectable shape', () => {
        const inj = result.injectables.find((i: any) => i.name === 'Alerter');
        expect(inj).toBeDefined();
        expect(inj.since).toBe('0.1.0');
        expect(inj.docsKind).toBeUndefined();
        expect(inj.category).toBeUndefined();
        expect(inj.wcagLevel).toBe('AA');
        expect(inj.githubUrl).toBe('https://github.com/cngxjs/cngx/blob/main/alerter.ts');
        expect(inj.taggedSelector).toBe('cngx-alerter');
        expect(inj.relatedTo).toEqual(['Alert', 'AlertStack']);
    });

    it('leaves custom-tag fields absent on an untagged injectable', () => {
        const inj = result.injectables.find((i: any) => i.name === 'PlainService');
        expect(inj).toBeDefined();
        expect(inj.since).toBeUndefined();
        expect(inj.docsKind).toBeUndefined();
        expect(inj.wcagLevel).toBeUndefined();
        expect(inj.taggedSelector).toBeUndefined();
        expect(inj.relatedTo).toBeUndefined();
    });
});
