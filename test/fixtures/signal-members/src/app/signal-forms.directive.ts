import { booleanAttribute, Directive, input, model, output } from '@angular/core';

/**
 * One member of every signal form.
 */
@Directive({
    selector: '[smSignalForms]'
})
export class SignalFormsDirective {
    /** Label with a default */
    readonly label = input<string>('Untitled');
    /** Disabled state, bound as `smDisabled` */
    readonly disabled = input(false, { transform: booleanAttribute, alias: 'smDisabled' });
    /** Item id */
    readonly itemId = input.required<string>();
    /** Emitted on close, bound as `smClosed` */
    readonly closed = output<void>({ alias: 'smClosed' });
    /** Emitted with the new label */
    readonly renamed = output<string>();
    /** Current page */
    readonly page = model(1);
    /** Selected value */
    readonly selected = model.required<string>();
}
