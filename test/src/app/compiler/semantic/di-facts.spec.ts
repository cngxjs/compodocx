import * as path from 'node:path';

import fg from 'fast-glob';
import { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    buildSemanticModel,
    createSemanticProgram,
    formatSemanticSummary,
    isProviderType,
    restElementType,
    type SemanticModel,
    type SymbolFacts
} from '../../../../../src/app/compiler/semantic';

const CWD = process.cwd();
const FIXTURE = path.join(CWD, 'test/fixtures/semantic-library');
const TSCONFIG = path.join(FIXTURE, 'tsconfig.json');
const REL = 'test/fixtures/semantic-library/projects';
const PROVIDERS = 'core/src/di/foo.providers.ts';
const INJECT = 'core/src/di/foo.inject.ts';
const TOKENS = 'core/tokens/src/di-tokens.ts';

let model: SemanticModel;

const facts = (file: string, name: string): SymbolFacts | undefined =>
    model.facts.get(`${REL}/${file}#${name}`);
const key = (file: string, name: string) => ({ name, file: `${REL}/${file}` });
const typeKey = (file: string, name: string) => ({ ...key(file, name), space: 'type' });

const firstFunction = (source: string): ts.FunctionDeclaration => {
    const sourceFile = ts.createSourceFile('/x.ts', source, ts.ScriptTarget.Latest, true);
    return sourceFile.statements.find(ts.isFunctionDeclaration) as ts.FunctionDeclaration;
};

beforeAll(() => {
    const files = fg.sync('projects/**/*.ts', { cwd: FIXTURE, absolute: true }).sort();
    const created = createSemanticProgram(TSCONFIG, files);
    if (!created.ok) {
        throw new Error(created.message);
    }
    model = buildSemanticModel(created.value, TSCONFIG, CWD);
});

