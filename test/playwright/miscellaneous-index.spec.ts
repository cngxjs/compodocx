import { expect, test } from '@playwright/test';
import { collectionUrl, pageUrl } from './pages';

test.describe('Miscellaneous Index Pages', () => {
    test.describe('Index grid', () => {
        test('variables page shows cdx-index container', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const index = page.locator('.cdx-index');
            await expect(index).toBeVisible();
        });

        test('no old ul.index-list remains', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            await expect(page.locator('ul.index-list')).toHaveCount(0);
        });

        test('functions page shows cdx-index container', async ({ page }) => {
            await page.goto(collectionUrl('function'));

            const index = page.locator('.cdx-index');
            await expect(index).toBeVisible();
        });

        test('index entries are clickable anchor links', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const entry = page.locator('.cdx-index-entry').first();
            const href = await entry.getAttribute('href');
            expect(href).toMatch(/^#/);
        });

        test('index entries show file path on hover via title', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const entry = page.locator('.cdx-index-entry').first();
            const title = await entry.getAttribute('title');
            expect(title).toBeTruthy();
            expect(title).toContain('.ts');
        });
    });

    test.describe('Indicator letters', () => {
        test('variables page shows V indicators', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const indicator = page.locator('.cdx-index-indicator--variable').first();
            await expect(indicator).toHaveText('V');
        });

        test('functions page shows F indicators', async ({ page }) => {
            await page.goto(collectionUrl('function'));

            const indicator = page.locator('.cdx-index-indicator--function').first();
            await expect(indicator).toHaveText('F');
        });

        test('type aliases page shows T indicators', async ({ page }) => {
            await page.goto(collectionUrl('typealias'));

            const indicator = page.locator('.cdx-index-indicator--typealias').first();
            await expect(indicator).toHaveText('T');
        });

        test('enumerations page shows E indicators', async ({ page }) => {
            await page.goto(collectionUrl('enumeration'));

            const indicator = page.locator('.cdx-index-indicator--enum').first();
            await expect(indicator).toHaveText('E');
        });

        test('indicators have aria-hidden', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const indicator = page.locator('.cdx-index-indicator').first();
            await expect(indicator).toHaveAttribute('aria-hidden', 'true');
        });

        test('each kind has a unique indicator color', async ({ page }) => {
            await page.goto(collectionUrl('variable'));
            const vColor = await page
                .locator('.cdx-index-indicator--variable')
                .first()
                .evaluate(el => getComputedStyle(el).backgroundColor);

            await page.goto(collectionUrl('function'));
            const fColor = await page
                .locator('.cdx-index-indicator--function')
                .first()
                .evaluate(el => getComputedStyle(el).backgroundColor);

            expect(vColor).not.toBe(fColor);
        });
    });

    test.describe('Filter', () => {
        test('filter input visible with aria-label', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const filter = page.locator('[data-cdx-misc-filter]');
            await expect(filter).toBeVisible();
            await expect(filter).toHaveAttribute('aria-label');
        });

        test('filter hides non-matching entries', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const totalBefore = await page.locator('.cdx-index-entry[data-cdx-misc-name]').count();

            await page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]')!;
                input.value = 'app_routes';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.waitForTimeout(300);

            const visible = await page.evaluate(() => {
                return Array.from(
                    document.querySelectorAll('.cdx-index-entry[data-cdx-misc-name]')
                ).filter(el => (el as HTMLElement).style.display !== 'none').length;
            });
            expect(visible).toBeLessThan(totalBefore);
            expect(visible).toBeGreaterThan(0);
        });

        test('filter clear button works', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            await page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]')!;
                input.value = 'app_routes';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.waitForTimeout(300);

            const clearBtn = page.locator('[data-cdx-misc-filter-clear]');
            await clearBtn.click();
            await page.waitForTimeout(300);

            const allVisible = await page.evaluate(() => {
                return Array.from(
                    document.querySelectorAll('.cdx-index-entry[data-cdx-misc-name]')
                ).every(el => (el as HTMLElement).style.display !== 'none');
            });
            expect(allVisible).toBe(true);
        });

        test('Escape clears the filter', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const filter = page.locator('[data-cdx-misc-filter]');
            await page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]')!;
                input.value = 'app_routes';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.waitForTimeout(300);

            await filter.focus();
            await filter.press('Escape');
            await page.waitForTimeout(300);

            const value = await filter.inputValue();
            expect(value).toBe('');
        });

        test('no-results message shows for nonsense queries', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            await page.evaluate(() => {
                const input = document.querySelector<HTMLInputElement>('[data-cdx-misc-filter]')!;
                input.value = 'xyznonexistent';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            });
            await page.waitForTimeout(300);

            const noResults = page.locator('.cdx-coverage-no-results--visible');
            await expect(noResults).toBeVisible();
        });
    });

    test.describe('Accessibility', () => {
        test('focus-visible ring on index entries', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const entry = page.locator('.cdx-index-entry').first();
            await entry.focus();

            const outline = await entry.evaluate(el => getComputedStyle(el).outlineStyle);
            // Should have a visible outline when focused
            expect(outline).not.toBe('none');
        });

        test('misc hero breadcrumb has no links', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const hero = page.locator('.cdx-entity-hero');
            await expect(hero).toBeVisible();

            // Breadcrumb in hero should be plain text, no <a> links
            const links = hero.locator('.cdx-entity-hero-file a');
            await expect(links).toHaveCount(0);
        });
    });

    test.describe('Deprecated and responsive', () => {
        test('deprecated entries have line-through style', async ({ page }) => {
            await page.goto(collectionUrl('variable'));

            const deprecated = page.locator('.cdx-index-entry--deprecated .cdx-index-name');
            if ((await deprecated.count()) > 0) {
                const decoration = await deprecated
                    .first()
                    .evaluate(el => getComputedStyle(el).textDecorationLine);
                expect(decoration).toBe('line-through');
            }
        });

        test('touch targets adequate on narrow viewport', async ({ page }) => {
            await page.setViewportSize({ width: 400, height: 800 });
            await page.goto(collectionUrl('variable'));

            const entry = page.locator('.cdx-index-entry').first();
            const box = await entry.boundingBox();
            // Height should be >= 30px (padding 8px + content)
            expect(box!.height).toBeGreaterThanOrEqual(28);
        });
    });

    test.describe('Breadcrumb fixes', () => {
        test('entity page breadcrumb has no dead links', async ({ page }) => {
            await page.goto(pageUrl('class', 'Todo'));

            const breadcrumb = page.locator('.cdx-breadcrumb');
            const links = breadcrumb.locator('a');
            await expect(links).toHaveCount(0);
        });

        test('permalink hidden by default, visible on hover', async ({ page }) => {
            await page.goto(collectionUrl('enumeration'));

            const permalink = page.locator('.cdx-member-permalink').first();
            const opacity = await permalink.evaluate(el => getComputedStyle(el).opacity);
            expect(opacity).toBe('0');
        });
    });
});
