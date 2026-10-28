import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/** `<example-url>` tags belong to the declaration whose JSDoc holds them, not to its whole file. */
describe('example URLs per declaration', () => {
    let tmpDir: string;
    let deps: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-example-urls-')));
        const file = path.join(tmpDir, 'entries.ts');
        fs.writeFileSync(
            file,
            `import { Component, Directive, Injectable, Pipe, PipeTransform } from '@angular/core';

/**
 * First.
 * <example-url>/demo/first</example-url>
 */
@Component({ selector: 'app-first', template: '' })
export class FirstComponent {}

/** Second, without an example. */
@Component({ selector: 'app-second', template: '' })
export class SecondComponent {}

/**
 * <example-url>/demo/marker</example-url>
 * <example-url>/demo/marker-2</example-url>
 */
@Directive({ selector: '[appMarker]' })
export class MarkerDirective {}

@Directive({ selector: '[appPlain]' })
export class PlainDirective {}

@Injectable({ providedIn: 'root' })
export class PlainService {}

@Pipe({ name: 'plain' })
export class PlainPipe implements PipeTransform {
    transform(value: string): string {
        return value;
    }
}
`
        );
        deps = new AngularDependencies([file], { tsconfigDirectory: tmpDir }).getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const urls = (list: any[], name: string) => list.find((e: any) => e.name === name)?.exampleUrls;

    it('gives each class the URLs of its own JSDoc', () => {
        expect(urls(deps.components, 'FirstComponent')).toEqual(['/demo/first']);
        expect(urls(deps.directives, 'MarkerDirective')).toEqual([
            '/demo/marker',
            '/demo/marker-2'
        ]);
    });

    it('gives a class without the tag no URLs, whatever else is in its file', () => {
        expect(urls(deps.components, 'SecondComponent')).toBeUndefined();
        expect(urls(deps.directives, 'PlainDirective')).toBeUndefined();
        expect(urls(deps.injectables, 'PlainService')).toBeUndefined();
        expect(urls(deps.pipes, 'PlainPipe')).toBeUndefined();
    });
});
