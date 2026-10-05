import { input, output } from '@angular/core';

/**
 * Empty parent component for inheritance demo
 */
export class DumbParentComponent {
    public parentInput = input<string>();

    public parentoutput = output();

    public parentProperty;
}
