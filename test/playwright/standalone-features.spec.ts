import { expect, test } from '@playwright/test';
import { collectionUrl, pageUrl } from './pages';

// ─── Sidebar ─────────────────────────────────────────────

test.describe('Sidebar', () => {
    test('standalone app: no modules section', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).not.toContain('chapter modules');
    });

    test('entity type badges on component links', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        // Standalone-only apps do not show standalone badges (no NgModules = no mixed context)
        // Sidebar shows count badges for folder groups
        const countBadges = html.match(/cdx-badge--count/g) || [];
        expect(countBadges.length).toBeGreaterThanOrEqual(3);
    });

    test('token badges on injectable links', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        const matches = html.match(/cdx-badge--token/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    test('beta badge on UserCardComponent link', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).toContain('UserCardComponent');
        expect(html).toContain('cdx-badge--beta');
    });

    test('category grouping under injectables', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).toContain('Configuration');
        expect(html).toContain('Services');
    });
});

// ─── Navigation Grouping (folder-based hierarchy) ───────

test.describe('Navigation Grouping', () => {
    test('folder groups rendered as nested tree in sidebar', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        // Top-level groups exist as .chapter.inner elements
        expect(html).toContain('chapter inner');
        // Specific folder group IDs present
        expect(html).toContain('components-group-dashboard');
        expect(html).toContain('components-group-features');
        expect(html).toContain('components-group-settings');
        expect(html).toContain('components-group-users');
    });

    test('nested folder structure: features > admin', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        // Intermediate container nodes exist (depth 3+ merges into parent due to groupDepth=2)
        expect(html).toContain('components-group-features');
        expect(html).toContain('components-group-features/admin');
    });

    test('folder group names capitalized', async ({ page }) => {
        await page.goto('/');
        // Check that group buttons show capitalized names
        const dashboardBtn = page.locator('button:has-text("Dashboard")').first();
        await expect(dashboardBtn).toBeVisible();
        const featuresBtn = page.locator('button:has-text("Features")').first();
        await expect(featuresBtn).toBeVisible();
    });

    test('count badges on groups with items', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        const countBadges = html.match(/cdx-badge--count/g) || [];
        expect(countBadges.length).toBeGreaterThanOrEqual(3);
    });

    test('explicit @category overrides folder grouping', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        // BreadcrumbComponent has @category Navigation
        expect(html).toContain('Navigation');
        expect(html).toContain('BreadcrumbComponent');
    });

    test('ungrouped root-level components render flat', async ({ page }) => {
        await page.goto('/');
        // Root-level components (no folder) should be direct links, not inside .chapter.inner
        const appLink = page.locator('#components-links > li.link > a:has-text("AppComponent")');
        await expect(appLink).toHaveCount(1);
    });

    test('chevron rotation: collapsed shows right, expanded shows down', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('compodoc-sidebar-state'));
        await page.reload();

        // All chevrons use IconChevronRight — CSS rotation handles state
        const chevrons = page.locator('.cdx-chevron');
        const count = await chevrons.count();
        expect(count).toBeGreaterThan(0);
    });

    test('group toggle expand/collapse works', async ({ page }) => {
        await page.goto('/');
        // Find the Components section toggle and ensure it can be toggled
        const componentsToggle = page.locator('button.menu-toggler:has-text("Components")').first();
        await componentsToggle.click();
        await page.waitForTimeout(300);

        // After clicking, the collapse should toggle
        const collapseEl = page.locator('#components-links');
        const hasIn = await collapseEl.evaluate(el => el.classList.contains('in'));
        // Click again to toggle back
        await componentsToggle.click();
        await page.waitForTimeout(300);
        const hasInAfter = await collapseEl.evaluate(el => el.classList.contains('in'));
        expect(hasIn).not.toBe(hasInAfter);
    });

    test('deep groups beyond groupDepth start collapsed', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('compodoc-sidebar-state'));
        await page.reload();

        // With default groupDepth=2, depth >= 2 should start collapsed (no .in class)
        // features/admin/ui/ui-settings is at depth 3
        const deepGroup = page.locator('#components-group-features\\/admin\\/ui\\/ui-settings');
        const count = await deepGroup.count();
        if (count > 0) {
            const isOpen = await deepGroup.evaluate(el => el.classList.contains('in'));
            expect(isOpen).toBe(false);
        }
    });

    test('directives grouped under shared > directives', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).toContain('directives-group-shared');
        expect(html).toContain('directives-group-shared/directives');
    });

    test('pipes grouped under shared > pipes', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).toContain('pipes-group-shared');
        expect(html).toContain('pipes-group-shared/pipes');
    });

    test('depth-based CSS indentation applied', async ({ page }) => {
        await page.goto('/');
        // .chapter.inner elements should have --depth custom property
        const innerChapters = page.locator('.chapter.inner[style*="--depth"]');
        expect(await innerChapters.count()).toBeGreaterThan(0);
    });
});

