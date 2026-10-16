import { Component, input } from '@angular/core';

/** A small inline chart of a series of numbers. */
@Component({
    selector: 'axk-sparkline',
    template: '<svg aria-hidden="true"></svg>'
})
export class AxkSparkline {
    /** The values to draw. */
    readonly values = input<readonly number[]>([]);
}
