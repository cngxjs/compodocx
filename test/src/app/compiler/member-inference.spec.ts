import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ts } from 'ts-morph';
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
            `import { Component, afterRenderEffect, computed, effect, input, linkedSignal, model, signal } from '@angular/core';
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
    readonly hint = input<string>();
    readonly hintText = computed(() => this.hint());
    readonly code = input.required<string>();
    readonly codeLength = computed(() => this.code().length);
    readonly disabled = input(false, { transform: (v: string | boolean) => v !== 'false' && v !== false });
    readonly enabled = computed(() => !this.disabled());
    readonly zoom = model(0);
    readonly zoomed = computed(() => this.zoom() * 2);
    readonly selected = model.required<Item>();
    readonly current = computed(() => this.selected());
    readonly currentName = computed(() => this.selected().name);
    readonly loose = computed<unknown>(() => this.count());
    readonly opaque = signal<unknown>(null);
    readonly linked = linkedSignal<unknown>(() => this.label());
    readonly raw = input<unknown>();

    async save() {}
    reset() {
        this.count.set(0);
    }
    firstLabel() {
        return this.items()[0].name;
    }
    total(): number {
        return this.count();
    }
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
    });

    it('reads the value type of input() and model() inside a callback', () => {
        expect(typeOf('upper')).toBe('string');
        expect(typeOf('hintText')).toBe('string | undefined');
        expect(typeOf('codeLength')).toBe('number');
        expect(typeOf('enabled')).toBe('boolean');
        expect(typeOf('zoomed')).toBe('number');
        expect(typeOf('current')).toBe('Item');
    });

    it('keeps the type of input() and model() members from their type argument', () => {
        const inputTypeOf = (name: string) =>
            deps.components[0].inputsClass.find((p: any) => p.name === name)?.type;
        expect(inputTypeOf('code')).toBe('string');
        expect(inputTypeOf('selected')).toBe('Item');
        expect(inputTypeOf('zoom')).toBeUndefined();
    });

    it('leaves the type out when a model() value of a type from another file is read', () => {
        expect(typeOf('currentName')).toBeUndefined();
    });

    const returnTypeOf = (name: string) =>
        deps.components[0].methodsClass.find((m: any) => m.name === name)?.returnType;

    it('infers the return type of an unannotated method with the lib', () => {
        expect(returnTypeOf('save')).toBe('Promise<void>');
        expect(returnTypeOf('reset')).toBe('void');
    });

    it('leaves an unresolved method return type out instead of writing any', () => {
        expect(returnTypeOf('firstLabel')).toBeUndefined();
    });

    it('keeps a declared method return type', () => {
        expect(returnTypeOf('total')).toBe('number');
    });

    it('keeps a written unknown type argument instead of inferring over it', () => {
        expect(typeOf('loose')).toBe('unknown');
        expect(typeOf('opaque')).toBe('unknown');
        expect(typeOf('linked')).toBe('unknown');
        const raw = deps.components[0].inputsClass.find((p: any) => p.name === 'raw');
        expect(raw?.type).toBe('unknown');
    });

    it('keeps a declared unknown', () => {
        expect(typeOf('declared')).toBe('unknown');
    });
});

/** Imports between project files resolve with the options of the semantic program. */
describe('member inference across project files', () => {
    let tmpDir: string;
    let deps: any;

    const write = (relative: string, text: string): string => {
        const file = path.join(tmpDir, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        return file;
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-member-imports-')));
        write(
            'lib/config.ts',
            `export interface Config {
    readonly size: number;
}

export const DEFAULT_SIZE = 1;
`
        );
        write(
            'lib/store.ts',
            `import { computed, signal } from '@angular/core';
import * as configs from './config';
import type { Config } from './config';

export interface Item {
    readonly name: string;
}

export class Store {
    readonly items = signal<Item[]>([]);
    readonly count = computed(() => this.items().length);
    readonly configModule = configs;
    config(): Config {
        return { size: 1 };
    }
}
`
        );
        write('node_modules/pkg/package.json', '{ "name": "pkg", "types": "index.ts" }');
        write('node_modules/pkg/index.ts', 'export const pkgValue = 1;\n');
        const big = Array.from({ length: 40 }, (_, i) => `field${i}: ${i}`).join(', ');
        const component = write(
            'app/box.component.ts',
            `import { Component, computed } from '@angular/core';
import { pkgValue } from 'pkg';
import { Store } from '@lib/store';

@Component({ selector: 'app-box', template: '' })
export class BoxComponent {
    readonly store = new Store();
    readonly total = computed(() => this.store.count());
    readonly firstName = computed(() => this.store.items()[0].name);
    readonly fromPackage = computed(() => pkgValue);
    readonly config = computed(() => this.store.config());
    readonly configRef = computed(() => this.store.configModule);
    readonly big = computed(() => ({ ${big} }));
}
`
        );
        deps = new AngularDependencies([component], {
            tsconfigDirectory: tmpDir,
            resolution: {
                baseUrl: tmpDir,
                paths: { '@lib/*': ['lib/*'] },
                moduleResolution: ts.ModuleResolutionKind.Bundler,
                module: ts.ModuleKind.ESNext
            }
        }).getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const typeOf = (name: string) =>
        deps.components[0].propertiesClass.find((p: any) => p.name === name)?.type;

    it('reads a chain of signals through a class of an imported project file', () => {
        expect(typeOf('store')).toBe('Store');
        expect(typeOf('total')).toBe('number');
        expect(typeOf('firstName')).toBe('string');
    });

    it('leaves a value of a package in node_modules without a type', () => {
        const member = deps.components[0].propertiesClass.find(
            (p: any) => p.name === 'fromPackage'
        );
        expect(member).toBeDefined();
        expect(member.type).toBeUndefined();
    });

    it('writes a type of a file the member does not import by its name', () => {
        expect(typeOf('config')).toBe('Config');
    });

    it('leaves out a type written with an import("...") qualifier', () => {
        expect(typeOf('configRef')).toBeUndefined();
    });

    it('leaves out a type the checker cuts short', () => {
        expect(typeOf('big')).toBeUndefined();
    });

    it('documents only the root files, not the files an import resolves to', () => {
        expect(deps.components.map((c: any) => c.name)).toEqual(['BoxComponent']);
        expect(deps.classes.map((c: any) => c.name)).not.toContain('Store');
        expect(deps.interfaces.map((i: any) => i.name)).not.toContain('Item');
    });
});
