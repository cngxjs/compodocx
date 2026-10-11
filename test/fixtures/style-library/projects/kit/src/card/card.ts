import { Component, input } from '@angular/core';

/** A content container with a header. */
@Component({
    selector: 'sty-card',
    template: '<section class="sty-card"><h2>{{ heading() }}</h2><ng-content /></section>'
})
export class StyCard {
    /** Heading of the card. */
    readonly heading = input('');
}
