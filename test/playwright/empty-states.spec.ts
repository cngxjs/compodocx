import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

test.describe('Empty States', () => {
    test.describe('Page variant — bare entity with no members', () => {
        test('class with no members shows page empty state', async ({ page }) => {
            await page.goto(pageUrl('class', 'Tada'));
            await page.locator('[role="tab"]', { hasText: 'Info' }).click();

            const info = page.locator('#info');
            // Entity tab panels use the 'full' variant (page variant is for overview/coverage pages)
            const emptyState = info.locator('.cdx-empty-state--full');
            await expect(emptyState).toBeVisible();

            await expect(emptyState.locator('.cdx-empty-state-title')).toHaveText(
                'Nothing documented yet'
            );
            await expect(emptyState.locator('.cdx-empty-state-description')).toContainText(
                'no documented members'
            );
            await expect(emptyState.locator('.cdx-empty-state-icon')).toBeVisible();
        });

        test('page empty state shows file path in hero', async ({ page }) => {
            await page.goto(pageUrl('class', 'Tada'));

            const filePath = page.locator('.cdx-entity-hero-file');
            await expect(filePath).toBeVisible();
            await expect(filePath).toContainText('.ts');
        });
    });

    test.describe('Full variant — empty tabs', () => {
        test('heading-only README shows heading + empty state', async ({ page }) => {
            await page.goto(pageUrl('class', 'Todo'));

            const readmeTab = page.locator('[role="tab"]', { hasText: 'README' });
            await readmeTab.click();

            const readmePanel = page.locator('#readme');
            const emptyState = readmePanel.locator('.cdx-empty-state--full');
            await expect(emptyState).toBeVisible();
            await expect(emptyState.locator('.cdx-empty-state-title')).toHaveText('No README');

            // Heading should still be visible above empty state
            const heading = readmePanel.locator('h1, h2, h3');
            await expect(heading).toBeVisible();
        });

        test('source tab with content does NOT show empty state', async ({ page }) => {
            await page.goto(pageUrl('class', 'Todo'));

            const sourceTab = page.locator('[role="tab"]', { hasText: 'Source' });
            await sourceTab.click();

            const sourcePanel = page.locator('#source');
            await expect(sourcePanel.locator('.cdx-empty-state')).not.toBeVisible();
            await expect(sourcePanel.locator('.cdx-source-viewer')).toBeVisible();
        });
    });

    test.describe('No empty sections — component pages', () => {
        test('component without inputs does not render empty Inputs heading', async ({ page }) => {
            await page.goto(pageUrl('component', 'AppComponent'));

            const info = page.locator('#info');
            const inputsHeading = info.locator('h3', { hasText: /^Inputs$/ });
            await expect(inputsHeading).toHaveCount(0);
        });

        test('component without outputs does not render empty Outputs heading', async ({
            page
        }) => {
            await page.goto(pageUrl('component', 'AppComponent'));

            const info = page.locator('#info');
            const outputsHeading = info.locator('h3', { hasText: /^Outputs$/ });
            await expect(outputsHeading).toHaveCount(0);
        });

        test('component without host bindings does not render empty HostBindings heading', async ({
            page
        }) => {
            await page.goto(pageUrl('component', 'AppComponent'));

            const info = page.locator('#info');
            const hbHeading = info.locator('h3', { hasText: /^HostBindings$/ });
            await expect(hbHeading).toHaveCount(0);
        });

        test('component with inputs DOES render Inputs section', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));
            await page.locator('[role="tab"]', { hasText: 'API' }).click();

            const api = page.locator('#api');
            // h3 includes a permalink anchor so text is "Inputs#" — use contains match
            const inputsHeading = api.locator('[data-compodoc="block-inputs"] h3');
            await expect(inputsHeading).toBeVisible();

            // Flat layout uses cdx-io-member rows (not cdx-member-card)
            const memberRows = api.locator('[data-compodoc="block-inputs"] .cdx-io-member[id]');
            await expect(memberRows).not.toHaveCount(0);
        });
    });

    test.describe('Entity page with content — no false empty states', () => {
        test('class with members does NOT show page empty state', async ({ page }) => {
            await page.goto(pageUrl('class', 'Clock'));
            await page.locator('[role="tab"]', { hasText: 'Info' }).click();

            const info = page.locator('#info');
            await expect(info.locator('.cdx-empty-state--page')).not.toBeVisible();

            // Properties section is on the API tab
            await page.locator('[role="tab"]', { hasText: 'API' }).click();
            const api = page.locator('#api');
            await expect(api.locator('h3', { hasText: 'Properties' })).toBeVisible();
        });

        test('component with full content has no empty states on info tab', async ({ page }) => {
            await page.goto(pageUrl('component', 'AboutComponent'));

            const info = page.locator('#info');
            await expect(info.locator('.cdx-empty-state')).not.toBeVisible();
        });
    });
});
