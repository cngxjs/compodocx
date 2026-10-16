import { Directive } from '@angular/core';

/**
 * Draws a focus ring on keyboard focus.
 *
 * @axis level atom
 */
@Directive({
    selector: '[axkFocusRing]',
    host: { class: 'axk-focus-ring' }
})
export class AxkFocusRing {}
