import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/** Value types of untyped signals and parameter properties of plain classes. */
describe('member inference', () => {
    let tmpDir: string;
    let deps: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-member-inference-')));
        const file = path.join(tmpDir, 'box.ts');
        fs.writeFileSync(
            file,
            `import { Component, afterRenderEffect, computed, effect, input, linkedSignal, signal } from '@angular/core';
import { Item } from './item';

@Component({ selector: 'app-box', template: '' })
export class BoxComponent {
    readonly count = signal(0);
    readonly label = signal('box');
    readonly open = signal(false);
    readonly empty = computed(() => this.count() === 0);
    readonly config = signal({ size: 1 });
    readonly size = computed(() => this.config().size);
    readonly log = effect(() => this.count());
    readonly paint = afterRenderEffect(() => this.count());
    readonly locked = false;
    readonly cache = new Map<string, Queue>();
    readonly declared: unknown = null;
    readonly tags = signal<string[]>([]);
    readonly tagCount = computed(() => this.tags().length);
    readonly year = computed(() => new Date().getFullYear());
    readonly heading = computed(() => (this.open() ? this.label() : \`\${this.label()} [closed]\`));
    readonly refreshed = linkedSignal(() => {
        this.count();
        return new Date();
    });
    readonly dark = computed(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
    readonly items = signal<Item[]>([]);
    readonly first = computed(() => this.items()[0]);
    readonly firstName = computed(() => this.items()[0].name);
    readonly name = input('box');
    readonly upper = computed(() => this.name().toUpperCase());

    async save() {}
}

export class Queue {
    constructor(
        readonly name: string,
        protected capacity: number,
        private secret: string,
        plain: number
    ) {}
}
`
        );
        deps = new AngularDependencies([file], { tsconfigDirectory: tmpDir }).getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const typeOf = (name: string) =>
        deps.components[0].propertiesClass.find((p: any) => p.name === name)?.type;

    it('widens literal initial values to their type', () => {
        expect(typeOf('count')).toBe('number');
        expect(typeOf('label')).toBe('string');
        expect(typeOf('open')).toBe('boolean');
    });

    it('takes the return type of a computed callback', () => {
        expect(typeOf('empty')).toBe('boolean');
    });

    it('writes an object initial value as its type', () => {
        expect(typeOf('config')).toBe('{ size: number; }');
    });

    it('lists every parameter property of a plain class, not plain parameters', () => {
        const names = deps.classes[0].properties.map((p: any) => p.name);
        expect(names).toEqual(expect.arrayContaining(['name', 'capacity', 'secret']));
        expect(names).not.toContain('plain');
    });

    it('gives effects the reference type they return', () => {
        expect(typeOf('log')).toBe('EffectRef');
        expect(typeOf('paint')).toBe('AfterRenderRef');
    });

    it('infers plain initializers: literals widened, new expressions as written', () => {
        expect(typeOf('locked')).toBe('boolean');
        expect(typeOf('cache')).toBe('Map<string, Queue>');
    });

    it('reads the value type of a signal of the same class inside a callback', () => {
        expect(typeOf('size')).toBe('number');
        expect(typeOf('tagCount')).toBe('number');
        expect(typeOf('heading')).toBe('string');
    });

    it('resolves the TypeScript and DOM lib inside a callback', () => {
        expect(typeOf('year')).toBe('number');
        expect(typeOf('refreshed')).toBe('Date');
        expect(typeOf('dark')).toBe('boolean');
    });

    it('keeps a type name from another file as written', () => {
        expect(typeOf('first')).toBe('Item');
    });

    it('leaves the type out when a type from another file or an Angular API is needed', () => {
        expect(typeOf('firstName')).toBeUndefined();
        expect(typeOf('upper')).toBeUndefined();
    });

    it('infers the return type of an async method with the lib', () => {
        const save = deps.components[0].methodsClass.find((m: any) => m.name === 'save');
        expect(save.returnType).toBe('Promise<void>');
    });

    it('keeps a declared unknown', () => {
        expect(typeOf('declared')).toBe('unknown');
    });
});
