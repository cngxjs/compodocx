import { Directive, input } from '@angular/core';

/** Highlights its host element. */
@Directive({
    selector: '[styHighlight]',
    host: { class: 'sty-highlight', '[class.sty-highlight--strong]': 'strong()' }
})
export class StyHighlight {
    /** Use the strong highlight colour. */
    readonly strong = input(false);
}