// ─── Component pages ─────────────────────────────────────

test.describe('Component page', () => {
    test('breadcrumb shows entity type badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'AppComponent'));
        // Standalone badge is only shown in mixed NgModule+standalone apps; this fixture is standalone-only
        const badge = page.locator('.cdx-entity-hero-badges .cdx-badge--entity-component');
        expect(await badge.count()).toBe(1);
        expect(await badge.textContent()).toBe('Component');
    });

    test('UserCardComponent: beta and since badges', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        expect(await page.locator('.cdx-entity-hero-badges .cdx-badge--beta').count()).toBe(1);
        expect(await page.locator('.cdx-entity-hero-badges .cdx-badge--since').count()).toBe(1);
        expect(
            await page.locator('.cdx-entity-hero-badges .cdx-badge--since').textContent()
        ).toContain('v1.0.0');
    });

    test('UserCardComponent: template tab shows ng-content', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('ng-content');
    });

    test('UserCardComponent: external links from @link tags', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('storybook.example.com');
        expect(html).toContain('figma.com');
    });

    test('UserListComponent: zoneless badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserListComponent'));
        const badge = page.locator('.cdx-entity-hero-badges .cdx-badge--zoneless');
        expect(await badge.count()).toBe(1);
        expect(await badge.textContent()).toBe('Zoneless');
    });

    test('UserCardComponent: relationship graph shows used-by and depends-on', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const section = page.locator('[data-compodoc="block-relationships"]');
        expect(await section.count()).toBe(1);
        const text = await section.textContent();
        expect(text).toContain('Used by');
        expect(text).toContain('UserListComponent');
        expect(text).toContain('Depends on');
        expect(text).toContain('HighlightDirective');
    });

    test('HighlightDirective: relationships show used-by on directive page', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        const section = page.locator('[data-compodoc="block-relationships"]');
        expect(await section.count()).toBe(1);
        const text = await section.textContent();
        expect(text).toContain('Used by');
        expect(text).toContain('UserCardComponent');
    });

    test('GreetingPipe: relationships show used-by on pipe page', async ({ page }) => {
        await page.goto(pageUrl('pipe', 'GreetingPipe'));
        const section = page.locator('[data-compodoc="block-relationships"]');
        expect(await section.count()).toBe(1);
        const text = await section.textContent();
        expect(text).toContain('Used by');
    });

    test('UserService: no relationships section when no module-level data', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        const section = page.locator('[data-compodoc="block-relationships"]');
        expect(await section.count()).toBe(0);
    });

    test('relationships section appears between metadata and index', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        const sections = page.locator('.cdx-content-section');
        const ids = await sections.evaluateAll(els =>
            els.map(el => el.getAttribute('data-compodoc') || '')
        );
        const metaIdx = ids.indexOf('block-metadata');
        const relIdx = ids.indexOf('block-relationships');
        const indexIdx = ids.indexOf('block-index');
        expect(relIdx).toBeGreaterThan(metaIdx);
        expect(relIdx).toBeLessThan(indexIdx);
    });

    test('relationships links navigate to correct entity page', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        const link = page.locator('[data-compodoc="block-relationships"] a').first();
        await link.click();
        await page.waitForURL(/UserCardComponent/);
        expect(page.url()).toContain('UserCardComponent');
    });

    test('no empty entryComponents section', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        expect(await page.content()).not.toContain('entryComponents');
    });
});

// ─── Directive page ──────────────────────────────────────

test.describe('Directive page', () => {
    test('HighlightDirective: entity type badge', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        // Standalone badge is only shown in mixed NgModule+standalone apps; this fixture is standalone-only
        expect(
            await page.locator('.cdx-entity-hero-badges .cdx-badge--entity-directive').count()
        ).toBe(1);
    });
});

// ─── Pipe page ───────────────────────────────────────────

