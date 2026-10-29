import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hasSignalMember } from '../../../../src/app/compiler/angular/deps/helpers/class-helper/member-visitor';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

describe('hasSignalMember', () => {
    it('is true for an input, output or model member', () => {
        expect(hasSignalMember([{ signalKind: 'input-signal' }])).toBe(true);
        expect(hasSignalMember(undefined, [{ signalKind: 'output-signal' }])).toBe(true);
        expect(hasSignalMember([], [], [{ signalKind: 'model' }])).toBe(true);
    });

    it('is false for other signal kinds and plain members', () => {
        expect(hasSignalMember([{ signalKind: 'computed' }, { signalKind: 'signal' }, {}])).toBe(
            false
        );
        expect(hasSignalMember(undefined, [])).toBe(false);
    });
});

/** The deprecated entry flag `signal` follows the members, plus the class tag `@signal`. */
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

    const flag = (list: any[], name: string) => list.find((e: any) => e.name === name)?.signal;

    it('is true for components with an input or model member', () => {
        expect(flag(deps.components, 'WithInputComponent')).toBe(true);
        expect(flag(deps.components, 'WithModelComponent')).toBe(true);
    });

    it('is false for a component with only signal() and computed() members', () => {
        expect(flag(deps.components, 'PlainComponent')).toBe(false);
    });

    it('keeps the class tag', () => {
        expect(flag(deps.components, 'TaggedComponent')).toBe(true);
    });

    it('follows the members of directives', () => {
        expect(flag(deps.directives, 'WithOutputDirective')).toBe(true);
        expect(flag(deps.directives, 'PlainDirective')).toBe(false);
    });
});
