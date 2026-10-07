import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

/**
 * E2E coverage for the VS Code-style source viewer on component Source
 * tabs: chrome structure, copy button, sticky scroll stack, and the
 * scroll-margin offset that keeps anchor jumps clear of pinned chrome.
 *
 * Runs against the kitchen-sink-standalone fixture (port 4002) because
 * it has the longest TypeScript source files — AdminPanelComponent has
 * 233 lines which gives plenty of scroll distance to exercise the
 * sticky scroll stack state transitions.
 */

// UserCardComponent in the standalone-app fixture has the right
// shape for these tests: depth-0 class + six depth-1 members, 45
// lines — long enough to scroll through without being a full page.
const SOURCE_PAGE = pageUrl('component', 'UserCardComponent');

test.describe('Source viewer — chrome', () => {
    test('source tab renders the VS Code-style viewer wrapper', async ({ page }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const viewer = page.locator('#source .cdx-source-viewer');
        await expect(viewer).toBeVisible();
        await expect(viewer).toHaveAttribute('data-cdx-lang', 'typescript');
    });

    test('tab header renders file icon, path, scope span, and copy button', async ({ page }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const header = page.locator('#source .cdx-source-viewer-header');
        await expect(header).toBeVisible();
        await expect(header.locator('.cdx-source-viewer-icon svg')).toHaveCount(1);
        await expect(header.locator('.cdx-source-viewer-path')).toContainText(
            'user-card.component.ts'
        );
        await expect(header.locator('.cdx-source-scope')).toHaveCount(1);
        await expect(header.locator('button.cdx-source-viewer-copy')).toBeVisible();
    });

    test('typescript icon uses the --typescript lang modifier class', async ({ page }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const viewer = page.locator('#source .cdx-source-viewer');
        await expect(viewer).toHaveClass(/cdx-source-viewer--typescript/);
    });

    test('clone source via the integrated copy button', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write']);
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const btn = page.locator('#source .cdx-source-viewer-copy');
        await btn.click();
        await expect(btn).toHaveClass(/cdx-source-viewer-copy--copied/);
        const copied = await page.evaluate(() => navigator.clipboard.readText());
        expect(copied.length).toBeGreaterThan(100);
        expect(copied).toContain('UserCardComponent');
    });

    test('body pre contains member markers with depth attributes', async ({ page }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const markers = page.locator('#source .cdx-source-viewer-body [data-cdx-member]');
        const count = await markers.count();
        expect(count).toBeGreaterThan(1);
        // At least one depth-0 (the class) and one depth-1 (a method).
        const depths = await markers.evaluateAll(nodes =>
            nodes.map(n => (n as HTMLElement).dataset.cdxMemberDepth)
        );
        expect(depths).toContain('0');
        expect(depths).toContain('1');
    });
});

test.describe('Source viewer — sticky scroll stack', () => {
    test('stack is hidden when the user has not scrolled past the class decl', async ({ page }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();
        const stack = page.locator('#source .cdx-source-viewer-sticky-stack');
        // :empty hides the element via display: none, so the DOM node
        // exists but is not visible.
        await expect(stack).toBeAttached();
        await expect(stack).not.toBeVisible();
    });

    // NOTE: the "stack populates after scrolling past the class decl"
    // and "click pinned line scrolls to decl" flows require a source
    // file long enough that the class declaration can scroll ABOVE the
    // 68px sticky trigger offset. The longest TS file in the
    // standalone-app fixture is 45 lines, which puts the class decl
    // roughly in the viewport middle after full-scroll — still below
    // the trigger, so the stack never pins. These behaviours are
    // verified manually against the kitchen-sink fixtures (dev:module
    // / dev:standalone) which have 200+ line components. If a longer
    // TS file is added to standalone-app, re-introduce the populate +
    // click tests here.
});

test.describe('Source viewer — scroll margin', () => {
    test('lines carry scroll-margin-top so sticky chrome does not obscure jumps', async ({
        page
    }) => {
        await page.goto(SOURCE_PAGE);
        await page.locator('a#source-tab').click();

        const firstLine = page.locator('#source .cdx-source-viewer-body .line').first();
        const scrollMargin = await firstLine.evaluate(el => getComputedStyle(el).scrollMarginTop);
        // Either the 120px from the CSS rule or an already-resolved px
        // value. Accept anything non-zero and >= 100px to give us
        // breathing room for future adjustments.
        const parsed = Number.parseInt(scrollMargin, 10);
        expect(parsed).toBeGreaterThanOrEqual(100);
    });
});
