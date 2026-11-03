import { Component, input } from '@angular/core';

/**
 * Card whose neighbour README carries the marker with a value.
 */
@Component({
    selector: 'app-marked-card',
    template: '<p>{{ label() }}</p>'
})
export class MarkedCardComponent {
    /** Text inside the card. */
    readonly label = input('');
}
