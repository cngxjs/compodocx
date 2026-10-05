import { Component, input } from '@angular/core';

/**
 * The footer component
 */
@Component({
    selector: 'app-footer',
    template: '<footer>{{ remaining() }} items left</footer>'
})
export class FooterComponent {
    /**
     * Remaining todos count
     */
    remaining = input(0);
}
