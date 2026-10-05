import {
    Component,
    signal,
    computed,
    effect,
    inject,
    viewChild,
    viewChildren,
    contentChild,
    contentChildren,
    ElementRef,
    QueryList,
    TemplateRef,
    afterRender,
    afterNextRender,
    DestroyRef,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

/**
 * Root application component using modern standalone patterns.
 *
 * Demonstrates signals, inject(), view/content queries via signal-based APIs,
 * and after-render hooks.
 *
 * @example
 * ```typescript
 * bootstrapApplication(AppComponent, appConfig);
 * ```
 *
 * @since 2.0.0
 */
@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet],
    template: `
        <header>
            <h1>{{ title() }}</h1>
            <button (click)="toggleSidebar()">Menu</button>
        </header>
        <main #mainContent>
            <router-outlet />
        </main>
    `,
    styles: [`:host { display: block; min-height: 100vh; }`],
    host: {
        '[class]': 'hostClass',
        '(document:keydown.escape)': 'onEscape()',
    },
})
export class AppComponent {
    private readonly theme = inject(ThemeService);
    private readonly destroyRef = inject(DestroyRef);

    /**
     * Application title as a signal.
     */
    readonly title = signal('Kitchen Sink Standalone');

    /**
     * Whether the sidebar is open.
     */
    readonly sidebarOpen = signal(true);

    /**
     * Computed formatted title with sidebar state.
     */
    readonly headerTitle = computed(() =>
        this.sidebarOpen() ? this.title() : `${this.title()} [collapsed]`
    );

    /**
     * Current year computed from Date.
     */
    readonly currentYear = computed(() => new Date().getFullYear());

    /**
     * Main content element reference via signal query.
     */
    readonly mainContent = viewChild<ElementRef>('mainContent');

    /**
     * CSS class binding for the theme.
     */
    get hostClass(): string {
        return `theme-${this.theme.currentTheme()}`;
    }

    /**
     * Handle keyboard shortcuts.
     */
    onEscape(): void {
        this.sidebarOpen.set(false);
    }

    constructor() {
        effect(() => {
            console.log('Sidebar state:', this.sidebarOpen());
        });

        afterRender(() => {
            // post-render DOM measurement
        });

        afterNextRender(() => {
            // one-time initialization after first render
        });
    }

    /**
     * Toggle sidebar visibility.
     */
    toggleSidebar(): void {
        this.sidebarOpen.update((open) => !open);
    }
}
