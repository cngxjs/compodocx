import { Component, input } from '@angular/core';

/**
 * A single select. See the [site root](https://docs.example.test/lib/) for
 * the overview.
 */
@Component({
    selector: 'site-select',
    template: '<select><ng-content /></select>'
})
export class SiteSelect {
    /** Shown when nothing is selected. */
    readonly placeholder = input('');
}