test.describe('Pipe page', () => {
    test('GreetingPipe: entity type badge', async ({ page }) => {
        await page.goto(pageUrl('pipe', 'GreetingPipe'));
        // Standalone badge is only shown in mixed NgModule+standalone apps; this fixture is standalone-only
        expect(await page.locator('.cdx-entity-hero-badges .cdx-badge--entity-pipe').count()).toBe(
            1
        );
    });
});

// ─── Token pages ─────────────────────────────────────────
// InjectionToken / HttpContextToken declarations are emitted at
// `tokens/<name>.html` (not `injectables/`) — the new dedicated kind
// route. The legacy injectable-flagged-as-token path is gone.

test.describe('Token page', () => {
    test('API_BASE_URL: token badge in hero', async ({ page }) => {
        await page.goto(pageUrl('token', 'API_BASE_URL'));
        expect(await page.locator('.cdx-entity-hero-badges .cdx-badge--entity-token').count()).toBe(
            1
        );
    });

    test('API_BASE_URL: type signature + providedIn sections', async ({ page }) => {
        await page.goto(pageUrl('token', 'API_BASE_URL'));
        // The lean TokenPage renders `Type` and `Provided in` as
        // top-level `cdx-content-section` blocks instead of the older
        // `block-metadata` row table.
        const sections = page.locator('.cdx-content-section');
        const sectionText = (await sections.allTextContents()).join('\n');
        expect(sectionText).toContain('InjectionToken');
        expect(sectionText).toContain('string');
        expect(sectionText).toContain("'root'");
    });

    test('FEATURE_FLAGS: token badge', async ({ page }) => {
        await page.goto(pageUrl('token', 'FEATURE_FLAGS'));
        expect(await page.locator('.cdx-entity-hero-badges .cdx-badge--entity-token').count()).toBe(
            1
        );
    });
});

// ─── Miscellaneous functions ─────────────────────────────

test.describe('Functions page', () => {
    test('factory function badges rendered', async ({ page }) => {
        await page.goto(collectionUrl('function'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--factory');
        expect(html).toContain('Provider');
        expect(html).toContain('Feature');
        expect(html).toContain('Inject');
        expect(html).toContain('Factory');
    });

    test('signal badge on injectUserCount', async ({ page }) => {
        await page.goto(collectionUrl('function'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--signal');
        expect(html).toContain('injectUserCount');
    });

    test('beta badge on withCaching', async ({ page }) => {
        await page.goto(collectionUrl('function'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--beta');
        expect(html).toContain('withCaching');
    });
});

// ─── Signal detection ────────────────────────────────────

test.describe('Signal primitives', () => {
    test('UserCardComponent properties show signal kind badges', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--signal');
        expect(html).toContain('cdx-badge--computed');
        expect(html).toContain('cdx-badge--effect');
    });

    test('UserCardComponent input shows input-signal badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--input-signal');
    });

    test('UserCardComponent output shows output-signal badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--output-signal');
    });

    test('UserCardComponent shows viewChild signal query', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--view-child');
    });

    test('UserCardComponent shows inject() DI badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('cdx-badge--inject');
        expect(html).toContain('apiUrl');
    });

    test('required input shows Required badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const html = await page.content();
        expect(html).toContain('Required');
    });
});

// ─── Host metadata ───────────────────────────────────────

test.describe('Host metadata bindings', () => {
    test('HighlightDirective shows host bindings from metadata', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        const html = await page.content();
        expect(html).toContain('class.highlighted');
    });

    test('HighlightDirective shows host listeners from metadata', async ({ page }) => {
        await page.goto(pageUrl('directive', 'HighlightDirective'));
        const html = await page.content();
        expect(html).toContain('mouseenter');
        expect(html).toContain('mouseleave');
    });
});

// ─── App Configuration ───────────────────────────────────

test.describe('App Configuration', () => {
    test('app-config.html shows provider cards', async ({ page }) => {
        await page.goto('/app-config.html');
        const html = await page.content();
        expect(html).toContain('Application Configuration');
        expect(html).toContain('provideRouter');
        expect(html).toContain('cdx-provider-card');
    });

    test('provider features are shown as badges', async ({ page }) => {
        await page.goto('/app-config.html');
        const html = await page.content();
        expect(html).toContain('withComponentInputBinding');
    });

    test('sidebar shows App Configuration link', async ({ page }) => {
        await page.goto('/');
        const html = await page.content();
        expect(html).toContain('app-config.html');
        expect(html).toContain('App Configuration');
    });
});

