import { expect, test } from '@playwright/test';

test.describe('Sidebar', () => {
    test('desktop: sections default expanded without saved state (toggleMenuItems: all)', async ({
        page
    }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('compodocx-sidebar-state'));
        await page.reload();

        const sidebar = page.locator('#sidebar');
        const collapseSections = sidebar.locator('.collapse');
        const count = await collapseSections.count();
        expect(count).toBeGreaterThan(0);

        // Default toggleMenuItems is ['all'], so top-level sections start expanded
        const firstSection = collapseSections.first();
        await expect(firstSection).toHaveClass(/\bin\b/);
    });

    test('desktop: expand/collapse persists to localStorage', async ({ page }) => {
        // Flaky across every engine: localStorage.getItem returns null after
        // the toggler click + 300ms wait, even though the write itself is
        // synchronous. Originally observed on WebKit (commit fc36b147), now
        // reproduces intermittently on Chromium too (CI run 25743890161 on
        // develop, all 3 retries red). Not a regression in the persistence
        // layer — the dom-mutation path is identical across engines — but
        // the 300ms-then-read pattern is not a reliable synchronization
        // primitive. Re-enable once the test waits on a deterministic
        // signal (storage event, MutationObserver, or polled getItem)
        // instead of a sleep.
        test.fixme();

        await page.goto('/');
        await page.evaluate(() => localStorage.removeItem('compodocx-sidebar-state'));
        await page.reload();

        const toggler = page.locator('#sidebar [data-cdx-toggle="collapse"]').first();
        await toggler.click();
        await page.waitForTimeout(300);

        const saved = await page.evaluate(() => localStorage.getItem('compodocx-sidebar-state'));
        expect(saved).toBeTruthy();
        const state = JSON.parse(saved!);
        const hasOpenEntry = Object.values(state).some(v => v === true);
        expect(hasOpenEntry).toBe(true);
    });
});

test.describe('Mobile menu', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test.skip('hamburger button toggles mobile sidebar', async ({ page }) => {
        await page.goto('/');

        const sidebar = page.locator('#sidebar');
        await expect(sidebar).not.toHaveClass(/cdx-sidebar--open/);

        await page.locator('[data-cdx-mobile-toggle]').click();
        await expect(sidebar).toHaveClass(/cdx-sidebar--open/);

        // Close via backdrop (force: true avoids intercepted pointer from sidebar overlay)
        await page.locator('.cdx-backdrop').click({ force: true });
        await page.waitForTimeout(300);
        await expect(sidebar).not.toHaveClass(/cdx-sidebar--open/);
    });

    test('mobile sidebar closes on navigation', async ({ page }) => {
        await page.goto('/');

        await page.locator('[data-cdx-mobile-toggle]').click();
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toHaveClass(/cdx-sidebar--open/);

        // Sections start expanded by default, so just click a visible link
        const link = sidebar.locator('a[data-type="entity-link"]').first();
        await link.scrollIntoViewIfNeeded();
        await link.click();
        await page.waitForTimeout(300);
        await expect(sidebar).not.toHaveClass(/cdx-sidebar--open/);
    });
});

test.describe('Mobile menu auto-close on resize', () => {
    test('closes when viewport exceeds 768px', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/');

        await page.locator('[data-cdx-mobile-toggle]').click();
        const sidebar = page.locator('#sidebar');
        await expect(sidebar).toHaveClass(/cdx-sidebar--open/);

        await page.setViewportSize({ width: 1024, height: 768 });
        await page.waitForTimeout(200);
        await expect(sidebar).not.toHaveClass(/cdx-sidebar--open/);
    });
});

