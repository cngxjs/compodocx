import { Directive } from '@angular/core';

/**
 * This directive does nothing !
 * @ignore
 */
@Directive({
    selector: '[donothing]'
})
export class DoNothingDirective {
    protected popover: string;
}
