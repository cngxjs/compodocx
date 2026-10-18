import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { angularImports } from '../../../../../src/app/compiler/semantic/inject-calls';
import {
    importedMemberCall,
    type SignalMemberCall,
    signalMemberCall
} from '../../../../../src/app/compiler/semantic/signal-calls';

const CORE =
    "import { input, output, model, computed, signal, booleanAttribute } from '@angular/core';\n";

/** The signal call of the first property of the first class, without the node. */
const member = (initializer: string, header = CORE): Omit<SignalMemberCall, 'node'> | undefined => {
    const sourceFile = ts.createSourceFile(
        '/x/sample.ts',
        `${header}class Sample {\n    value = ${initializer};\n}\n`,
        ts.ScriptTarget.Latest,
        true
    );
    const cls = sourceFile.statements.find(ts.isClassDeclaration);
    const property = cls?.members.find(ts.isPropertyDeclaration);
    if (!property?.initializer) {
        throw new Error('no property initializer');
    }
    const call = signalMemberCall(property.initializer, angularImports(sourceFile), sourceFile);
    if (!call) {
        return undefined;
    }
    const { node, ...rest } = call;
    expect(ts.isCallExpression(node)).toBe(true);
    return rest;
};

describe('signalMemberCall', () => {
    it('reads input() without arguments', () => {
        expect(member('input()')).toEqual({
            api: 'input',
            required: false,
            type: undefined,
            initialValue: undefined
        });
    });

    it('reads the initial value of input(x)', () => {
        expect(member("input('x')")).toEqual({
            api: 'input',
            required: false,
            type: undefined,
            initialValue: "'x'"
        });
    });

    it('reads the type argument and initial value of input<T>(x)', () => {
        expect(member("input<string>('a')")).toMatchObject({ type: 'string', initialValue: "'a'" });
    });

    it('reads input.required<T>() as required without an initial value', () => {
        expect(member('input.required<string>()')).toEqual({
            api: 'input',
            required: true,
            type: 'string',
            initialValue: undefined
        });
    });

    it('reads the alias of input.required from its first argument; a variable alias is ignored', () => {
        expect(member("input.required<T>({ alias: 'a' })")).toEqual({
            api: 'input',
            required: true,
            type: 'T',
            initialValue: undefined,
            alias: 'a'
        });
        expect(member('input.required<T>({ alias: ALIAS })')).not.toHaveProperty('alias');
    });

    it('reads the alias of input from its second argument', () => {
        expect(member("input<string>('a', { alias: 'b' })")).toEqual({
            api: 'input',
            required: false,
            type: 'string',
            initialValue: "'a'",
            alias: 'b'
        });
    });

    it('keeps options out of the initial value', () => {
        expect(member('input(false, { transform: booleanAttribute })')).toEqual({
            api: 'input',
            required: false,
            type: undefined,
            initialValue: 'false'
        });
    });

    it('takes the first of two type arguments', () => {
        expect(
            member('input<boolean, unknown>(false, { transform: booleanAttribute })')
        ).toMatchObject({ type: 'boolean', initialValue: 'false' });
    });

    it('keeps a union type argument', () => {
        expect(member("input<'a' | 'b'>('a')")).toMatchObject({ type: "'a' | 'b'" });
    });

    it('reads a type argument that starts with a parenthesis', () => {
        expect(member('input<(() => void) | undefined>(undefined)')).toMatchObject({
            api: 'input',
            type: '(() => void) | undefined',
            initialValue: 'undefined'
        });
    });

    it('keeps nested generics whole', () => {
        expect(member('input.required<Map<string, Array<number>>>()')).toMatchObject({
            required: true,
            type: 'Map<string, Array<number>>'
        });
    });

    it('strips newlines from a multi-line call', () => {
        expect(member("input<\n        string\n    >(\n        'a',\n    )")).toMatchObject({
            type: 'string',
            initialValue: "'a'"
        });
        expect(member("input<{\n    a: string;\n}>({ a: 'x' })")).toMatchObject({
            type: '{    a: string;}',
            initialValue: "{ a: 'x' }"
        });
    });

    it('reads model(x) and model.required<T>()', () => {
        expect(member('model<number>(0)')).toEqual({
            api: 'model',
            required: false,
            type: 'number',
            initialValue: '0'
        });
        expect(member('model.required<string>()')).toEqual({
            api: 'model',
            required: true,
            type: 'string',
            initialValue: undefined
        });
    });

    it('reads output() options as the first argument', () => {
        expect(member('output<string>()')).toEqual({
            api: 'output',
            required: false,
            type: 'string',
            initialValue: undefined
        });
        expect(member("output({ alias: 'changed' })")).toEqual({
            api: 'output',
            required: false,
            type: undefined,
            initialValue: undefined,
            alias: 'changed'
        });
    });

    it('resolves an aliased import and unwraps the root expression', () => {
        const header = "import { input as i } from '@angular/core';\n";
        expect(member("i<string>('a')", header)).toMatchObject({ api: 'input', type: 'string' });
        expect(member('(i.required<string>() as unknown)!', header)).toMatchObject({
            api: 'input',
            required: true
        });
    });

    it('resolves a namespace import', () => {
        const header = "import * as ng from '@angular/core';\n";
        expect(member('ng.input.required<string>()', header)).toEqual({
            api: 'input',
            required: true,
            type: 'string',
            initialValue: undefined
        });
        expect(member('ng.model(0)', header)).toMatchObject({ api: 'model', initialValue: '0' });
    });

    it('ignores calls not imported from @angular/core', () => {
        expect(member("input('x')", '')).toBeUndefined();
        expect(member("input('x')", "import { input } from './local';\n")).toBeUndefined();
        expect(member("input('x')", "import * as ng from '@angular/forms';\n")).toBeUndefined();
        expect(
            member("input('x')", `${CORE}function input(value: string) { return value; }\n`)
        ).toBeUndefined();
    });

    it('ignores calls that only use a signal member and output.required', () => {
        expect(member('computed(() => this.input())')).toBeUndefined();
        expect(member('signal(this.output())')).toBeUndefined();
        expect(member('computed<number>(() => this.model() + 1)')).toBeUndefined();
        expect(member('input().value')).toBeUndefined();
        expect(member('output.required<string>()')).toBeUndefined();
        expect(member("'<code>input</code> text'")).toBeUndefined();
    });
});

