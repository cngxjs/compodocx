import { Component, input } from '@angular/core';

/** A button with a themable surface. */
@Component({
    selector: 'sty-button',
    template: '<button type="button"><ng-content /></button>',
    styleUrl: './button.css'
})
export class StyButton {
    /** Visual weight of the button. */
    readonly variant = input<'filled' | 'outlined'>('filled');
}
