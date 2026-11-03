import { Component, input } from '@angular/core';

/**
 * Card whose neighbour README carries the marker with a value.
 */
@Component({
    selector: 'app-marked-card',
    template: '<p>{{ label() }}</p>'
})
export class MarkedCardComponent {
    /**
     * Text inside the card.
     *
     * @aigen model=claude-opus-4.7 date=2026-11
     */
    readonly label = input('');

    /** Accent colour of the card. */
    readonly accent = input('blue');
}
