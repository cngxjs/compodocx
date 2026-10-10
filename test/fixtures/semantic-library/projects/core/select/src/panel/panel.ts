import { Component } from '@angular/core';

import { SemSelectState } from '../shared/select-state';

/** The overlay panel that hosts the listbox. */
@Component({
    selector: 'sem-select-panel',
    template: '<ng-content />'
})
export class SemSelectPanel {
    readonly state = new SemSelectState();
}
