import * as path from 'node:path';

import fg from 'fast-glob';
import { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    analyzeDi,
    buildSemanticModel,
    collectDeclarations,
    createSemanticProgram,
    formatSemanticSummary,
    isProviderType,
    restElementType,
    type SemanticModel,
    type SymbolFacts
} from '../../../../../src/app/compiler/semantic';
import { memoryProgram } from '../../routing/program';

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
    if (created.ok === false) {
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
            key(TOKENS, 'FOO_LIMIT'),
            key(TOKENS, 'FOO_THEME')
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
            key(PROVIDERS, 'provideFooAt'),
            key('ui/src/foo-panel/foo-panel.ts', 'SemFooPanel')
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

describe('tokens a provider provides through called functions', () => {
    const FILE = '/p/providers.ts';
    const SOURCE = `
export const A = new InjectionToken('a');
export const B = new InjectionToken('b');
export const C = new InjectionToken('c');
const innerHelper = () => [{ provide: C, useValue: 3 }];
function helper() {
    return [{ provide: B, useValue: 2 }, innerHelper()];
}
const helperOfHelper = () => helper();
export function provideLimit(): Provider {
    return { provide: C, useValue: 3 };
}
export function provideWithHelper(): Provider[] {
    return [{ provide: A, useValue: 1 }, helper()];
}
export function provideWithHelperOfHelper(): Provider[] {
    return [helperOfHelper()];
}
export function provideWithProvider(): Provider[] {
    return [{ provide: A, useValue: 1 }, provideLimit()];
}
`;
    let di: ReturnType<typeof analyzeDi>['di'];
    const provides = (name: string) =>
        di.get(`p/providers.ts#${name}`)?.providesTokens.map(k => k.name);

    beforeAll(() => {
        const program = memoryProgram({ [FILE]: SOURCE });
        const checker = program.getTypeChecker();
        const sourceFiles = [program.getSourceFile(FILE)].filter(
            (sf): sf is ts.SourceFile => sf !== undefined
        );
        di = analyzeDi(collectDeclarations(sourceFiles, checker, '/'), checker, () => true).di;
    });

    it('adds the tokens of a helper function the provider calls', () => {
        expect(provides('provideWithHelper')).toEqual(['A', 'B']);
    });

    it('does not follow a helper of a helper', () => {
        expect(provides('provideWithHelperOfHelper')).toEqual([]);
    });

    it('keeps the tokens of a called provider', () => {
        expect(provides('provideWithProvider')).toEqual(['A', 'C']);
    });
});

describe('classes a provider lists', () => {
    const FILE = '/p/classes.ts';
    const SOURCE = `
export class Audit {}
export class Logger {}
export class Http {}
export const T = new InjectionToken('t');
export const helperFn = () => 1;
const auditProviders = () => [Audit];
export function provideAudit(): EnvironmentProviders {
    return makeEnvironmentProviders([
        Audit,
        { provide: Logger, useFactory: (http: Http) => http, deps: [Http] },
        { provide: T, useValue: [Http] }
    ]);
}
export function provideDirect(): Provider[] {
    return [Audit, helperFn];
}
export function provideThroughHelper(): Provider[] {
    return [auditProviders()];
}
`;
    let di: ReturnType<typeof analyzeDi>['di'];
    const provides = (name: string) =>
        di.get(`p/classes.ts#${name}`)?.providesTokens.map(k => k.name);

    beforeAll(() => {
        const program = memoryProgram({ [FILE]: SOURCE });
        const checker = program.getTypeChecker();
        const sourceFiles = [program.getSourceFile(FILE)].filter(
            (sf): sf is ts.SourceFile => sf !== undefined
        );
        di = analyzeDi(collectDeclarations(sourceFiles, checker, '/'), checker, () => true).di;
    });

    it('counts a class listed in a providers array', () => {
        expect(provides('provideAudit')).toEqual(['Audit', 'Logger', 'T']);
        expect(provides('provideDirect')).toEqual(['Audit']);
    });

    it('counts the classes of a helper the provider calls', () => {
        expect(provides('provideThroughHelper')).toEqual(['Audit']);
    });

    it('does not count deps, values or functions', () => {
        expect(provides('provideAudit')).not.toContain('Http');
        expect(provides('provideDirect')).not.toContain('helperFn');
    });
});

describe('classes and tokens a component provides', () => {
    const FILE = '/p/host.ts';
    const SOURCE = `
import { Component, Directive } from '@angular/core';
import { Component as Local } from './local';
export class Audit {}
export class Logger {}
export class Http {}
export const T = new InjectionToken('t');
const auditProviders = () => [Audit];
@Component({
    selector: 'app-host',
    imports: [Http],
    providers: [Audit, { provide: T, useValue: 1 }, { provide: Logger, useFactory: () => 1, deps: [Http] }],
    viewProviders: [Logger]
})
export class Host {}
@Directive({ selector: '[appMark]', providers: [auditProviders()] })
export class Mark {}
@Local({ providers: [Audit] })
export class NotAngular {}
`;
    let analysis: ReturnType<typeof analyzeDi>;
    const provides = (name: string) =>
        analysis.di.get(`p/host.ts#${name}`)?.providesTokens.map(k => k.name);

    beforeAll(() => {
        const program = memoryProgram({ [FILE]: SOURCE });
        const checker = program.getTypeChecker();
        const sourceFiles = [program.getSourceFile(FILE)].filter(
            (sf): sf is ts.SourceFile => sf !== undefined
        );
        analysis = analyzeDi(collectDeclarations(sourceFiles, checker, '/'), checker, () => true);
    });

    it('counts the providers and viewProviders of a component', () => {
        expect(provides('Host')).toEqual(['Audit', 'Logger', 'T']);
    });

    it('counts the classes of a helper a directive calls in its providers', () => {
        expect(provides('Mark')).toEqual(['Audit']);
    });

    it('gives the component no role and ignores a decorator not from Angular', () => {
        expect(analysis.di.get('p/host.ts#Host')?.role).toBeUndefined();
        expect(provides('NotAngular')).toBeUndefined();
    });

    it('names the component among the providers of a token', () => {
        expect(analysis.tokens.get('p/host.ts#T')?.providedBy.map(k => k.name)).toEqual(['Host']);
    });
});

describe('accessor functions', () => {
    const FILE = '/p/accessors.ts';
    const SOURCE = `
import { inject } from '@angular/core';
export const T = new InjectionToken('t');
export interface XFeature { readonly kind: string; }
const bundle = { resolve: () => inject(T) };
function readT() {
    return inject(T);
}
class Store {
    read() {
        return inject(T);
    }
}
export function returnsInject() {
    return inject(T);
}
export function returnsOptionalInject() {
    return inject(T, { optional: true });
}
export function returnsHelperCall() {
    return readT();
}
export const arrowAccessor = () => inject(T);
export function withKey(key: string) {
    if (key) {
        return inject(T);
    }
    return inject(T, { optional: true });
}
export function callsParameter(store: Store) {
    return store.read();
}
export function callsModuleConstant() {
    return bundle.resolve();
}
export function returnsObject() {
    return { value: inject(T) };
}
export function returnsNew() {
    inject(T);
    return new Store();
}
export function closureOnly() {
    return () => inject(T);
}
export function provideX(...features: XFeature[]): Provider[] {
    inject(T);
    return [];
}
export function withY(): XFeature {
    return inject(T);
}
`;
    let di: ReturnType<typeof analyzeDi>['di'];
    const accessor = (name: string) => di.get(`p/accessors.ts#${name}`)?.accessor === true;

    beforeAll(() => {
        const program = memoryProgram({ [FILE]: SOURCE });
        const checker = program.getTypeChecker();
        const sourceFiles = [program.getSourceFile(FILE)].filter(
            (sf): sf is ts.SourceFile => sf !== undefined
        );
        di = analyzeDi(collectDeclarations(sourceFiles, checker, '/'), checker, () => true).di;
    });

    it('marks a function returning inject()', () => {
        expect(accessor('returnsInject')).toBe(true);
        expect(accessor('returnsOptionalInject')).toBe(true);
    });

    it('marks a function returning a helper call that reads the token', () => {
        expect(di.get('p/accessors.ts#returnsHelperCall')?.usesInjectionContext).toBe('call');
        expect(accessor('returnsHelperCall')).toBe(true);
    });

    it('marks an exported arrow const with an expression body', () => {
        expect(accessor('arrowAccessor')).toBe(true);
    });

    it('marks an accessor with a key parameter', () => {
        expect(accessor('withKey')).toBe(true);
    });

    it('does not mark a method call on its own parameter', () => {
        expect(accessor('callsParameter')).toBe(false);
    });

    it('marks a property call on a module constant', () => {
        expect(accessor('callsModuleConstant')).toBe(true);
    });

    it('does not mark a function returning an object literal or a new expression', () => {
        expect(accessor('returnsObject')).toBe(false);
        expect(accessor('returnsNew')).toBe(false);
    });

    it('does not mark a function that injects only inside a returned closure', () => {
        expect(accessor('closureOnly')).toBe(false);
    });

    it('does not mark providers and feature functions', () => {
        expect(di.get('p/accessors.ts#provideX')?.role).toBe('provider');
        expect(accessor('provideX')).toBe(false);
        expect(di.get('p/accessors.ts#withY')?.role).toBe('feature');
        expect(accessor('withY')).toBe(false);
    });
});

describe('services loaded with injectAsync', () => {
    const FILES = {
        '/p/engine.ts': 'export default class Engine {}\nexport class Named {}\n',
        '/p/loader.ts': `
import { injectAsync } from '@angular/core';
export class Loader {
    readonly engine = injectAsync(() => import('./engine'));
    readonly named = injectAsync(() => import('./engine').then(m => m.Named));
}
`
    };
    let di: ReturnType<typeof analyzeDi>['di'];
    let asyncLoads: ReturnType<typeof analyzeDi>['asyncLoads'];

    beforeAll(() => {
        const program = memoryProgram(FILES);
        const checker = program.getTypeChecker();
        const sourceFiles = Object.keys(FILES)
            .map(file => program.getSourceFile(file))
            .filter((sf): sf is ts.SourceFile => sf !== undefined);
        ({ di, asyncLoads } = analyzeDi(
            collectDeclarations(sourceFiles, checker, '/'),
            checker,
            () => true
        ));
    });

    it('records the loaded class as a read of the loading class', () => {
        expect(di.get('p/loader.ts#Loader')?.readsTokens.map(k => k.name)).toEqual([
            'Engine',
            'Named'
        ]);
        expect(di.get('p/loader.ts#Loader')?.usesInjectionContext).toBe('direct');
    });

    it('keeps the loaded class per injectAsync call for the crawler', () => {
        const source = FILES['/p/loader.ts'];
        expect(
            [...asyncLoads].map(([at, loaded]) => [at.replace(/#\d+$/, ''), loaded.name])
        ).toEqual([
            ['/p/loader.ts', 'Engine'],
            ['/p/loader.ts', 'Named']
        ]);
        expect(asyncLoads.get(`/p/loader.ts#${source.indexOf('injectAsync(() =>')}`)?.name).toBe(
            'Engine'
        );
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
