import { Component, input } from '@angular/core';

import { FirstClass } from './first-class';

/**
 * Empty component for inheritance demo
 */
@Component({
    selector: 'cp-multi',
    template: 'empty component'
})
export class MultiComponent extends FirstClass {
    public emptyInput = input<string>();
}
