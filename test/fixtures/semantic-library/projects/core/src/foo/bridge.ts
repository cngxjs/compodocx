/** Typed access to a third-party private surface. */
export namespace Bridge {
    /** Host that emits a state change. */
    export interface StateSource {
        stateChanges: unknown;
    }

    /** Selector of the host element. */
    export const HOST_SELECTOR = '.host';

    const internalOnly = 1;

    /** Types one level deeper. */
    export namespace Inner {
        /** A deep alias. */
        export type Deep = string;
    }

    /** Reads the state of a source. */
    export function read(source: StateSource): unknown {
        return internalOnly ? source.stateChanges : undefined;
    }
}

/** Declared with a dotted name. */
export namespace Bridge.Dotted {
    /** A value declared through the dotted form. */
    export const DOTTED = 1;
}

/** A second namespace with a member of the same name. */
export namespace Other {
    /** The other state source. */
    export interface StateSource {
        other: true;
    }
}
