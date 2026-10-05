import { Directive } from '@angular/core';

/**
 * This directive does nothing !
 */
@Directive({
    selector: '[donothing]',
    host: {
        '[style.color]': 'color',
        '(mouseup)': 'onMouseup()'
    }
})
export class DoNothingDirective {
    /**
     * HostBinding description
     */
    color: string;

    /**
     * HostListener description 1
     */
    onMouseup(): void {}
}
