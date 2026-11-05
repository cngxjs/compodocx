import { expect, type Locator, test } from '@playwright/test';
import { pageUrl } from './pages';

/**
 * Links in running text are underlined without hover: in the default greyscale
 * theme the link colour is the text colour, so colour alone does not mark them
 * (WCAG 1.4.1). Heading permalinks and other `cdx-` links keep their own look.
 */
const decorationOf = (link: Locator): Promise<string> =>
    link.evaluate(a => getComputedStyle(a).textDecorationLine);

test.describe('Links in running text', () => {
    test('a README link is underlined, a heading permalink is not', async ({ page }) => {
        await page.goto('/index.html');
        const readme = page.locator('.content-data > .cdx-prose').first();
        await expect(decorationOf(readme.locator('a:not([class*="cdx-"])').first())).resolves.toBe(
            'underline'
        );
        await expect(decorationOf(readme.locator('a.cdx-member-permalink').first())).resolves.toBe(
            'none'
        );
    });

    test('a {@link} in a description is underlined', async ({ page }) => {
        await page.goto(pageUrl('component', 'BarComponent'));
        const link = page.locator('.cdx-prose a[href^="http://www.google.fr"]').first();
        await expect(decorationOf(link)).resolves.toBe('underline');
    });
});
