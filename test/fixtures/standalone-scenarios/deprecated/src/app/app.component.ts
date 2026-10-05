import { Component } from '@angular/core';

import { DumbComponent } from './components/dumb.component';
import { DoNothingDirective2 } from './directives/do-nothing.directive';
import { FirstUpperPipe2 } from './pipes/first-upper.pipe';

/**
 * The main component
 */
@Component({
    selector: 'app-root',
    imports: [DumbComponent, DoNothingDirective2, FirstUpperPipe2],
    template: '<cp-dumb donothing>{{ title | firstUpper }}</cp-dumb>'
})
export class AppComponent {
    title = 'todos';
}
