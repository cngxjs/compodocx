import { Component, input, output, model } from '@angular/core';
import { FooDirective } from './foo.directive';
import { BarDirective } from './bar.directive';
import { BarComponent } from './bar.component';

/**
 * FooComponent description
 *
 * See {@link appConfig|APP}
 */
@Component({
    selector: 'app-foo',
    imports: [FooDirective, BarDirective, BarComponent],
    styles: [
        `
            .host {
                width: 100%;
                height: 4px;
                top: 0;
                position: fixed;
                left: 0px;
            }
        `
    ],
    template: `
        <div class="host">
            <div (click)="exampleOutput.emit({ foo: 'bar' })"></div>
        </div>
    `
})
export class FooComponent {
    /**
     * An example input
     * {@link BarComponent} or [BarComponent2]{@link BarComponent} or {@link BarComponent|BarComponent3}
     */
    public readonly exampleInput = input<string>('foo');

    /**
     * An example required input
     */
    public readonly requiredInput = input.required<string>();

    /**
     * An example aliased input
     */
    public readonly aliasedInput = input<string>(undefined, { alias: 'aliasedInput' });

    /**
     * An example aliased input using the object syntax
     */
    public readonly objectAliasedInput = input<string>(undefined, {
        alias: 'aliasedInputObjectSyntax'
    });

    /**
     * An example aliased required input using the object syntax
     */
    public readonly aliasedAndRequired = input.required<string>({
        alias: 'aliasedAndRequiredInput'
    });

    /**
     * An example output
     */
    public readonly exampleOutput = output<{ foo: string }>();

    /**
     * An example input signal
     */
    public readonly inputSignal = input<'foo' | 'bar'>('foo');

    /**
     * An example required input signal
     */
    public readonly requiredInputSignal = input.required<string>('foo');

    /**
     * An example aliased input signal
     */
    public readonly aliasedInputSignal = input(null, { alias: 'aliasedInSignal' });

    /**
     * An example output signal
     */
    public readonly outputSignal = output<'foo' | 'bar'>('foo');

    /**
     * An example required output signal
     */
    public readonly requiredOutputSignal = output.required<string>('foo');

    /**
     * An example aliased output signal
     */
    public readonly aliasedOutputSignal = output(null, { alias: 'aliasedOutSignal' });

    /**
     * An example model input signal
     */
    public readonly modelInputSignal = model(0);

    /**
     * myprop description
     */
    public myprop = false;

    /**
     * constructor description
     */
    constructor() {}
}
