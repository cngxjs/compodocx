import { Component, input, output } from '@angular/core';
import { BaseDirective } from '../base.directive';

@Component({
    template: ''
})
export class InheritDirComponent extends BaseDirective {
    testPropertyInComponent = input(false);
    testEventInComponent = output<void>();
}