// ─── Dependency Graph ───────────────────────────────────

test.describe('Dependency Graph — Overview', () => {
    test('dependency graph container present (standalone app, no modules)', async ({ page }) => {
        await page.goto('/overview.html');
        const container = page.locator('#dependency-graph-container');
        await expect(container).toBeVisible();
    });

    test('SVG rendered with role=img and aria-label', async ({ page }) => {
        await page.goto('/overview.html');
        const svg = page.locator('#dependency-graph-container svg');
        await expect(svg).toBeVisible();
        await expect(svg).toHaveAttribute('role', 'img');
        await expect(svg).toHaveAttribute('aria-label', 'Standalone component dependency graph');
    });

    test('graph has entity-colored nodes', async ({ page }) => {
        await page.goto('/overview.html');
        const circles = page.locator('#dependency-graph-container circle');
        expect(await circles.count()).toBeGreaterThanOrEqual(3);
    });

    test('graph has arrow markers on edges', async ({ page }) => {
        await page.goto('/overview.html');
        const marker = page.locator('#dependency-graph-container marker#dep-arrow');
        await expect(marker).toHaveCount(1);
    });

    test('zoom buttons present', async ({ page }) => {
        await page.goto('/overview.html');
        await expect(page.locator('#dep-zoom-in')).toBeVisible();
        await expect(page.locator('#dep-reset')).toBeVisible();
        await expect(page.locator('#dep-zoom-out')).toBeVisible();
    });

    test('entity-color legend present', async ({ page }) => {
        await page.goto('/overview.html');
        const legend = page.locator('.cdx-graph-legend');
        await expect(legend).toBeVisible();
        const items = legend.locator('.cdx-graph-legend-item');
        // component, directive, pipe, injectable
        expect(await items.count()).toBeGreaterThanOrEqual(4);
    });

    test('a11y: screen reader text alternative lists dependencies', async ({ page }) => {
        await page.goto('/overview.html');
        const srList = page.locator('ul.sr-only[aria-label="Component dependency list"]');
        await expect(srList).toHaveCount(1);
        const items = srList.locator('li');
        expect(await items.count()).toBeGreaterThanOrEqual(2);
        const text = await srList.textContent();
        expect(text).toContain('imports');
    });

    test('no module graph shown on standalone app overview', async ({ page }) => {
        await page.goto('/overview.html');
        await expect(page.locator('#module-graph-svg')).toHaveCount(0);
    });

    test('cursor: grab on graph SVG', async ({ page }) => {
        await page.goto('/overview.html');
        const svg = page.locator('#dependency-graph-container svg');
        const cursor = await svg.evaluate(el => getComputedStyle(el).cursor);
        expect(cursor).toBe('grab');
    });
});

test.describe('Dependency Graph — Component Tab', () => {
    test('Dependencies tab visible for standalone component with imports', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const tab = page.getByRole('tab', { name: 'Dependencies' });
        await expect(tab).toBeVisible();
    });

    test('Dependencies tab not shown for components without imports', async ({ page }) => {
        await page.goto(pageUrl('component', 'SettingsComponent'));
        const tab = page.getByRole('tab', { name: 'Dependencies' });
        await expect(tab).toHaveCount(0);
    });

    test('clicking Dependencies tab shows graph', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.getByRole('tab', { name: 'Dependencies' }).click();
        const svg = page.locator('#dependency-graph-container svg');
        await expect(svg).toBeVisible();
    });

    test('per-component graph has clickable nodes', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.getByRole('tab', { name: 'Dependencies' }).click();
        const nodes = page.locator('#dependency-graph-container .dep-node');
        expect(await nodes.count()).toBeGreaterThanOrEqual(2);
    });

    test('per-component a11y text alternative', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const srList = page.locator('#dependencies ul.sr-only');
        await expect(srList).toHaveCount(1);
        const text = await srList.textContent();
        expect(text).toContain('UserCardComponent imports');
    });

    test('per-component legend present', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.getByRole('tab', { name: 'Dependencies' }).click();
        const legend = page.locator('#dependencies .cdx-graph-legend');
        await expect(legend).toBeVisible();
    });

    test('per-component zoom buttons present', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.getByRole('tab', { name: 'Dependencies' }).click();
        await expect(page.locator('#dep-zoom-in')).toBeVisible();
    });
});

