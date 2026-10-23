import { expect, test } from '@playwright/test';

// Regression suite for additional-page rendering. The headline guard is the
// single-`content-data`-wrapper invariant: a v0.4.2 follow-up landed in v0.4.3
// after additional pages briefly rendered with two stacked `content-data`
// divs (the outer Layout container plus an inner wrapper that re-added the
// class), producing double padding and a broken layout. The inner wrapper
// now uses `cdx-readme` only — the outer Layout's `content-data` covers the
// page-container role.

test.describe('Additional pages', () => {
    test('top-level page renders with a single content-data wrapper', async ({ page }) => {
        await page.goto('/additional-documentation/getting-started.html');

        // Hash-router occasionally needs a tick to swap the inner content.
        await page.waitForLoadState('domcontentloaded');

        // Exactly one .content-data — the outer Layout container. The inner
        // additional-page wrapper carries `cdx-readme` only.
        await expect(page.locator('.content-data')).toHaveCount(1);

        const reader = page.locator('.content-data .cdx-readme');
        await expect(reader).toHaveCount(1);
        // The inner wrapper must NOT also carry the layout class. A nested
        // `.content-data > .content-data` selector is the literal shape of
        // the v0.4.3 regression.
        await expect(reader).not.toHaveClass(/\bcontent-data\b/);
        await expect(page.locator('.content-data > .content-data')).toHaveCount(0);
    });

    test('rendered markdown lands inside the cdx-readme container', async ({ page }) => {
        await page.goto('/additional-documentation/getting-started.html');

        const reader = page.locator('.content-data .cdx-readme');
        // First H1 of the fixture file lives inside the readme prose box.
        // Headings carry a trailing anchor `#` link for deep-linking, so the
        // rendered text is "Getting Started#" — use toContainText.
        await expect(reader.locator('h1').first()).toContainText('Getting Started');
        await expect(reader.locator('h2').first()).toContainText('A heading');
    });

    test('nested child page renders with the same single-wrapper invariant', async ({ page }) => {
        await page.goto('/additional-documentation/guides/signals-&-reactivity.html');
        await page.waitForLoadState('domcontentloaded');

        await expect(page.locator('.content-data')).toHaveCount(1);
        await expect(page.locator('.content-data .cdx-readme')).toHaveCount(1);
        await expect(page.locator('.content-data > .content-data')).toHaveCount(0);
    });

    test('a page with children lines up with the plain pages next to it', async ({ page }) => {
        // On the child page neither `Getting Started` nor `Guides` is the active link.
        await page.goto('/additional-documentation/guides/signals-&-reactivity.html');
        await page.waitForLoadState('domcontentloaded');

        const textLeft = (name: string) =>
            page.evaluate(label => {
                const links = document.querySelectorAll('#additional-pages > li > a');
                const link = [...links].find(a => a.textContent?.trim() === label);
                if (!link) {
                    return Number.NaN;
                }
                const range = document.createRange();
                range.selectNodeContents(link.querySelector('.link-name') ?? link);
                return range.getBoundingClientRect().left;
            }, name);

        const plain = await textLeft('Getting Started');
        expect(plain).toBeGreaterThan(0);
        expect(await textLeft('Guides')).toBeCloseTo(plain, 0);
    });
});
