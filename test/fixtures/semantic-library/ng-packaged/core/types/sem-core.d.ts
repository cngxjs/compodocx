import { Provider } from '@angular/core';

interface FooFeature {
    readonly kind: string;
}
declare function provideFoo(...features: FooFeature[]): Provider[];
declare function formatFoo(value: string): string;
declare function normalizeLabel(label: string): string;

export { formatFoo, normalizeLabel, provideFoo };
export type { FooFeature };

/** Typed access to a third-party private surface. */
export declare namespace Bridge {
    /** Host that emits a state change. */
    interface StateSource {
        stateChanges: unknown;
    }
    /** Selector of the host element. */
    const HOST_SELECTOR = ".host";
    /** Types one level deeper. */
    namespace Inner {
        /** A deep alias. */
        type Deep = string;
    }
    /** Reads the state of a source. */
    function read(source: StateSource): unknown;
}
/** Declared with a dotted name. */
export declare namespace Bridge.Dotted {
    /** A value declared through the dotted form. */
    const DOTTED = 1;
}
/** A second namespace with a member of the same name. */
export declare namespace Other {
    /** The other state source. */
    interface StateSource {
        other: true;
    }
}
declare module 'some-test-runner' {
    /** Matchers the test runner gains. */
    interface Matchers<R> {
        toBeBridged(): R;
    }
}
