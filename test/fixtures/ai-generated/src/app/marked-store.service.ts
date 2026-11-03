import { Injectable, signal } from '@angular/core';

/**
 * Store whose neighbour README carries the bare marker.
 */
@Injectable({ providedIn: 'root' })
export class MarkedStore {
    /** Current count. */
    readonly count = signal(0);

    /**
     * Adds one to the count.
     *
     * @ai 2026-11
     */
    increment(): void {
        this.count.update(value => value + 1);
    }

    /** Sets the count back to zero. */
    reset(): void {
        this.count.set(0);
    }
}
