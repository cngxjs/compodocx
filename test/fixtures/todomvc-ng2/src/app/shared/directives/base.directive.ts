import { Directive, input, output } from '@angular/core';

/**
 * @beta
 * @since 2.0.0
 * @breaking 3.0
 */
@Directive()
export abstract class BaseDirective {
    testPropertyInBase = input(false);
    testEventInBase = output<void>();
}
