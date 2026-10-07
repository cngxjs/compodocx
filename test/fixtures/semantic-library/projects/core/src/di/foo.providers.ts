import { type EnvironmentProviders, makeEnvironmentProviders, type Provider } from '@angular/core';
import { FOO_CONFIG, FOO_EXTRAS, FOO_LIMIT, FOO_MODE } from '@sem/core/tokens';

/** A configuration step accepted by the foo providers. */
export interface FooFeature {
    readonly kind: string;
    readonly providers: Provider[];
}

/** Looks like a feature, but no provider accepts it by name. */
export interface FooLikeFeature {
    readonly kind: string;
    readonly providers: Provider[];
}

/** Provides the foo feature for the application. */
export function provideFoo(...features: FooFeature[]): EnvironmentProviders {
    return makeEnvironmentProviders([
        { provide: FOO_CONFIG, useValue: { label: 'foo' } },
        provideFooLimit(),
        ...features.flatMap(f => f.providers)
    ]);
}

/** Provides the foo feature for a component subtree. */
export const provideFooAt = (...features: Array<FooFeature>): Provider[] => [
    { provide: FOO_CONFIG, useValue: { label: 'at' } },
    ...features.flatMap(f => f.providers)
];

/** Provides the limit only. */
export function provideFooLimit(): Provider {
    return { provide: FOO_LIMIT, useValue: 10 };
}

/** Provides nothing directly; it only forwards the features. */
export function provideFooFeatures(...features: readonly FooFeature[]): Provider[] {
    return features.flatMap(f => f.providers);
}

/** Sets the display mode. */
export function withMode(mode: 'compact' | 'wide'): FooFeature {
    return { kind: 'mode', providers: [{ provide: FOO_MODE, useValue: mode }] };
}

/** Adds extra values. */
export function withExtras(extras: Record<string, string>): FooFeature {
    return { kind: 'extras', providers: [{ provide: FOO_EXTRAS, useValue: extras }] };
}

/** Same shape as a feature, other type name: not a feature function. */
export function withFooLike(): FooLikeFeature {
    return { kind: 'like', providers: [] };
}
