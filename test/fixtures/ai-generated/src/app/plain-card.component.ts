import { Component, input } from '@angular/core';

/**
 * Card whose neighbour README has no marker.
 */
@Component({
    selector: 'app-plain-card',
    template: '<p>{{ label() }}</p>'
})
export class PlainCardComponent {
    /** Text inside the card. */
    readonly label = input('');
}
