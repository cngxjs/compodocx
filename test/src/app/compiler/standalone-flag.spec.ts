import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';

/**
 * Angular 19+ treats every component, directive and pipe as standalone unless
 * its decorator says `standalone: false`. The documented flag must follow that
 * rule: an explicit literal wins, a missing property means standalone.
 */
describe('standalone flag', () => {
    let tmpDir: string;

    const write = (name: string, source: string): string => {
        const file = path.join(tmpDir, name);
        fs.writeFileSync(file, source);
        return file;
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-standalone-')));
        const files = [
            write(
                'explicit-true.component.ts',
                `import { Component } from '@angular/core';
@Component({ selector: 'app-explicit-true', template: '', standalone: true })
export class ExplicitTrueComponent {}
`
            ),
            write(
                'explicit-false.component.ts',
                `import { Component } from '@angular/core';
@Component({ selector: 'app-explicit-false', template: '', standalone: false })
export class ExplicitFalseComponent {}
`
            ),
            write(
                'absent.component.ts',
                `import { Component } from '@angular/core';
@Component({ selector: 'app-absent', template: '' })
export class AbsentComponent {}
`
            ),
            write(
                'absent.directive.ts',
                `import { Directive } from '@angular/core';
@Directive({ selector: '[appAbsent]' })
export class AbsentDirective {}
`
            )
        ];
        const deps = new AngularDependencies(files, { tsconfigDirectory: tmpDir });
        DependenciesEngine.init(deps.getDependencies());
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const component = (name: string): any =>
        DependenciesEngine.components.find((c: any) => c.name === name);

    it('keeps an explicit standalone: true', () => {
        expect(component('ExplicitTrueComponent').standalone).toBe(true);
    });

    it('overrides an explicit standalone: false when no NgModule declares the class', () => {
        expect(component('ExplicitFalseComponent').standalone).toBe(true);
    });

    it('treats a component without the property as standalone', () => {
        expect(component('AbsentComponent').standalone).toBe(true);
    });

    it('treats a directive without the property as standalone', () => {
        const directive = DependenciesEngine.directives.find(
            (d: any) => d.name === 'AbsentDirective'
        );
        expect(directive.standalone).toBe(true);
    });
});