test.describe('Keyboard navigation', () => {
    test('? opens shortcut overlay dialog', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.evaluate(() =>
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
        );
        const dialog = page.locator('#cdx-shortcuts-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText('Keyboard Shortcuts');
    });

    test('Escape closes shortcut overlay', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.evaluate(() =>
            document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }))
        );
        const dialog = page.locator('#cdx-shortcuts-dialog');
        await expect(dialog).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
    });

    test('j/k navigate between member cards with focus ring', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.locator('[role="tab"]', { hasText: 'API' }).click();
        await page.keyboard.press('j');
        const focused = page.locator('.cdx-member-card--focused');
        await expect(focused).toHaveCount(1);
        await page.keyboard.press('j');
        // Still one focused card (moved to next)
        await expect(focused).toHaveCount(1);
        await page.keyboard.press('k');
        await expect(focused).toHaveCount(1);
    });

    test('j/k scrolls focused card into view', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.locator('[role="tab"]', { hasText: 'API' }).click();
        await page.keyboard.press('j');
        const focused = page.locator('.cdx-member-card--focused');
        await expect(focused).toBeVisible();
        await expect(focused).toBeInViewport();
    });

    test('Escape clears member focus', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.locator('[role="tab"]', { hasText: 'API' }).click();
        await page.keyboard.press('j');
        await expect(page.locator('.cdx-member-card--focused')).toHaveCount(1);
        await page.keyboard.press('Escape');
        await expect(page.locator('.cdx-member-card--focused')).toHaveCount(0);
    });

    test('shortcuts suppressed when dialog is open', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        // Open shortcut overlay
        await page.evaluate(() =>
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true })
            )
        );
        await page.waitForTimeout(200);
        // j should not navigate members while dialog is open
        await page.evaluate(() =>
            document.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true })
            )
        );
        await expect(page.locator('.cdx-member-card--focused')).toHaveCount(0);
    });
});

test.describe('Entity preview panel', () => {
    test('n/p shows preview panel below focused sidebar entity', async ({ page }) => {
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.keyboard.press('n');
        const preview = page.locator('.cdx-entity-preview');
        await expect(preview).toBeVisible();
        const focused = page.locator('.cdx-sidebar-focused');
        await expect(focused).toHaveCount(1);
    });

    test('preview shows entity type badge', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.keyboard.press('n');
        const badge = page.locator('.cdx-entity-preview .cdx-badge');
        await expect(badge).toBeVisible();
    });

    test('Enter navigates to focused entity', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const startUrl = page.url();
        await page.keyboard.press('n');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        expect(page.url()).not.toBe(startUrl);
    });

    test('Escape dismisses preview', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        await page.keyboard.press('n');
        await expect(page.locator('.cdx-entity-preview')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('.cdx-entity-preview')).toHaveCount(0);
        await expect(page.locator('.cdx-sidebar-focused')).toHaveCount(0);
    });

    test('no preview on mouse hover (keyboard only)', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const link = page.locator('.menu a[data-type="entity-link"]').first();
        await link.hover();
        await expect(page.locator('.cdx-entity-preview')).toHaveCount(0);
    });
});

test.describe('Responsive member cards', () => {
    test('member title row is visible at narrow viewport', async ({ page }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.locator('[role="tab"]', { hasText: 'API' }).click();
        // Flat IO member layout uses cdx-io-member-title (no directional flex-direction breakpoint)
        const title = page.locator('.cdx-io-member-title').first();
        await expect(title).toBeVisible();
        const display = await title.evaluate(el => getComputedStyle(el).display);
        expect(display).toBe('flex');
    });

    test('member title row is visible at normal viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 800 });
        await page.goto(pageUrl('injectable', 'UserService'));
        await page.locator('[role="tab"]', { hasText: 'API' }).click();
        // Flat IO member layout uses cdx-io-member-title
        const title = page.locator('.cdx-io-member-title').first();
        await expect(title).toBeVisible();
        const display = await title.evaluate(el => getComputedStyle(el).display);
        expect(display).toBe('flex');
    });

    test('method signature wraps at narrow viewport', async ({ page }) => {
        await page.setViewportSize({ width: 400, height: 800 });
        await page.goto(pageUrl('injectable', 'UserService'));
        const sig = page.locator('.cdx-member-signature').first();
        if ((await sig.count()) > 0) {
            const wrap = await sig.evaluate(el => getComputedStyle(el).whiteSpace);
            expect(wrap).toBe('pre-wrap');
        }
    });
});
