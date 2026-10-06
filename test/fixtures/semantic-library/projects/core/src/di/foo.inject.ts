import { computed, DestroyRef, effect, inject as i, inject, type Injector, type Signal } from '@angular/core';
import * as ng from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FOO_CONFIG, FOO_FORMATTER, FOO_LABEL, FOO_LIMIT, type FooConfig } from '@sem/core/tokens';

/** Reads the foo configuration. */
export function injectFoo(): FooConfig {
    return inject(FOO_CONFIG);
}

/** Reads the label through an aliased import. */
export function injectFooLabel(): Signal<string> {
    return i(FOO_LABEL);
}

/** Reads the formatter with a type argument and an options object. */
export const injectFooFormatter = () => inject<(value: string) => string>(FOO_FORMATTER, { optional: true });

/** Reads the limit through a namespace import. */
export function injectFooLimit(): number {
    return ng.inject(FOO_LIMIT);
}

/** Delegates once. */
export function injectBar(): FooConfig {
    return injectFoo();
}

/** Delegates twice: not resolved by the one-level rule. */
export function injectBaz(): FooConfig {
    return injectBar();
}

/** Factory that calls inject directly. */
export function createThing(): { config: FooConfig } {
    return { config: inject(FOO_CONFIG) };
}

/** Uses the injection context through an Angular context API only. */
export function watchFoo(): void {
    effect(() => undefined);
}

/** Passes an injector, so it needs no injection context. */
export function watchFooWith(injector: Injector): void {
    effect(() => undefined, { injector });
}

/** Passes a DestroyRef, so it needs no injection context. */
export function untilDestroyed(ref: DestroyRef) {
    return takeUntilDestroyed(ref);
}

/** Calls inject only inside a returned closure. */
export function lazyFoo(): () => FooConfig {
    return () => inject(FOO_CONFIG);
}

/** A class reading tokens from fields, its constructor and a chained call. */
export class FooStore {
    readonly config = inject(FOO_CONFIG);
    readonly label = computed(() => inject(FOO_LABEL)());
    readonly limit = inject(FOO_LIMIT).toFixed();
    readonly formatter: (value: string) => string;

    constructor() {
        this.formatter = inject(FOO_FORMATTER);
    }

    /** Reads the configuration on demand. */
    read(): FooConfig {
        return inject(FOO_CONFIG);
    }
}

/** Reaches inject through a method call. */
export function injectViaMethod(store: FooStore): FooConfig {
    return store.read();
}

/** Reaches inject through a constructor. */
export function createStore(): FooStore {
    return new FooStore();
}
