import { Directive, input, inject, ElementRef, Renderer2, OnDestroy } from '@angular/core';

/**
 * Tooltip position type.
 */
export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Standalone tooltip directive with signal inputs.
 *
 * @example
 * ```html
 * <button appTooltip="Save changes" [position]="'bottom'">Save</button>
 * ```
 *
 * @since 2.0.0
 */
@Directive({
    selector: '[appTooltip]',
    standalone: true,
    exportAs: 'tooltip',
    host: {
        '(mouseenter)': 'onEnter()',
        '(mouseleave)': 'onLeave()',
    },
})
export class TooltipDirective implements OnDestroy {
    private readonly el = inject(ElementRef);
    private readonly renderer = inject(Renderer2);

    /**
     * Tooltip text.
     */
    readonly text = input.required<string>({ alias: 'appTooltip' });

    /**
     * Position relative to host.
     */
    readonly position = input<TooltipPosition>('top');

    /**
     * Show delay in ms.
     */
    readonly delay = input(300);

    private tooltipEl: HTMLElement | null = null;

    /**
     * Show tooltip on hover.
     */
    onEnter(): void {
        if (this.tooltipEl || !this.text()) return;
        this.tooltipEl = this.renderer.createElement('div');
        this.renderer.appendChild(this.tooltipEl!, this.renderer.createText(this.text()));
        this.renderer.appendChild(document.body, this.tooltipEl);
    }

    /**
     * Hide tooltip.
     */
    onLeave(): void {
        if (this.tooltipEl) {
            this.renderer.removeChild(document.body, this.tooltipEl);
            this.tooltipEl = null;
        }
    }

    /** @ignore */
    ngOnDestroy(): void {
        this.onLeave();
    }

    /**
     * Programmatic show.
     */
    show(): void {
        this.onEnter();
    }

    /**
     * Programmatic hide.
     */
    hide(): void {
        this.onLeave();
    }
}
