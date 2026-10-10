/** One option of a select. */
export interface SemSelectOption {
    readonly value: string;
    readonly label: string;
}

/** Selection state shared by every part of the select. */
export class SemSelectState {
    selected: SemSelectOption | undefined;

    select(option: SemSelectOption): void {
        this.selected = option;
    }
}

/**
 * Label shown for an option.
 *
 * @docsKind primary
 */
export function optionLabel(option: SemSelectOption): string {
    return option.label || option.value;
}
