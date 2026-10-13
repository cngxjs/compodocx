import { Component, computed, input } from '@angular/core';

/**
 * Help text whose string defaults mention the signal APIs.
 */
@Component({
    selector: 'sm-signal-copy',
    template: '<p>{{ inputHelp }}</p>'
})
export class SignalCopyComponent {
    /** Explains inputs */
    readonly inputHelp =
        '<code>input</code> declares a value the parent component passes in, read it like any other signal';
    /** Explains outputs */
    readonly outputHelp =
        '<code>output</code> declares an event the component emits to its parent through a subscription';
    /** Explains models */
    readonly modelHelp =
        '<code>model</code> declares a value that the parent can bind in both directions at the same time';
    /** Shows a declaration */
    readonly snippet = `readonly label = input<string>('Untitled');`;

    /** Heading */
    readonly heading = input('Help');
    /** Heading in capitals */
    readonly loudHeading = computed(() => this.heading().toUpperCase());
}
