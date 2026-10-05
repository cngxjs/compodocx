import { Component } from '@angular/core';

import { FooterComponent } from './footer/footer.component';

/**
 * The main component
 * @ignore
 */
@Component({
    selector: 'app-root',
    imports: [FooterComponent],
    template: '<app-footer></app-footer>'
})
export class AppComponent {}
