import { expect, test } from '@playwright/test';
import { featureUrl, pageUrl } from './pages';

// Feature pages and the feature sidebar. Runs in two projects:
// - `semantic` (semantic-library, type layout, search on): feature pages,
//   README overview, builds on / extended by, breadcrumb, search palette.
// - `standalone-feature` (standalone-app, feature layout): the sidebar tree.

test.describe('Feature pages', () => {
    test.beforeEach(({ browserName: _ }, testInfo) => {
        test.skip(testInfo.project.name !== 'semantic', 'semantic-library feature pages');
    });

    test('a glued entry point is one feature page with import path, README and members', async ({
        page
    }) => {
        await page.goto(featureUrl(['core', 'select']));
        const hero = page.locator('.cdx-entity-hero[data-cdx-feature]');
        await expect(hero.locator('h1')).toHaveText('select');
        await expect(hero.locator('.cdx-entity-hero-selector code')).toHaveText(
            "import { ... } from '@sem/core/select';"
        );
        await expect(hero.locator('[data-cdx-feature-detector]')).toHaveText('Entry point');
        await expect(page.locator('h2#overview')).toHaveCount(1);
        await expect(page.locator('.cdx-readme')).toContainText(
            'A single-select built from small parts'
        );
        const members = page.locator(
            'h2#components-and-directives + table tr[data-cdx-feature-member]'
        );
        await expect(members).toHaveCount(4);
        await members.filter({ hasText: 'SemSelectListbox' }).locator('a').click();
        await expect(page.locator('h1.cdx-entity-hero-name')).toContainText('SemSelectListbox');
    });

    test('builds on and extended by link the related features of other entry points', async ({
        page
    }) => {
        await page.goto(featureUrl(['ui', 'select-field']));
        const buildsOn = page.locator('tr[data-cdx-feature-related="@sem/core/select#"] a');
        await expect(page.locator('h2#builds-on')).toHaveCount(1);
        await expect(buildsOn).toHaveText('select');
        await buildsOn.click();
        await expect(
            page.locator('.cdx-entity-hero[data-cdx-feature="@sem/core/select#"]')
        ).toBeVisible();
        await expect(page.locator('h2#extended-by')).toHaveCount(1);
        await expect(
            page.locator('tr[data-cdx-feature-related="@sem/ui#select-field"] a')
        ).toHaveText('select-field');
    });

    test('a sub-feature links its entry point; the symbol breadcrumb names entry point and feature', async ({
        page
    }) => {
        await page.goto(pageUrl('function', 'createStore'));
        const crumbs = page.locator('.cdx-breadcrumb li');
        await expect(crumbs.nth(0)).toHaveText('core');
        await expect(crumbs.nth(1)).toHaveText('di');
        await crumbs.nth(1).locator('a').click();
        await expect(
            page.locator('.cdx-entity-hero[data-cdx-feature="@sem/core#di"]')
        ).toBeVisible();
        await expect(page.locator('h2#configuration')).toHaveCount(1);
    });

    test('the search palette shows the feature of a result', async ({ page }) => {
        await page.goto('/index.html');
        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
        await dialog.locator('.cdx-cp-input').fill('SemSelectListbox');
        const item = dialog.locator(
            `.cdx-cp-item[href$="${pageUrl('component', 'SemSelectListbox').slice(1)}"]`
        );
        await expect(item.first()).toBeVisible({ timeout: 10_000 });
        await expect(item.first().locator('.cdx-cp-category')).toHaveText('select');
    });
});

test.describe('Feature sidebar', () => {
    test.beforeEach(({ browserName: _ }, testInfo) => {
        test.skip(
            testInfo.project.name !== 'standalone-feature',
            'standalone-app in the feature layout'
        );
    });

    test('lists the app root feature first, then each feature with its members', async ({
        page
    }) => {
        await page.goto('/index.html');
        const groups = page.locator('#features-links > li.cdx-feature-bucket');
        await expect(groups.first()).toHaveAttribute('data-cdx-bucket', 'app');
        const adminSettings = page.locator('#features-links li[data-cdx-bucket="admin-settings"]');
        await expect(adminSettings.locator('> .cdx-bucket-row a.cdx-bucket-link')).toHaveAttribute(
            'href',
            /features\/admin-settings\.html$/
        );
        await expect(
            adminSettings.locator('li.cdx-feature-link[data-cdx-kind="injectable"]')
        ).toHaveCount(1);
    });

    test('the feature page of a container child lists its members', async ({ page }) => {
        await page.goto(featureUrl(['admin-settings']));
        await expect(page.locator('h1.cdx-entity-hero-name')).toHaveText('admin-settings');
        await expect(page.locator('[data-cdx-feature-detector]')).toHaveText(
            'Detected from folder'
        );
        await expect(page.locator('h2#services')).toHaveCount(1);
    });
});
