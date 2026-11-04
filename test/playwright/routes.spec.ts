import { expect, test } from '@playwright/test';

import { featureUrl, pageUrl, rootUrl } from './pages';

test.describe('Routes page', () => {
    test('renders the router and the unmounted routes without script', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto(rootUrl('routes'));
        await expect(page.locator('h2#route-0')).toContainText('Router');
        await expect(page.locator('h2#route-1')).toContainText('PARTNER_ROUTES');
        await expect(page.locator('ol.cdx-routes-tree > li')).toHaveCount(23);
        await context.close();
    });

    test('shows the tree: nested rows indented, lazy targets, redirects, features', async ({
        page
    }) => {
        await page.goto(rootUrl('routes'));
        const entry = page.locator('#route-0-10-2-1-0');
        await expect(entry).toHaveClass(/cdx-routes-depth-3/);
        await expect(entry.locator('.cdx-routes-path')).toHaveAttribute(
            'title',
            '/admin/audit/:entry'
        );
        await expect(page.locator('#route-0-10-2-1 .cdx-routes-path-own')).toHaveText(':entry');
        await expect(page.locator('#route-0-3')).toContainText('lazy');
        await expect(page.locator('#route-0-0')).toContainText('Redirect');
        await expect(page.locator('.cdx-routes-meta').first()).toContainText('withHashLocation()');
        await expect(page.locator('#route-0-11')).toContainText('@rta/remote');
    });

    test('is linked from the sidebar', async ({ page }) => {
        await page.goto(rootUrl('index'));
        await expect(page.locator('#sidebar a[href$="routes.html"]').first()).toBeVisible();
    });

    test('a component links the routes it is rendered at', async ({ page }) => {
        await page.goto(pageUrl('component', 'RtaProfile'));
        const links = page.locator('[data-compodoc="routed-at"] a.cdx-chip');
        await expect(links).toHaveCount(2);
        await expect(links.first()).toContainText('/account/profile');
        await links.first().click();
        await expect(page).toHaveURL(/routes\.html#route-0-4-0$/);
        await expect(page.locator('#route-0-4-0')).toBeVisible();
    });

    test('a route array links where it is mounted', async ({ page }) => {
        await page.goto(pageUrl('variable', 'AUDIT_ROUTES'));
        const links = page.locator('[data-compodoc="routed-at"] a.cdx-chip');
        await expect(links).toHaveCount(1);
        await expect(links.first()).toContainText('/admin/audit');
    });

    test('a guard links the routes using it, with the role', async ({ page }) => {
        await page.goto(pageUrl('guard', 'rtaAuthGuard'));
        const links = page.locator('[data-compodoc="routed-at"] a.cdx-chip');
        await expect(page.locator('#used-in-routes')).toContainText('Used in routes');
        await expect(links).toHaveCount(1);
        await expect(links.first()).toHaveText('/account - canActivate');
        await links.first().click();
        await expect(page).toHaveURL(/routes\.html#route-0-4$/);
        await expect(page.locator('#route-0-4')).toBeVisible();
    });

    test('a resolver links its route with the resolve key', async ({ page }) => {
        await page.goto(pageUrl('resolver', 'rtaUserResolver'));
        const links = page.locator('[data-compodoc="routed-at"] a.cdx-chip');
        await expect(links).toHaveCount(1);
        await expect(links.first()).toHaveText('/account/profile - resolve: user');
        await expect(links.first()).toHaveAttribute('href', /routes\.html#route-0-4-0$/);
    });

    test('a feature page shows the routes of its members as a tree', async ({ page }) => {
        await page.goto(featureUrl(['admin']));
        const section = page.locator('[data-compodoc="feature-routes"]');
        const parent = section.locator('[data-cdx-route="0-10"]');
        await expect(parent).toHaveClass(/cdx-routes-row--context/);
        await expect(parent.locator('[data-cdx-route-fact="canMatch"]')).toContainText(
            'rtaAdminMatch'
        );
        const users = section.locator('[data-cdx-route="0-10-1"]');
        await expect(users).toHaveClass(/cdx-routes-depth-1/);
        await expect(users.locator('.cdx-routes-path')).toHaveAttribute('title', '/admin/users');
        await expect(users.locator('.cdx-routes-path-own')).toHaveText('users');
        await users.locator('a.cdx-routes-path-link').click();
        await expect(page).toHaveURL(/routes\.html#route-0-10-1$/);
    });

    test('a feature page links its route tree to the routes page', async ({ page }) => {
        await page.goto(featureUrl(['admin']));
        const link = page.locator('.cdx-feature-routes-link a');
        await expect(link).toHaveText('View on the routes page');
        await expect(link).toHaveAttribute('href', /routes\.html#route-0-10$/);
    });

    test('the command palette finds a route by its path and opens its row', async ({ page }) => {
        await page.goto(rootUrl('index'));
        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
        await dialog.locator('.cdx-cp-input').fill('audit/:entry');
        const row = dialog.locator('.cdx-cp-item[href$="routes.html#route-0-10-2-1"]');
        await expect(row.first()).toBeVisible({ timeout: 10_000 });
        await expect(row.first().locator('.cdx-cp-kind')).toContainText('Route');
        await row.first().click();
        await expect(page).toHaveURL(/routes\.html#route-0-10-2-1$/);
    });

    test('keeps the page within a phone-width viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto(rootUrl('routes'));
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
        const tree = page.locator('ol.cdx-routes-tree').first();
        const scrolls = await tree.evaluate(el => el.scrollWidth > el.clientWidth);
        expect(scrolls).toBe(false);
    });
});
