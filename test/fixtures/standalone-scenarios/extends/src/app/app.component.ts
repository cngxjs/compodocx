import { Component, input } from '@angular/core';

import { AnotherComponent } from './another-component.component';
import { DoNothingDirective } from './do-nothing.directive';

/**
 * The main component
 */
@Component({
    selector: 'app-root',
    imports: [DoNothingDirective],
    template: '<div donothing>{{ internalLabel() }}</div>'
})
export class AppComponent extends AnotherComponent {
    constructor() {
        super();
    }

    public internalLabel = input<string>();
}
