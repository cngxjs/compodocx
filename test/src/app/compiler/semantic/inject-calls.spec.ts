import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import {
    angularImports,
    findContextApiCalls,
    findInjectCalls,
    injectAliases
} from '../../../../../src/app/compiler/semantic/inject-calls';

const parse = (source: string): ts.SourceFile =>
    ts.createSourceFile('/x/sample.ts', source, ts.ScriptTarget.Latest, true);

/** Body of the first function declaration of the source. */
const firstFunction = (sourceFile: ts.SourceFile): ts.FunctionDeclaration => {
    const fn = sourceFile.statements.find(ts.isFunctionDeclaration);
    if (!fn) {
        throw new Error('no function');
    }
    return fn;
};

const tokens = (source: string): readonly (string | undefined)[] => {
    const sourceFile = parse(source);
    return findInjectCalls(
        firstFunction(sourceFile).body as ts.Node,
        angularImports(sourceFile)
    ).map(call => call.tokenName);
};

const contextApis = (source: string): readonly string[] => {
    const sourceFile = parse(source);
    return findContextApiCalls(
        firstFunction(sourceFile).body as ts.Node,
        angularImports(sourceFile)
    );
};

const CORE = "import { inject, computed, effect, DestroyRef } from '@angular/core';\n";

describe('inject() detection', () => {
    it('finds a plain call', () => {
        expect(tokens(`${CORE}function f() { return inject(TOKEN); }`)).toEqual(['TOKEN']);
    });

    it('finds a call through an aliased import', () => {
        const source =
            "import { inject as i } from '@angular/core';\nfunction f() { return i(TOKEN); }";
        expect(injectAliases(parse(source))).toEqual(new Set(['i']));
        expect(tokens(source)).toEqual(['TOKEN']);
    });

    it('finds a call through a namespace import', () => {
        expect(
            tokens(
                "import * as ng from '@angular/core';\nfunction f() { return ng.inject(TOKEN); }"
            )
        ).toEqual(['TOKEN']);
    });

    it('accepts a type argument', () => {
        expect(tokens(`${CORE}function f() { return inject<Foo>(TOKEN); }`)).toEqual(['TOKEN']);
    });

    it('reads the optional flag from the options argument', () => {
        const sourceFile = parse(
            `${CORE}function f() { return inject(ns.TOKEN, { optional: true }); }`
        );
        const [call] = findInjectCalls(
            firstFunction(sourceFile).body as ts.Node,
            angularImports(sourceFile)
        );
        expect([call.tokenName, call.optional]).toEqual(['ns.TOKEN', true]);
    });

    it('unwraps forwardRef', () => {
        expect(tokens(`${CORE}function f() { return inject(forwardRef(() => Service)); }`)).toEqual(
            ['Service']
        );
    });

    it('finds the call at the root of a chain', () => {
        expect(tokens(`${CORE}function f() { return inject(Store).select('a')!; }`)).toEqual([
            'Store'
        ]);
    });

    it('ignores inject shadowed by a local function', () => {
        expect(
            tokens(`${CORE}function f() { return inject(TOKEN); }\nfunction inject(x: unknown) {}`)
        ).toEqual([]);
    });

    it('does not attribute a call inside a nested closure', () => {
        expect(tokens(`${CORE}function f() { return () => inject(TOKEN); }`)).toEqual([]);
    });

    it('attributes a call inside a computed callback', () => {
        expect(tokens(`${CORE}function f() { return computed(() => inject(TOKEN)()); }`)).toEqual([
            'TOKEN'
        ]);
    });
});

describe('injection context APIs', () => {
    it('finds an effect call', () => {
        expect(contextApis(`${CORE}function f() { effect(() => undefined); }`)).toEqual(['effect']);
    });

    it('exempts an effect that gets an injector', () => {
        expect(
            contextApis(`${CORE}function f(injector) { effect(() => undefined, { injector }); }`)
        ).toEqual([]);
    });

    it('exempts takeUntilDestroyed with a DestroyRef', () => {
        const source =
            "import { takeUntilDestroyed } from '@angular/core/rxjs-interop';\nfunction f(ref) { takeUntilDestroyed(ref); takeUntilDestroyed(); }";
        expect(contextApis(source)).toEqual(['takeUntilDestroyed']);
    });

    it('ignores a same-named function that is not imported from Angular', () => {
        expect(
            contextApis("import { effect } from './local';\nfunction f() { effect(() => 1); }")
        ).toEqual([]);
    });
});
