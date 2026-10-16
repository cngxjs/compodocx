import { Component, input } from '@angular/core';

import { AxkFocusRing } from '../focus/focus-ring';

/**
 * A button with a focus ring.
 *
 * @axis level molecule
 */
@Component({
    selector: 'axk-button',
    hostDirectives: [AxkFocusRing],
    template: '<ng-content />'
})
export class AxkButton {
    /** Visual weight of the button. */
    readonly variant = input<'plain' | 'primary'>('plain');
}
