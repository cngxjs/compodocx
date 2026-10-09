import { Directive } from '@angular/core';

import { SemSelectState } from '../shared/select-state';

/**
 * Opens the select panel.
 *
 * @category select
 */
@Directive({
    selector: '[semSelectTrigger]'
})
export class SemSelectTrigger {
    readonly state = new SemSelectState();
}
