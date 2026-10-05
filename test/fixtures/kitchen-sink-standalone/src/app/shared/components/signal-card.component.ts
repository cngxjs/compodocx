import {
    Component,
    input,
    output,
    model,
    computed,
    signal,
    linkedSignal,
    effect,
    contentChild,
    contentChildren,
    viewChild,
    viewChildren,
    TemplateRef,
    ElementRef,
    ChangeDetectionStrategy,
} from '@angular/core';

/**
 * A card component demonstrating ALL signal-based APIs.
 *
 * Exercises `input()`, `input.required()`, `output()`, `model()`,
 * `model.required()`, `computed()`, `signal()`, `linkedSignal()`,
 * `effect()`, `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`.
 *
 * @example
 * ```html
 * <app-signal-card
 *   [title]="'Hello'"
 *   [(expanded)]="isExpanded"
 *   [variant]="'outlined'"
 *   (clicked)="onCardClick($event)">
 *   <ng-template #headerSlot>Custom Header</ng-template>
 *   <p>Card body content</p>
 * </app-signal-card>
 * ```
 *
 * @since 2.0.0
 * @aiGenerated claude-opus-4.7
 *
 * <example-url>../assets/signal-card-short.html</example-url>
 * <example-url>../assets/signal-card-tall.html</example-url>
 * <example-url>../assets/signal-card-medium.html</example-url>
 */
@Component({
    selector: 'app-signal-card',
    standalone: true,
    template: `
        <article #cardEl class="card">
            <header #headerEl (click)="onClick()">{{ displayTitle() }}</header>
            <div *ngIf="expanded()" class="body"><ng-content /></div>
        </article>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[class]': 'hostClass',
        '[attr.tabindex]': 'tabIndex',
        '(focus)': 'onFocus()',
    },
})
export class SignalCardComponent {
    /**
     * Card title (required input signal).
     */
    readonly title = input.required<string>();

    /**
     * Card variant style.
     */
    readonly variant = input<'filled' | 'outlined' | 'elevated'>('filled');

    /**
     * Whether the card has a shadow.
     */
    readonly shadow = input(true);

    /**
     * Maximum height in pixels.
     */
    readonly maxHeight = input<number | undefined>(undefined);

    /**
     * Whether the card is expanded (two-way binding).
     */
    readonly expanded = model(false);

    /**
     * The selected item (required two-way binding).
     */
    readonly selectedIndex = model.required<number>();

    /**
     * Emitted when the card is clicked.
     */
    readonly clicked = output<MouseEvent>();

    /**
     * Emitted when the card is closed.
     */
    readonly closed = output<void>();

    /**
     * Internal click count.
     */
    private readonly clickCount = signal(0);

    /**
     * Computed display title with click count.
     */
    readonly displayTitle = computed(
        () => `${this.title()} (${this.clickCount()} clicks)`
    );

    /**
     * Linked signal that resets when title changes.
     */
    readonly linkedTitle = linkedSignal(() => this.title());

    /**
     * Whether the card is in compact mode.
     */
    readonly isCompact = computed(() => (this.maxHeight() ?? Infinity) < 200);

    /**
     * The card article element.
     */
    readonly cardEl = viewChild.required<ElementRef>('cardEl');

    /**
     * Header elements in the view.
     */
    readonly headerEls = viewChildren<ElementRef>('headerEl');

    /**
     * Projected header slot template.
     */
    readonly headerSlot = contentChild<TemplateRef<unknown>>('headerSlot');

    /**
     * All projected action templates.
     */
    readonly actionSlots = contentChildren<TemplateRef<unknown>>('actionSlot');

    /**
     * CSS class derived from variant.
     */
    get hostClass(): string {
        return `card-${this.variant()}`;
    }

    /**
     * Tab index for keyboard access.
     */
    tabIndex = 0;

    /**
     * Focus handler.
     */
    onFocus(): void {
        // track focus state
    }

    constructor() {
        effect(() => {
            console.log('Card expanded:', this.expanded());
        });
    }

    /**
     * Handle card header click.
     */
    onClick(): void {
        this.clickCount.update((c) => c + 1);
        this.expanded.update((e) => !e);
    }

    /**
     * Close the card.
     */
    close(): void {
        this.expanded.set(false);
        this.closed.emit();
    }
}