/** The imported member call of the first property of the first class. */
const imported = (initializer: string, header: string) => {
    const sourceFile = ts.createSourceFile(
        '/x/sample.ts',
        `${header}class Sample {\n    value = ${initializer};\n}\n`,
        ts.ScriptTarget.Latest,
        true
    );
    const cls = sourceFile.statements.find(ts.isClassDeclaration);
    const property = cls?.members.find(ts.isPropertyDeclaration);
    if (!property?.initializer) {
        throw new Error('no property initializer');
    }
    return importedMemberCall(property.initializer, angularImports(sourceFile), sourceFile);
};

const HTTP = "import { httpResource } from '@angular/common/http';\n";

describe('importedMemberCall', () => {
    it('reads httpResource with its type argument', () => {
        expect(imported("httpResource<User>(() => '/api/user')", HTTP)).toEqual({
            kind: 'http-resource',
            type: 'User'
        });
    });

    it('reads the httpResource response variants', () => {
        expect(imported("httpResource.text(() => '/api/readme')", HTTP)).toEqual({
            kind: 'http-resource'
        });
    });

    it('reads aliased and namespace imports', () => {
        const aliased = "import { httpResource as load } from '@angular/common/http';\n";
        expect(imported("load(() => '/x')", aliased)?.kind).toBe('http-resource');
        const ns = "import * as http from '@angular/common/http';\n";
        expect(imported("http.httpResource(() => '/x')", ns)?.kind).toBe('http-resource');
    });

    it('reads injectAsync from @angular/core', () => {
        const core = "import { injectAsync } from '@angular/core';\n";
        expect(imported("injectAsync(() => import('./engine'))", core)).toEqual({
            kind: 'inject-async'
        });
    });

    it('ignores the same names from elsewhere or without an import', () => {
        const other = "import { httpResource } from 'some-http-library';\n";
        expect(imported("httpResource(() => '/x')", other)).toBeUndefined();
        expect(imported("injectAsync(() => import('./engine'))", '')).toBeUndefined();
        const wrongModule = "import { injectAsync } from '@angular/common/http';\n";
        expect(imported("injectAsync(() => import('./engine'))", wrongModule)).toBeUndefined();
    });
});
