import {
    Directive,
    ElementRef,
    input,
    output,
    effect,
    inject,
    InjectionToken
} from '@angular/core';

import { ThemeService } from '../../core/services/theme.service';
import { TooltipDirective } from './tooltip.directive';

/**
 * Local token for a default highlight fallback color. Shows how an
 * InjectionToken can be plumbed through directive metadata via a
 * useFactory provider.
 */
export const HIGHLIGHT_DEFAULT_COLOR = new InjectionToken<string>('HIGHLIGHT_DEFAULT_COLOR', {
    providedIn: 'root',
    factory: () => '#ffffcc'
});

/**
 * Factory returning a computed fallback colour based on the current theme.
 * Used in the directive's `providers` array as a useFactory example.
 */
export function highlightDefaultColorFactory(theme: ThemeService): string {
    return theme.isDark() ? '#443300' : '#ffffcc';
}

/**
 * Standalone highlight directive using signal inputs.
 *
 * Fully maxed-out directive showing every metadata field compodocx can
 * extract: `selector`, `standalone`, `exportAs`, `providers` with every
 * DI pattern, `host` bindings and listeners and `hostDirectives` composition.
 *
 * @example
 * ```html
 * <p appHighlight [color]="'yellow'" [hoverColor]="'gold'">Hover me</p>
 * ```
 *
 * @since 2.0.0
 * @storybook https://storybook.example.com/?path=/story/directives-highlight--default
 * @figma https://www.figma.com/file/abc123/Directives?node-id=3:14
 * @stackblitz https://stackblitz.com/edit/angular-highlight-directive
 * @github https://github.com/cngxjs/compodocx/blob/develop/test/fixtures/kitchen-sink-standalone/src/app/shared/directives/highlight.directive.ts
 * @docs https://cngx.dev/directives/highlight
 */
@Directive({
    selector: '[appHighlight]',
    standalone: true,
    exportAs: 'appHighlight',
    providers: [
        // bare class
        ThemeService,
        // useClass alias
        { provide: 'HighlightTheme', useClass: ThemeService },
        // useValue primitive
        { provide: 'HighlightTransitionMs', useValue: 200 },
        // useFactory with deps — computes a theme-aware fallback colour
        {
            provide: HIGHLIGHT_DEFAULT_COLOR,
            useFactory: highlightDefaultColorFactory,
            deps: [ThemeService]
        },
        // useExisting aliasing
        { provide: 'HighlightFallback', useExisting: HIGHLIGHT_DEFAULT_COLOR },
        // multi provider
        { provide: 'HighlightEventChannels', useValue: 'mouse', multi: true }
    ],
    host: {
        class: 'app-highlight',
        '[attr.data-highlight-enabled]': 'enabled()',
        '[style.cursor]': 'enabled() ? "pointer" : "default"',
        '[style.backgroundColor]': 'bgColor',
        '[style.transition]': 'transition',
        '(focus)': 'onEnter()',
        '(blur)': 'onLeave()',
        '(mouseenter)': 'onEnter()',
        '(mouseleave)': 'onLeave()'
    },
    hostDirectives: [
        {
            directive: TooltipDirective,
            inputs: ['appTooltip: tooltip', 'position', 'delay'],
            outputs: []
        }
    ]
})
export class HighlightDirective {
    private readonly el = inject(ElementRef);
    private readonly fallback = inject(HIGHLIGHT_DEFAULT_COLOR);

    /**
     * Default background color.
     */
    readonly color = input('transparent');

    /**
     * Hover background color.
     */
    readonly hoverColor = input('#ffffcc');

    /**
     * Whether highlighting is enabled.
     */
    readonly enabled = input(true);

    /**
     * Highlight intensity.
     */
    readonly intensity = input<'subtle' | 'normal' | 'strong'>('normal');

    /**
     * Fires whenever a highlight becomes active (e.g. on hover enter).
     */
    readonly highlighted = output<string>();

    /**
     * Current background color.
     */
    bgColor = 'transparent';

    /**
     * CSS transition.
     */
    transition = 'background-color 0.2s';

    constructor() {
        effect(() => {
            this.bgColor = this.color();
        });
    }

    /**
     * Apply hover color.
     */
    onEnter(): void {
        if (this.enabled()) {
            const active = this.hoverColor() || this.fallback;
            this.bgColor = active;
            this.highlighted.emit(active);
        }
    }

    /**
     * Restore default color.
     */
    onLeave(): void {
        this.bgColor = this.color();
    }
}
