import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

test.describe('Entity Page Hero', () => {
    test.describe('Hero structure', () => {
        test('component page has hero with gradient and watermark', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const hero = page.locator('.cdx-entity-hero');
            await expect(hero).toBeVisible();

            const watermark = hero.locator('.cdx-entity-hero-watermark');
            await expect(watermark).toBeAttached();
        });

        test('hero sets entity color CSS variable', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const hero = page.locator('.cdx-entity-hero');
            const style = await hero.getAttribute('style');
            expect(style).toContain('--cdx-hero-color');
            expect(style).toContain('entity-component');
        });

        test('class page hero uses class entity color', async ({ page }) => {
            await page.goto(pageUrl('class', 'Clock'));

            const style = await page.locator('.cdx-entity-hero').getAttribute('style');
            expect(style).toContain('entity-class');
        });
    });

    test.describe('Entity type badges', () => {
        test('component shows filled COMPONENT badge', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const badge = page.locator('.cdx-entity-hero-badges .cdx-badge--entity-component');
            await expect(badge).toBeVisible();
            await expect(badge).toHaveText('Component');
        });

        test('class shows filled CLASS badge', async ({ page }) => {
            await page.goto(pageUrl('class', 'Clock'));

            const badge = page.locator('.cdx-entity-hero-badges .cdx-badge--entity-class');
            await expect(badge).toBeVisible();
            await expect(badge).toHaveText('Class');
        });

        test('directive shows filled DIRECTIVE badge', async ({ page }) => {
            await page.goto(pageUrl('directive', 'HighlightDirective'));

            const badge = page.locator('.cdx-entity-hero-badges .cdx-badge--entity-directive');
            await expect(badge).toBeVisible();
            await expect(badge).toHaveText('Directive');
        });

        test('status badges render alongside entity badge', async ({ page }) => {
            // The standalone badge only shows in projects that still have
            // NgModules; the all-standalone fixture uses the @beta status badge.
            await page.goto(pageUrl('directive', 'BaseDirective'));

            const badges = page.locator('.cdx-entity-hero-badges');
            await expect(badges.locator('.cdx-badge--entity-directive')).toBeVisible();
            await expect(badges.locator('.cdx-badge--beta')).toBeVisible();
        });
    });

    test.describe('Context lines', () => {
        test('component shows selector in metadata table', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));
            await page.locator('[role="tab"]', { hasText: 'Info' }).click();

            // Selector moved from hero context line to metadata table
            const selectorLabel = page.locator('.cdx-metadata-label', { hasText: 'selector' });
            await expect(selectorLabel).toBeVisible();
        });

        test('class with implements shows context line', async ({ page }) => {
            await page.goto(pageUrl('class', 'Clock'));

            const context = page.locator('.cdx-entity-hero-context');
            await expect(context).toBeVisible();
            await expect(context).toContainText('implements');
        });

        test('entity without context data has no context line', async ({ page }) => {
            await page.goto(pageUrl('class', 'Tada'));

            await expect(page.locator('.cdx-entity-hero-context')).not.toBeVisible();
        });
    });

    test.describe('Pill tab bar', () => {
        test('tabs render as pill bar below hero', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const tabBar = page.locator('.cdx-tab-bar');
            await expect(tabBar).toBeVisible();

            // Tab bar should be OUTSIDE the hero
            const heroBox = await page.locator('.cdx-entity-hero').boundingBox();
            const tabBox = await tabBar.boundingBox();
            expect(tabBox!.y).toBeGreaterThan(heroBox!.y + heroBox!.height - 1);
        });

        test('active tab has active class', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const activeTab = page.locator('.cdx-tab-bar a.active');
            await expect(activeTab).toHaveCount(1);
            await expect(activeTab).toHaveText('Info');
        });

        test('clicking tab switches content', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const sourceTab = page.locator('.cdx-tab-bar a', { hasText: 'Source' });
            await sourceTab.click();

            await expect(sourceTab).toHaveClass(/active/);
            await expect(page.locator('#source')).toHaveClass(/active/);
        });
    });
});
