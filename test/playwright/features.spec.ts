import { expect, test } from '@playwright/test';
import { featureUrl, hrefTo, pageUrl } from './pages';

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

    test('the jump bar scrolls to a member section of the feature page', async ({ page }) => {
        await page.goto(featureUrl(['core', 'select']));
        const jump = page.locator('nav.cdx-feature-jump');
        await expect(jump.locator('a[href="#components-and-directives"] .cdx-badge')).toHaveText(
            '4'
        );
        const types = jump.locator('a[href="#types"]');
        await expect(types).toHaveCount(1);
        await types.click();
        await expect(page.locator('h2#types')).toBeInViewport();
        await expect(page).toHaveURL(/#types$/);
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

    test('role folders join the feature they name; the breadcrumb links it', async ({ page }) => {
        // di/foo.inject.ts sits in a role folder and joins foo; @sem/core then
        // has one feature, its root feature.
        await page.goto(pageUrl('function', 'createStore'));
        const crumbs = page.locator('.cdx-breadcrumb li');
        await expect(crumbs).toHaveCount(2);
        await expect(crumbs.nth(0)).toHaveText('core');
        await crumbs.nth(0).locator('a').click();
        await expect(page.locator('.cdx-entity-hero[data-cdx-feature="@sem/core#"]')).toBeVisible();
        await expect(page.locator('h2#configuration')).toHaveCount(1);
        await expect(
            page.locator('tr[data-cdx-feature-member] a', { hasText: 'formatFoo' })
        ).toHaveCount(1);
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

    test('the search palette folds a facet past the chip limit and keeps active chips', async ({
        page
    }) => {
        await page.goto('/index.html');
        // The fixture has few values per facet; a limit of 1 folds every larger one.
        await page.evaluate(() => {
            document
                .getElementById('cdx-command-palette')
                ?.setAttribute('data-cdx-facet-limit', '1');
        });
        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
        const more = dialog.locator('.cdx-cp-facet-more').first();
        await expect(more).toBeVisible({ timeout: 10_000 });
        await expect(more).toHaveAttribute('aria-expanded', 'false');
        await expect(more).toHaveText(/^\+\d+ more$/);
        const dim = await more.getAttribute('data-dim');
        const chips = dialog.locator(`.cdx-cp-facet-chip[data-dim="${dim}"]`);
        await expect(chips).toHaveCount(1);

        await more.click();
        const toggle = dialog.locator(`.cdx-cp-facet-more[data-dim="${dim}"]`);
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(toggle).toHaveText('Show less');
        await expect(toggle).toBeFocused();
        expect(await chips.count()).toBeGreaterThan(1);

        // An active chip past the limit stays visible after folding again.
        const last = chips.last();
        const value = await last.getAttribute('data-value');
        await last.click();
        await expect(
            dialog.locator(`.cdx-cp-facet-chip[data-dim="${dim}"][data-value="${value}"]`)
        ).toHaveAttribute('aria-pressed', 'true');
        const folding = dialog.locator(`.cdx-cp-facet-more[data-dim="${dim}"]`);
        if (
            (await folding.count()) > 0 &&
            (await folding.getAttribute('aria-expanded')) === 'true'
        ) {
            await folding.click();
        }
        await expect(
            dialog.locator(`.cdx-cp-facet-chip[data-dim="${dim}"][data-value="${value}"]`)
        ).toBeVisible();
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
            hrefTo(featureUrl(['admin-settings']))
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
