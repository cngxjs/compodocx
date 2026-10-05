import { Directive } from '@angular/core';

import { ADirective } from './a.directive';

/**
 * This directive does nothing !
 */
@Directive({
    selector: '[donothing]',
    host: {
        '[style.color]': 'color',
        '(mouseup)': 'onMouseup($event.clientX, $event.clientY)',
        '(mousedown)': 'onMousedown($event.clientX, $event.clientY)',
        '(click)': 'onClick($event)'
    }
})
export class DoNothingDirective extends ADirective {
    protected popover: string;

    /**
     * constructor description
     */
    constructor() {
        super();
        console.log('Do nothing directive');
    }

    /**
     * HostBinding description
     */
    color: string;

    /**
     * HostListener description 1
     */
    onMouseup(mouseX: number, mouseY: number): void {}
    /**
     * HostListener description 2
     */
    onMousedown(mouseX: number, mouseY: number): void {}
    /**
     * HostListener description 3
     */
    onClick(e: Event): void {}
}
