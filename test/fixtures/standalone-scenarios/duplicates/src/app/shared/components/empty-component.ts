import { Component, input } from '@angular/core';

import { EmptyParentComponent } from './empty-parent.component';

/**
 * Empty component for inheritance demo
 */
@Component({
    selector: 'cp-empty',
    template: 'empty component'
})
export class EmptyComponent extends EmptyParentComponent {
    public emptyInput = input<string>();
}
