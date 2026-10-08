import { expect, test } from '@playwright/test';
import { pageUrl, rootUrl } from './pages';

const ROWS = '[data-cdx-misc-name]';

const typeInFilter = async (page: import('@playwright/test').Page, query: string) => {
    await page.evaluate(q => {
        const input = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]')!;
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, query);
    await page.waitForTimeout(300);
};

const visibleRows = (page: import('@playwright/test').Page) =>
    page.evaluate(
        selector =>
            Array.from(document.querySelectorAll(selector)).filter(
                el => (el as HTMLElement).style.display !== 'none'
            ).length,
        ROWS
    );

test.describe('Utilities page', () => {
    test.describe('Groups', () => {
        test('one table per group with a section id', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            for (const id of ['functions', 'variables', 'typealiases', 'enumerations']) {
                await expect(page.locator(`section#${id} table.cdx-table`)).toHaveCount(1);
            }
        });

        test('each row links to the symbol page', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const link = page.locator(`${ROWS} a`).first();
            const href = await link.getAttribute('href');
            expect(href).toMatch(/\.html$/);
            await link.click();
            await page.waitForLoadState('domcontentloaded');
            await expect(page.locator('h1.cdx-entity-hero-name')).toBeVisible();
        });

        test('group permalinks are hidden until hover', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const permalink = page.locator('.cdx-member-permalink').first();
            const opacity = await permalink.evaluate(el => getComputedStyle(el).opacity);
            expect(opacity).toBe('0');
        });
    });

    test.describe('Filter', () => {
        test('filter input visible with aria-label', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const filter = page.locator('[data-cdx-misc-filter]');
            await expect(filter).toBeVisible();
            await expect(filter).toHaveAttribute('aria-label');
        });

        test('filter hides non-matching rows', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const totalBefore = await page.locator(ROWS).count();
            await typeInFilter(page, 'app_routes');
            const visible = await visibleRows(page);
            expect(visible).toBeLessThan(totalBefore);
            expect(visible).toBeGreaterThan(0);
        });

        test('filter clear button restores every row', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const total = await page.locator(ROWS).count();
            await typeInFilter(page, 'app_routes');
            await page.locator('[data-cdx-misc-filter-clear]').click();
            await page.waitForTimeout(300);
            expect(await visibleRows(page)).toBe(total);
        });

        test('Escape clears the filter', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const filter = page.locator('[data-cdx-misc-filter]');
            await typeInFilter(page, 'app_routes');
            await filter.focus();
            await filter.press('Escape');
            await page.waitForTimeout(300);
            expect(await filter.inputValue()).toBe('');
        });

        test('no-results message shows for nonsense queries', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            await typeInFilter(page, 'xyznonexistent');
            await expect(page.locator('.cdx-coverage-no-results--visible')).toBeVisible();
        });
    });

    test.describe('Symbol pages', () => {
        test('breadcrumb links back to the utilities page and group', async ({ page }) => {
            await page.goto(rootUrl('utilities'));
            const href = await page.locator('#variables table a').first().getAttribute('href');
            await page.goto(new URL(href as string, page.url()).pathname);
            const crumbs = page.locator('.cdx-breadcrumb a');
            await expect(crumbs).toHaveCount(2);
            await expect(crumbs.nth(1)).toHaveAttribute('href', /utilities\.html#variables$/);
        });

        test('class page breadcrumb has no dead links', async ({ page }) => {
            await page.goto(pageUrl('class', 'Todo'));
            await expect(page.locator('.cdx-breadcrumb a')).toHaveCount(0);
        });
    });
});
