import { Component } from '@angular/core';

import { optionLabel, type SemSelectOption } from '../shared/select-state';

/** Shows the selected option as a chip. */
@Component({
    selector: 'sem-select-chips',
    template: '{{ label }}'
})
export class SemSelectChips {
    option: SemSelectOption | undefined;

    get label(): string {
        return this.option ? optionLabel(this.option) : '';
    }
}
