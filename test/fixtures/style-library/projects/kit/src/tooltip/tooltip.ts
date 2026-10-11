import { Component, input } from '@angular/core';

/** A short text shown next to its trigger. */
@Component({
    selector: 'sty-tooltip',
    template: '<span class="sty-tooltip">{{ text() }}</span>'
})
export class StyTooltip {
    /** Text of the tooltip. */
    readonly text = input('');
}
