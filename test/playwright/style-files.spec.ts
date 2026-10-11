import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

// Style files (style-library fixture, port 4006): free-standing style files
// get a page in their feature folder and appear in the sidebar.

test.describe('Style files', () => {
    test('the sidebar lists the style pages and a style page renders its tokens', async ({
        page
    }) => {
        await page.goto('/index.html');
        await expect(
            page.locator('.cdx-feature-link[data-cdx-kind="style"] a', { hasText: 'tokens' })
        ).toHaveCount(1);
        await page.goto(pageUrl('style', 'tokens'));
        await expect(page.locator('.cdx-entity-hero-name')).toHaveText('tokens');
        await expect(page.locator('#theme-sty-color-primary')).toBeVisible();
    });
});
