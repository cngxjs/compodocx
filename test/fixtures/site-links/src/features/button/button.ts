import { Component } from '@angular/core';

/** A plain button. */
@Component({
    selector: 'site-button',
    template: '<button type="button"><ng-content /></button>'
})
export class SiteButton {}