test.describe('Command palette', () => {
    test('opens with Cmd+K and closes with Escape', async ({ page }) => {
        await page.goto('/');

        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).not.toBeVisible();

        await page.keyboard.press('Meta+k');
        await expect(dialog).toBeVisible();

        const input = dialog.locator('.cdx-cp-input');
        await expect(input).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(dialog).not.toBeVisible();
    });

    test('opens when sidebar search trigger is clicked', async ({ page }) => {
        await page.goto('/');

        // Click the search trigger button in sidebar header (use .cdx-search-trigger which is sidebar-only)
        await page.locator('.cdx-search-trigger').click();
        await page.waitForTimeout(200);

        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
    });

    test('closes on backdrop click', async ({ page }) => {
        await page.goto('/');

        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();

        // Click the dialog backdrop area
        await dialog.click({ position: { x: 10, y: 10 } });
        await expect(dialog).not.toBeVisible();
    });
});

test.describe('Dark mode', () => {
    test('inline script applies dark class from localStorage', async ({ page }) => {
        await page.goto('/');
        await page.evaluate(() => localStorage.setItem('compodocx_darkmode-state', 'true'));
        await page.reload();

        const htmlHasDark = await page.evaluate(() =>
            document.documentElement.classList.contains('dark')
        );
        expect(htmlHasDark).toBe(true);
    });

    test('toggle switches dark mode off and on', async ({ page }) => {
        await page.goto('/');

        // Click the content-area .cdx-dark-toggle button (topbar one is hidden at desktop)
        await page.locator('.cdx-content-actions .cdx-dark-toggle').click();
        await page.waitForTimeout(100);

        const noDark = await page.evaluate(
            () =>
                !document.documentElement.classList.contains('dark') &&
                !document.body.classList.contains('dark')
        );
        expect(noDark).toBe(true);

        // Click again to toggle dark mode back on
        await page.locator('.cdx-content-actions .cdx-dark-toggle').click();
        await page.waitForTimeout(100);

        const hasDark = await page.evaluate(
            () =>
                document.documentElement.classList.contains('dark') &&
                document.body.classList.contains('dark')
        );
        expect(hasDark).toBe(true);
    });
});

test.describe('SPA navigation', () => {
    test('sidebar link swaps content without full page reload', async ({ page }) => {
        await page.goto('/');
        const initialUrl = page.url();

        const entityLink = page.locator('#sidebar a[data-type="entity-link"]').first();

        // Expand the first section unless it already starts expanded
        if (!(await entityLink.isVisible())) {
            const toggler = page.locator('#sidebar [data-cdx-toggle="collapse"]').first();
            await toggler.click();
            await page.waitForTimeout(300);
        }

        if ((await entityLink.count()) > 0) {
            // Mark the sidebar DOM to verify it wasn't replaced
            await page.evaluate(() => {
                document.querySelector('#sidebar')?.setAttribute('data-spa-marker', '1');
            });

            await entityLink.click();
            await page.waitForTimeout(500);

            // URL changed
            expect(page.url()).not.toBe(initialUrl);

            // Sidebar DOM was preserved (not replaced)
            const marker = await page.evaluate(() =>
                document.querySelector('#sidebar')?.getAttribute('data-spa-marker')
            );
            expect(marker).toBe('1');
        }
    });

    test('content scripts execute after SPA navigation', async ({ page }) => {
        await page.goto('/');

        const routesLink = page.locator('#sidebar a[href="routes.html"]');
        if ((await routesLink.count()) > 0) {
            await routesLink.click();
            await page.waitForTimeout(2000);

            const hasRoutesIndex = await page.evaluate(
                () => typeof (window as any).ROUTES_INDEX !== 'undefined'
            );
            expect(hasRoutesIndex).toBe(true);

            const svg = page.locator('#body-routes svg');
            await expect(svg).toBeVisible();
        }
    });
});

test.describe('Dependency graph', () => {
    test('SVG pan-zoom: zoom buttons work', async ({ page }) => {
        await page.goto('/overview.html');

        const svg = page.locator('#dependency-graph-container svg');
        await expect(svg).toBeVisible();

        const zoomIn = page.locator('#dep-zoom-in');
        await expect(zoomIn).toBeVisible();
        await zoomIn.click();
        await page.waitForTimeout(400);
        await expect(svg).toBeVisible();
    });
});
