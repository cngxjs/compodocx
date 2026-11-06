import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Components and directives carry no entry flag `signal`, neither from signal
 * members nor from the class tag `@signal`; the members keep `signalKind`.
 */
describe('entry signal flag', () => {
    let tmpDir: string;
    let deps: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-entry-signal-')));
        const file = path.join(tmpDir, 'entries.ts');
        fs.writeFileSync(
            file,
            `import { Component, Directive, computed, input, model, output, signal } from '@angular/core';

@Component({ selector: 'app-with-input', template: '' })
export class WithInputComponent {
    readonly title = input<string>('');
}

@Component({ selector: 'app-with-model', template: '' })
export class WithModelComponent {
    readonly value = model(0);
}

@Component({ selector: 'app-plain', template: '' })
export class PlainComponent {
    readonly count = signal(0);
    readonly double = computed(() => this.count() * 2);
}

/**
 * @signal
 */
@Component({ selector: 'app-tagged', template: '' })
export class TaggedComponent {}

@Directive({ selector: '[appWithOutput]' })
export class WithOutputDirective {
    readonly changed = output<string>();
}

@Directive({ selector: '[appPlain]' })
export class PlainDirective {}
`
        );
        deps = new AngularDependencies([file], { tsconfigDirectory: tmpDir }).getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const entry = (list: any[], name: string) => list.find((e: any) => e.name === name);

    it('is not written on components with signal members or the class tag', () => {
        for (const name of [
            'WithInputComponent',
            'WithModelComponent',
            'PlainComponent',
            'TaggedComponent'
        ]) {
            expect(entry(deps.components, name)).toBeDefined();
            expect(entry(deps.components, name)).not.toHaveProperty('signal');
        }
    });

    it('is not written on directives', () => {
        for (const name of ['WithOutputDirective', 'PlainDirective']) {
            expect(entry(deps.directives, name)).toBeDefined();
            expect(entry(deps.directives, name)).not.toHaveProperty('signal');
        }
    });

    it('keeps signalKind on the members', () => {
        const input = entry(deps.components, 'WithInputComponent').inputsClass[0];
        expect(input.signalKind).toBe('input-signal');
    });
});
