import { Component, input } from '@angular/core';
import { HighlightDirective } from '../directives/highlight.directive';
import { TooltipDirective } from '../directives/tooltip.directive';

/**
 * Standalone component demonstrating `hostDirectives` composition
 * with signal-based directives.
 *
 * @example
 * ```html
 * <app-host-dir-demo [color]="'yellow'" appTooltip="Hover me" />
 * ```
 *
 * @since 2.0.0
 * @slot default - Content of the wrapper `div`,
 * which carries the highlight and tooltip of the host.
 */
@Component({
    selector: 'app-host-dir-demo',
    standalone: true,
    template: `<div><ng-content /></div>`,
    hostDirectives: [
        {
            directive: HighlightDirective,
            inputs: ['color', 'hoverColor'],
        },
        {
            directive: TooltipDirective,
            inputs: ['appTooltip', 'position'],
        },
    ],
})
export class HostDirDemoComponent {
    /**
     * Card label.
     */
    readonly label = input('');
}
