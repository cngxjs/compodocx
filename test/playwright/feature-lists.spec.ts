import { expect, type Page, test } from '@playwright/test';
import { featureUrl } from './pages';

// Feature page lists (entry point cards, member rows) and the markdown layout
// hints of the `@sem/core` README. Runs in the `semantic` project only.

const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 390, height: 844 };

/** Distinct left offsets of the matched elements, rounded. */
const columns = async (page: Page, selector: string): Promise<number> =>
    page
        .locator(selector)
        .evaluateAll(
            els => new Set(els.map(el => Math.round(el.getBoundingClientRect().left))).size
        );

/** Whether the label sits left of its text (column) rather than above it. */
const labelBeside = async (page: Page, selector: string): Promise<boolean> =>
    page
        .locator(selector)
        .first()
        .evaluate(el => {
            const label = el.querySelector('.cdx-leadin-label')?.getBoundingClientRect();
            const text = el.querySelector('.cdx-leadin-text')?.getBoundingClientRect();
            return (
                !!label && !!text && label.right <= text.left && Math.abs(label.top - text.top) < 4
            );
        });

test.describe('Feature lists and markdown layout hints', () => {
    test('a parent entry point lists its child entry points as cards', async ({ page }) => {
        await page.goto(featureUrl(['core']));
        await expect(page.locator('h2#entry-points')).toHaveCount(1);
        const cards = page.locator('li.cdx-feature-card[data-cdx-feature-card]');
        await expect(cards).toHaveCount(2);
        await expect(cards.locator('.cdx-feature-card-name')).toHaveText(['select', 'tokens']);
        await expect(cards.first().locator('.cdx-feature-card-import')).toHaveText(
            '@sem/core/select'
        );
    });

    test('entry point cards are one column on a phone and several on a desktop', async ({
        page
    }) => {
        await page.setViewportSize(NARROW);
        await page.goto(featureUrl(['core']));
        expect(await columns(page, 'li[data-cdx-feature-card]')).toBe(1);
        await page.setViewportSize(WIDE);
        expect(await columns(page, 'li[data-cdx-feature-card]')).toBeGreaterThan(1);
    });

    test('member rows stack on narrow pages and use two columns on wide ones', async ({ page }) => {
        const row = 'li.cdx-feature-row[data-cdx-feature-member]';
        const side = (p: Page) =>
            p
                .locator(row)
                .first()
                .evaluate(el => {
                    const name = el.querySelector('.cdx-feature-row-name')?.getBoundingClientRect();
                    const sum = el
                        .querySelector('.cdx-feature-row-summary')
                        ?.getBoundingClientRect();
                    return !!name && !!sum && name.right <= sum.left;
                });
        await page.setViewportSize(NARROW);
        await page.goto(featureUrl(['core']));
        expect(await side(page)).toBe(false);
        await page.setViewportSize(WIDE);
        expect(await side(page)).toBe(true);
    });

    test('a lead-in paragraph has a label column on desktop and the label above on a phone', async ({
        page
    }) => {
        await page.setViewportSize(WIDE);
        await page.goto(featureUrl(['core']));
        const paragraph = '.cdx-readme p.cdx-leadin';
        await expect(page.locator(paragraph)).toHaveCount(2);
        expect(await labelBeside(page, paragraph)).toBe(true);
        await page.setViewportSize(NARROW);
        expect(await labelBeside(page, paragraph)).toBe(false);
    });

    test('lead-in paragraphs are separated by a hairline', async ({ page }) => {
        await page.goto(featureUrl(['core']));
        const borders = await page
            .locator('.cdx-readme > p.cdx-leadin')
            .evaluateAll(els => els.map(el => getComputedStyle(el).borderTopWidth));
        expect(borders).toEqual(['0px', '1px']);
    });

    test('a lead-in list item has a label column on desktop and keeps its marker', async ({
        page
    }) => {
        await page.setViewportSize(WIDE);
        await page.goto(featureUrl(['core']));
        const item = '.cdx-readme li.cdx-leadin';
        await expect(page.locator(item)).toHaveCount(3);
        expect(await labelBeside(page, item)).toBe(true);
        const display = await page
            .locator(item)
            .first()
            .evaluate(el => getComputedStyle(el).display);
        // A regex, not the literal value: Tailwind scans this file for class names.
        expect(display).toMatch(/^list/);
    });

    test('the inline directive renders its list as chips', async ({ page }) => {
        await page.goto(featureUrl(['core']));
        const list = page.locator('.cdx-readme ul.cdx-list-inline');
        await expect(list.locator('li')).toHaveText([
            'Chrome 125+',
            'Firefox 131+',
            'Safari 18.4+'
        ]);
        expect(await list.evaluate(el => getComputedStyle(el).display)).toBe('flex');
    });

    test('README paragraphs stop at 72 characters', async ({ page }) => {
        await page.setViewportSize(WIDE);
        await page.goto(featureUrl(['core']));
        const ok = await page
            .locator('.cdx-readme > p:not(.cdx-leadin)')
            .first()
            .evaluate(el => {
                const probe = document.createElement('span');
                probe.style.cssText = 'position:absolute;visibility:hidden;width:72ch';
                el.appendChild(probe);
                const limit = probe.getBoundingClientRect().width;
                probe.remove();
                return Number.parseFloat(getComputedStyle(el).maxWidth) <= limit + 1;
            });
        expect(ok).toBe(true);
    });
});
