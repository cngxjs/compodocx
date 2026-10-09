import { Component } from '@angular/core';
import { SemSelectListbox, SemSelectTrigger } from '@sem/core/select';

/** A labelled form field around the core select. */
@Component({
    selector: 'sem-select-field',
    imports: [SemSelectListbox, SemSelectTrigger],
    template: '<button semSelectTrigger></button><sem-select-listbox />'
})
export class SemSelectField {}
