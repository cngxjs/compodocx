import { describe, expect, it } from 'vitest';

import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';
import { EntityVisitor } from '../../../../src/app/compiler/angular-dependencies/entity-visitor';
import { ExpressionFinder } from '../../../../src/app/compiler/angular-dependencies/expression-finder';
import { AngularDependencies as AngularDependenciesFromIndex } from '../../../../src/app/compiler/angular-dependencies/index';
import { IoExtractor } from '../../../../src/app/compiler/angular-dependencies/io-extractor';
import { JsdocTags } from '../../../../src/app/compiler/angular-dependencies/jsdoc-tags';
import { MetadataPredicates } from '../../../../src/app/compiler/angular-dependencies/metadata-predicates';
import { ProviderDetector } from '../../../../src/app/compiler/angular-dependencies/provider-detector';
import { PublicApiFilter } from '../../../../src/app/compiler/angular-dependencies/public-api-filter';
import { JsdocParserUtil } from '../../../../src/utils';

describe('angular-dependencies — orchestrator wiring', () => {
    it('shim re-exports the same AngularDependencies as the index module', () => {
        expect(AngularDependencies).toBe(AngularDependenciesFromIndex);
    });

    it('AngularDependencies extends FrameworkDependencies with a getDependencies method', () => {
        expect(typeof AngularDependencies).toBe('function');
        expect(typeof AngularDependencies.prototype.getDependencies).toBe('function');
    });

    it('each concern-scoped helper is a constructible class', () => {
        expect(typeof MetadataPredicates).toBe('function');
        expect(typeof ExpressionFinder).toBe('function');
        expect(typeof PublicApiFilter).toBe('function');
        expect(typeof ProviderDetector).toBe('function');
        expect(typeof JsdocTags).toBe('function');
        expect(typeof IoExtractor).toBe('function');
        expect(typeof EntityVisitor).toBe('function');

        expect(new MetadataPredicates()).toBeInstanceOf(MetadataPredicates);
        expect(new ExpressionFinder()).toBeInstanceOf(ExpressionFinder);
        expect(new PublicApiFilter()).toBeInstanceOf(PublicApiFilter);
        expect(new ProviderDetector()).toBeInstanceOf(ProviderDetector);
        expect(new JsdocTags(new JsdocParserUtil())).toBeInstanceOf(JsdocTags);
    });

    it('ProviderDetector.detectFactoryKind recognises factory naming conventions', () => {
        const detector = new ProviderDetector();
        expect(detector.detectFactoryKind('provideRouter')).toBe('provider');
        expect(detector.detectFactoryKind('withDebugTracing')).toBe('feature');
        expect(detector.detectFactoryKind('injectFoo')).toBe('inject');
        expect(detector.detectFactoryKind('createBar')).toBe('factory');
        expect(detector.detectFactoryKind('plain')).toBeUndefined();
    });

    it('ProviderDetector.detectFunctionalAngularKind classifies by return type', () => {
        const detector = new ProviderDetector();
        expect(detector.detectFunctionalAngularKind('CanActivateFn', 'authGuard')).toBe('guard');
        expect(detector.detectFunctionalAngularKind('ResolveFn<User>', 'userResolver')).toBe(
            'resolver'
        );
        expect(detector.detectFunctionalAngularKind('HttpInterceptorFn', 'logInterceptor')).toBe(
            'interceptor'
        );
        expect(detector.detectFunctionalAngularKind(undefined, 'anything')).toBeUndefined();
    });
});
