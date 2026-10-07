import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

test.describe('Compodoc page', () => {
    test('should support dark mode', async ({ page }) => {
        await page.goto('/');

        const hasDark = await page.evaluate(
            () =>
                document.documentElement.classList.contains('dark') ||
                document.body.classList.contains('dark')
        );
        expect(hasDark).toBe(true);

        // Verify background is a dark color (not white/light)
        const backgroundColor = await page.evaluate(() => {
            return window.getComputedStyle(document.body).backgroundColor;
        });
        // Parse RGB and verify it's dark (each channel < 100)
        const match = backgroundColor.match(/rgb\((\d+), (\d+), (\d+)\)/);
        expect(match).toBeTruthy();
        const [, r, g, b] = match!.map(Number);
        expect(r).toBeLessThan(100);
        expect(g).toBeLessThan(100);
        expect(b).toBeLessThan(100);
    });

    test('should open menu for specific page', async ({ page }) => {
        await page.goto(pageUrl('component', 'FooComponent'));

        const menuComponentsItem = page.locator(
            '#sidebar .menu-toggler[data-cdx-target="#components-links"]'
        );
        await expect(menuComponentsItem).toHaveAttribute('aria-expanded', 'true');
    });
});
