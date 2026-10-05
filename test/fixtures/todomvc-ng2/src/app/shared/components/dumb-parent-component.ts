import { output, input } from '@angular/core';

/**
 * Empty parent component for inheritance demo
 */
export class DumbParentComponent {
    public parentInput = input<string>();

    label = input.required<string>();

    public parentoutput = output();

    currentChange = output<number>();

    public parentProperty;

    /**
     * HostBinding description
     */
    color: string;

    onMouseup(): void {}
}