describe('dependency injection facts', () => {
    it('recognises every provider return type form as written', () => {
        const forms = [
            'Provider',
            'EnvironmentProviders',
            'Provider[]',
            'readonly EnvironmentProviders[]',
            'Array<Provider>',
            'Provider | EnvironmentProviders',
            '(Provider | EnvironmentProviders)[]'
        ];
        for (const form of forms) {
            expect(isProviderType(firstFunction(`function f(): ${form} {}`).type), form).toBe(true);
        }
        expect(isProviderType(firstFunction('function f(): Provider<string> {}').type)).toBe(false);
        expect(isProviderType(firstFunction('function f(): Providers {}').type)).toBe(false);
    });

    it('reads the feature type from a T[] or Array<T> rest parameter', () => {
        const element = (source: string) => restElementType(firstFunction(source))?.getText();
        expect(element('function f(...a: FooFeature[]) {}')).toBe('FooFeature');
        expect(element('function f(...a: Array<FooFeature>) {}')).toBe('FooFeature');
        expect(element('function f(...a: readonly FooFeature[]) {}')).toBe('FooFeature');
        expect(element('function f(a: FooFeature[]) {}')).toBeUndefined();
    });

    it('marks a feature function by return type name identity, not by shape', () => {
        expect(facts(PROVIDERS, 'withMode')?.di?.role).toBe('feature');
        expect(facts(PROVIDERS, 'withExtras')?.di?.featureType).toEqual(
            typeKey(PROVIDERS, 'FooFeature')
        );
        expect(facts(PROVIDERS, 'withFooLike')?.di?.role).toBeUndefined();
    });

    it('gives providers sharing a feature type the same cluster owner', () => {
        const owner = typeKey(PROVIDERS, 'FooFeature');
        expect(facts(PROVIDERS, 'provideFoo')?.di?.featureType).toEqual(owner);
        expect(facts(PROVIDERS, 'provideFooAt')?.di?.featureType).toEqual(owner);
        expect(facts(PROVIDERS, 'provideFooFeatures')?.di?.featureType).toEqual(owner);
        expect(facts(PROVIDERS, 'provideFooLimit')?.di?.featureType).toBeUndefined();
    });

    it('collects provided tokens directly and one provider call deep', () => {
        expect(facts(PROVIDERS, 'provideFoo')?.di?.providesTokens).toEqual([
            key(TOKENS, 'FOO_CONFIG'),
            key(TOKENS, 'FOO_LIMIT')
        ]);
        expect(facts(PROVIDERS, 'provideFooAt')?.di?.providesTokens).toEqual([
            key(TOKENS, 'FOO_CONFIG')
        ]);
    });

    it('keeps a provider without own tokens a provider', () => {
        const di = facts(PROVIDERS, 'provideFooFeatures')?.di;
        expect(di?.role).toBe('provider');
        expect(di?.providesTokens).toEqual([]);
    });

    it('flags direct use of the injection context and the tokens read', () => {
        expect(facts(INJECT, 'injectFoo')?.di).toMatchObject({
            usesInjectionContext: 'direct',
            readsTokens: [key(TOKENS, 'FOO_CONFIG')]
        });
        expect(facts(INJECT, 'injectFooLabel')?.di?.readsTokens).toEqual([
            key(TOKENS, 'FOO_LABEL')
        ]);
        expect(facts(INJECT, 'injectFooFormatter')?.di?.readsTokens).toEqual([
            key(TOKENS, 'FOO_FORMATTER')
        ]);
        expect(facts(INJECT, 'injectFooLimit')?.di?.readsTokens).toEqual([
            key(TOKENS, 'FOO_LIMIT')
        ]);
        expect(facts(INJECT, 'createThing')?.di?.usesInjectionContext).toBe('direct');
        expect(facts(INJECT, 'watchFoo')?.di).toMatchObject({
            usesInjectionContext: 'direct',
            readsTokens: []
        });
        expect(facts(INJECT, 'watchFooWith')?.di).toBeUndefined();
        expect(facts(INJECT, 'untilDestroyed')?.di).toBeUndefined();
        expect(facts(INJECT, 'lazyFoo')?.di).toBeUndefined();
    });

    it('reads class fields, constructor, computed callbacks and chained calls', () => {
        expect(facts(INJECT, 'FooStore')?.di).toMatchObject({
            usesInjectionContext: 'direct',
            readsTokens: [
                key(TOKENS, 'FOO_CONFIG'),
                key(TOKENS, 'FOO_FORMATTER'),
                key(TOKENS, 'FOO_LABEL'),
                key(TOKENS, 'FOO_LIMIT')
            ]
        });
    });

    it('follows one call level to a delegating helper', () => {
        expect(facts(INJECT, 'injectBar')?.di).toMatchObject({
            usesInjectionContext: 'call',
            readsTokens: [key(TOKENS, 'FOO_CONFIG')]
        });
    });

    it('does not follow a second call level and counts it as unresolved', () => {
        expect(facts(INJECT, 'injectBaz')?.di).toBeUndefined();
        expect(model.summary.injectionContext.unresolved).toBe(1);
    });

    it('follows a method call', () => {
        expect(facts(INJECT, 'injectViaMethod')?.di?.usesInjectionContext).toBe('call');
    });

    it('follows a constructor call', () => {
        expect(facts(INJECT, 'createStore')?.di?.usesInjectionContext).toBe('call');
    });

    it('classifies the token type argument shapes', () => {
        const shape = (name: string) => facts(TOKENS, name)?.token?.shape;
        expect(
            [
                'FOO_CONFIG',
                'FOO_LABEL',
                'FOO_FORMATTER',
                'FOO_LIMIT',
                'FOO_MODE',
                'FOO_EXTRAS',
                'SKIP_CACHE'
            ].map(shape)
        ).toEqual(['interface', 'signal', 'function', 'primitive', 'union', 'other', 'primitive']);
    });

    it('lists who provides and who injects a token', () => {
        const config = facts(TOKENS, 'FOO_CONFIG')?.token;
        expect(config?.providedBy).toEqual([
            key(PROVIDERS, 'provideFoo'),
            key(PROVIDERS, 'provideFooAt')
        ]);
        expect(config?.injectedBy).toEqual([
            key(INJECT, 'FooStore'),
            key(INJECT, 'createStore'),
            key(INJECT, 'createThing'),
            key(INJECT, 'injectBar'),
            key(INJECT, 'injectFoo'),
            key(INJECT, 'injectViaMethod')
        ]);
    });
});

describe('declaration spaces', () => {
    const FOO = 'core/src/foo/foo.ts';
    const typeFacts = (file: string, name: string): SymbolFacts | undefined =>
        model.facts.get(`type:${REL}/${file}#${name}`);

    it('keeps the facts of a const and a type of one name apart', () => {
        expect(facts(FOO, 'FooMode')?.key).toEqual(key(FOO, 'FooMode'));
        expect(typeFacts(FOO, 'FooMode')?.key).toEqual({ ...key(FOO, 'FooMode'), space: 'type' });
    });

    it('points a used-by edge at the space the user names', () => {
        const users = (f: SymbolFacts | undefined) => f?.usedBy.map(k => k.name) ?? [];
        expect(users(facts(FOO, 'FooMode'))).toEqual(['FooMode', 'fooModeOf']);
        expect(users(typeFacts(FOO, 'FooMode'))).toEqual(['describeFooMode', 'fooModeOf']);
    });
});

describe('semantic summary', () => {
    it('formats the build log line', () => {
        expect(
            formatSemanticSummary({
                entryPoints: 4,
                providers: 4,
                features: 2,
                injectionContext: { direct: 9, viaCall: 3, unresolved: 1 },
                notExported: 1
            })
        ).toBe(
            'Semantic analysis: 4 entry points, 4 providers, 2 feature functions, 9+3 use the injection context (1 unresolved), 1 exported symbols reach no entry point'
        );
    });
});
