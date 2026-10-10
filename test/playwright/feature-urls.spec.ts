import { expect, type Page, test } from '@playwright/test';
import { featureUrl, hrefTo, pageUrl } from './pages';

// Page URLs grouped by entry point and feature (semantic-library fixture,
// port 4005): pages live in their feature folder at any depth, feature
// pages are the folder's index.html, and redirects.json maps the old URLs.

/** Same-origin responses that failed while a page loaded. */
const failedRequests = (page: Page): string[] => {
    const failed: string[] = [];
    page.on('response', response => {
        const url = new URL(response.url());
        if (
            url.origin === new URL(page.url() || 'http://localhost:4005').origin &&
            response.status() >= 400
        ) {
            failed.push(`${response.status()} ${url.pathname}`);
        }
    });
    return failed;
};

test.describe('Feature URLs', () => {
    test('a feature page is the index.html of its folder and loads its assets', async ({
        page
    }) => {
        const failed = failedRequests(page);
        await page.goto(featureUrl(['core', 'select']));
        expect(new URL(page.url()).pathname).toMatch(/\/core\/select\/index\.html$/);
        await expect(page.locator('.cdx-entity-hero[data-cdx-feature] h1')).toHaveText('select');
        await expect(page.locator('.cdx-sidebar')).toBeVisible();
        expect(failed).toEqual([]);
    });

    test('a symbol page lives in its feature folder and climbs back to the root', async ({
        page
    }) => {
        const failed = failedRequests(page);
        const url = pageUrl('component', 'SemSelectChips');
        await page.goto(url);
        expect(url.split('/').length - 2).toBeGreaterThan(1);
        await expect(page.locator('h1.cdx-entity-hero-name')).toContainText('SemSelectChips');
        expect(failed).toEqual([]);
        const crumb = page.locator('.cdx-breadcrumb a').first();
        await expect(crumb).toHaveAttribute('href', hrefTo(featureUrl(['core', 'select'])));
        await crumb.click();
        await expect(page.locator('.cdx-entity-hero[data-cdx-feature] h1')).toHaveText('select');
    });

    test('root-relative sidebar links work from a page two folders deep', async ({ page }) => {
        await page.goto(pageUrl('component', 'SemSelectChips'));
        await page.locator('.cdx-sidebar a.cdx-sidebar-brand').click();
        await page.waitForURL(/\/index\.html$/);
        expect(new URL(page.url()).pathname).toBe('/index.html');
    });

    test('redirects.json maps the pages of earlier layouts to their new place', async ({
        request
    }) => {
        const res = await request.get('/redirects.json');
        expect(res.ok()).toBe(true);
        const { schemaVersion, redirects } = await res.json();
        expect(schemaVersion).toBe(1);
        const chips = pageUrl('component', 'SemSelectChips').slice(1);
        const old = Object.keys(redirects).filter(key => redirects[key] === chips);
        expect(old.length).toBeGreaterThan(0);
        expect(redirects['features/core/select.html']).toBe(
            featureUrl(['core', 'select']).slice(1)
        );
    });
});
