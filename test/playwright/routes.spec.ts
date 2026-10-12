import { expect, test } from '@playwright/test';

test.describe('Routes page', () => {
    test('renders the router and the unmounted routes without script', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto('/routes.html');
        await expect(page.locator('h2#route-0')).toContainText('Router');
        await expect(page.locator('h2#route-1')).toContainText('PARTNER_ROUTES');
        await expect(page.locator('table.cdx-routes-table tbody tr')).toHaveCount(23);
        await context.close();
    });

    test('is linked from the sidebar', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page.locator('#sidebar a[href$="routes.html"]').first()).toBeVisible();
    });

    test('the command palette finds a route by its path and opens its row', async ({ page }) => {
        await page.goto('/index.html');
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
});
