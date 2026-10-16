import { Directive, input } from '@angular/core';

/**
 * Shows a count next to its host.
 *
 * @axis stability beta
 */
@Directive({
    selector: '[axkBadge]',
    host: { class: 'axk-badge' }
})
export class AxkBadge {
    /** The count to show. */
    readonly count = input(0);
}
