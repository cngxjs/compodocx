import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

// Multi-version fixture — port 4003.
//   v1.0.0 = sample-files/tsconfig.entry.json (no Bar*)
//   v2.0.0 = sample-files/tsconfig.simple.json (has Bar*)
//
// The fixture builds both versions into /tmp/compodoc-multi-version, writes
// versions.json next to them, and serves the parent. The switcher widget
// reads versions.json at runtime and uses HEAD fetch to detect when a page
// exists in the target version.
//   v0.9.0 = v2.0.0 moved back to the kind-folder layout, without a
//            redirects.json (see scripts/build-multi-version-fixture.mjs)

test.describe('VersionSwitcher — manifest is reachable', () => {
    test('versions.json is served from the deploy root', async ({ request }) => {
        const response = await request.get('/versions.json');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.schemaVersion).toBe(1);
        expect(body.versions.map(v => v.label).sort()).toEqual(['v0.9.0', 'v1.0.0', 'v2.0.0']);
    });
});

test.describe('VersionSwitcher — widget renders', () => {
    test('topbar widget shows the current label on a v2.0.0 page', async ({ page }) => {
        await page.goto('/v2.0.0/index.html');
        const widget = page.locator('.cdx-content-actions .cdx-version-switcher');
        await expect(widget).toBeVisible();
        const label = widget.locator('.cdx-version-switcher-label');
        await expect(label).toHaveText('v2.0.0');
    });

    test('opens the menu and lists every version', async ({ page }) => {
        await page.goto('/v2.0.0/index.html');
        const trigger = page.locator('.cdx-content-actions .cdx-version-switcher-trigger');
        await trigger.click();
        const menu = page.locator('.cdx-content-actions .cdx-version-switcher-menu');
        await expect(menu).toBeVisible();
        await expect(menu.locator('.cdx-version-switcher-item')).toHaveCount(3);
    });
});

test.describe('VersionSwitcher — navigation', () => {
    test('clicking v1.0.0 from v2.0.0 root lands on v1.0.0 root', async ({ page }) => {
        await page.goto('/v2.0.0/index.html');
        await page.locator('.cdx-content-actions .cdx-version-switcher-trigger').click();
        await page.locator('[data-cdx-target-label="v1.0.0"]').first().click();
        await page.waitForURL(/\/v1\.0\.0\//);
        expect(page.url()).toMatch(/\/v1\.0\.0\/index\.html/);
    });

    test('clicking v1.0.0 from a v2.0.0 page that does NOT exist in v1.0.0 falls back to v1.0.0 root', async ({
        page
    }) => {
        // BarComponent exists in v2.0.0 (full tsconfig) but NOT in v1.0.0
        // (entry tsconfig only ships foo.*). The HEAD fetch returns 404 in
        // v1.0.0 and the switcher falls back to /v1.0.0/.
        await page.goto(`/v2.0.0${pageUrl('component', 'BarComponent')}`);
        await page.locator('.cdx-content-actions .cdx-version-switcher-trigger').click();
        await page.locator('[data-cdx-target-label="v1.0.0"]').first().click();
        await page.waitForURL(/\/v1\.0\.0\//);
        // Either the version root index, or any path under v1.0.0/ — never
        // a stranded BarComponent path that returns 404.
        expect(page.url()).not.toMatch(/v1\.0\.0\/components\/BarComponent\.html/);
    });
});

test.describe('VersionSwitcher — current label highlighting', () => {
    test('the current version is marked with aria-current and the modifier class', async ({
        page
    }) => {
        await page.goto('/v2.0.0/index.html');
        await page.locator('.cdx-content-actions .cdx-version-switcher-trigger').click();
        const current = page.locator('.cdx-content-actions .cdx-version-switcher-item--current');
        await expect(current).toHaveAttribute('aria-current', 'true');
        await expect(current).toHaveText('v2.0.0');
    });
});

/** The page `url` (current layout) had before pages moved, from v2.0.0's redirect map. */
const oldPathOf = (url: string): string => {
    const { redirects } = JSON.parse(
        readFileSync('/tmp/compodoc-multi-version/v2.0.0/redirects.json', 'utf8')
    ) as { redirects: Record<string, string> };
    const old = Object.keys(redirects).find(
        key =>
            redirects[key] === url.replace(/^\//, '') &&
            !key.includes('#') &&
            !key.startsWith('miscellaneous/')
    );
    if (!old) {
        throw new Error(`No old path for ${url}`);
    }
    return old;
};

const switchTo = async (page: import('@playwright/test').Page, label: string) => {
    await page.locator('.cdx-content-actions .cdx-version-switcher-trigger').click();
    await page.locator(`[data-cdx-target-label="${label}"]`).first().click();
    await page.waitForURL(new RegExp(`/${label.replaceAll('.', '\\.')}/`));
};

test.describe('VersionSwitcher - pages that moved between layouts', () => {
    test('from a feature-folder page, an older version opens the page at its old path', async ({
        page
    }) => {
        const url = pageUrl('component', 'FooComponent');
        await page.goto(`/v2.0.0${url}`);
        await switchTo(page, 'v0.9.0');
        expect(new URL(page.url()).pathname).toBe(`/v0.9.0/${oldPathOf(url)}`);
        await expect(page.locator('h1')).toContainText('FooComponent');
    });

    test('from an old-layout page, the newer version follows its redirect map', async ({
        page
    }) => {
        const url = pageUrl('component', 'FooComponent');
        await page.goto(`/v0.9.0/${oldPathOf(url)}`);
        await switchTo(page, 'v2.0.0');
        expect(new URL(page.url()).pathname).toBe(`/v2.0.0${url}`);
    });

    test('serves the redirect map next to the pages of a version', async ({ request }) => {
        const res = await request.get('/v2.0.0/redirects.json');
        expect(res.ok()).toBe(true);
        const body = await res.json();
        expect(body.schemaVersion).toBe(1);
        expect(body.redirects[oldPathOf(pageUrl('component', 'FooComponent'))]).toBe(
            pageUrl('component', 'FooComponent').slice(1)
        );
    });
});
