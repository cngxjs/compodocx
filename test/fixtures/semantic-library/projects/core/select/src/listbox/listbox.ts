import { Component } from '@angular/core';

import { type SemSelectOption, SemSelectState } from '../shared/select-state';

/** The list of options of a select. */
@Component({
    selector: 'sem-select-listbox',
    template: '<ng-content />'
})
export class SemSelectListbox {
    readonly state = new SemSelectState();
    options: readonly SemSelectOption[] = [];
}
