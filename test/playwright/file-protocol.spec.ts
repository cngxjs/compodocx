import { pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

/**
 * A generated site opened from disk (`file://`, no server) keeps its
 * interactive parts: the client bundle is a classic script, which browsers
 * run on `file://`, unlike a module script. Reads the todomvc build the
 * `todomvc` project serves on port 4001 (`npm run test:todomvc-doc`).
 */
const SITE = '/tmp/compodoc-todomvc';
const fileUrl = (page: string): string => pathToFileURL(`${SITE}/${page}`).href;

test.describe('Site opened from file://', () => {
    test('runs the client script without page errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(fileUrl('overview.html'));

        const isDark = () =>
            page.evaluate(() => document.documentElement.classList.contains('dark'));
        const before = await isDark();
        await page.locator('.cdx-dark-toggle:visible').first().click();
        await expect.poll(isDark).toBe(!before);
        expect(errors).toEqual([]);
    });

    test('draws the dependency graph', async ({ page }) => {
        await page.goto(fileUrl('overview.html'));
        const graph = page.locator('#dependency-graph-container');
        await graph.scrollIntoViewIfNeeded();

        await expect(graph.locator('.cdx-graph-node').first()).toBeVisible();
        expect(await graph.locator('.cdx-graph-node').count()).toBeGreaterThan(0);
    });
});
