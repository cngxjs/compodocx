import { Injectable, signal } from '@angular/core';

/**
 * Store whose neighbour README carries the bare marker.
 */
@Injectable({ providedIn: 'root' })
export class MarkedStore {
    /** Current count. */
    readonly count = signal(0);

    /** Adds one to the count. */
    increment(): void {
        this.count.update(value => value + 1);
    }
}
