import { Directive } from '@angular/core';

/**
 * This directive does nothing !
 *
 * @deprecated This directive is deprecated
 */
@Directive({
    selector: '[donothing]',
    host: {
        '[style.color]': 'color',
        '(mouseup)': 'onMouseup()'
    }
})
export class DoNothingDirective2 {
    /**
     * @deprecated This property is deprecated
     */
    protected popover: string;

    /**
     * HostBinding description
     */
    color: string;

    /**
     * HostListener description 1
     */
    onMouseup(): void {}
}
