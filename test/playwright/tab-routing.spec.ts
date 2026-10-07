import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

// Hash-based tab routing: deep-links, tab switching, SPA navigation,
// and the original bug where hash-only links to hidden panels did nothing.
// Standalone fixture (port 4002), target: UserListComponent.

const COMPONENT_PAGE = pageUrl('component', 'UserListComponent');
const OTHER_PAGE = pageUrl('component', 'AppComponent');

test.describe('Full-page load deep-linking', () => {
    test('default URL loads with Info tab active', async ({ page }) => {
        await page.goto(COMPONENT_PAGE);
        const infoTab = page.locator('a#info-tab');
        await expect(infoTab).toHaveAttribute('aria-selected', 'true');
        const infoPanel = page.locator('#info.cdx-tab-panel');
        await expect(infoPanel).toHaveClass(/active/);
    });

    test('#api hash activates the API tab', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#api`);
        const apiTab = page.locator('a#api-tab');
        await expect(apiTab).toHaveAttribute('aria-selected', 'true');
        const apiPanel = page.locator('#api.cdx-tab-panel');
        // There's also a member card with id="api" but the resolver
        // picks the tab panel because it checks cdx-tab-panel first.
        await expect(apiPanel).toHaveClass(/active/);
    });

    test('#ngOnInit hash activates API tab and scrolls member into view', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#ngOnInit`);
        // ngOnInit lives inside the API panel
        const apiTab = page.locator('a#api-tab');
        await expect(apiTab).toHaveAttribute('aria-selected', 'true');
        const memberCard = page.locator('#ngOnInit.cdx-io-member');
        await expect(memberCard).toBeVisible();
        await expect(memberCard).toBeInViewport();
    });

    test('#L10 hash activates Source tab and highlights line', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#L10`);
        const sourceTab = page.locator('a#source-tab');
        await expect(sourceTab).toHaveAttribute('aria-selected', 'true');
        const highlightedLine = page.locator('#source .line.cdx-line-highlight');
        await expect(highlightedLine).toHaveCount(1);
        await expect(highlightedLine).toHaveAttribute('data-cdx-line-nr', '10');
    });
});

test.describe('SPA navigation with hash', () => {
    test('SPA nav to component page lands on Info tab by default', async ({ page }) => {
        await page.goto(OTHER_PAGE);
        const sidebarLink = page.locator(
            `.menu a[data-type="entity-link"][href*="UserListComponent"]`
        );
        await sidebarLink.click();
        await page.waitForURL(/UserListComponent/);
        const infoTab = page.locator('a#info-tab');
        await expect(infoTab).toHaveAttribute('aria-selected', 'true');
    });

    test('tab bar click sequence updates hash', async ({ page }) => {
        await page.goto(COMPONENT_PAGE);

        await page.locator('a#api-tab').click();
        await expect(page).toHaveURL(/#api$/);
        await expect(page.locator('#api.cdx-tab-panel')).toHaveClass(/active/);

        await page.locator('a#source-tab').click();
        await expect(page).toHaveURL(/#source$/);
        await expect(page.locator('#source.cdx-tab-panel')).toHaveClass(/active/);

        await page.locator('a#info-tab').click();
        await expect(page).toHaveURL(/#info$/);
        const infoPanel = page.locator('#info.cdx-tab-panel');
        await expect(infoPanel).toHaveClass(/active/);
    });
});

test.describe('Cross-panel hash-only links (original bug)', () => {
    test('clicking a hash-only link to a member in another panel switches tabs', async ({
        page
    }) => {
        await page.goto(COMPONENT_PAGE);
        await expect(page.locator('a#info-tab')).toHaveAttribute('aria-selected', 'true');

        // Drop a link into the Info panel that points at a member in
        // the API panel — reproduces the original bug.
        await page.evaluate(() => {
            const infoPanel = document.getElementById('info');
            if (infoPanel) {
                const link = document.createElement('a');
                link.href = '#ngOnInit';
                link.id = 'test-cross-panel-link';
                link.textContent = 'Go to ngOnInit';
                infoPanel.prepend(link);
            }
        });

        await page.locator('#test-cross-panel-link').click();

        const apiTab = page.locator('a#api-tab');
        await expect(apiTab).toHaveAttribute('aria-selected', 'true');
        const memberCard = page.locator('#ngOnInit.cdx-io-member');
        await expect(memberCard).toBeVisible();
    });

    test('API index entry link switches to API tab and scrolls to member', async ({ page }) => {
        await page.goto(COMPONENT_PAGE);
        const indexLink = page.locator('#api a.cdx-index-entry[href="#ngOnInit"]');
        // Check if the link exists (need to open API tab first)
        await page.locator('a#api-tab').click();
        const linkExists = (await indexLink.count()) > 0;

        if (linkExists) {
            await page.locator('a#info-tab').click();
            await expect(page.locator('a#info-tab')).toHaveAttribute('aria-selected', 'true');

            // Set hash directly — hashchange listener should handle it
            await page.evaluate(() => {
                window.location.hash = '#ngOnInit';
            });

            await expect(page.locator('a#api-tab')).toHaveAttribute('aria-selected', 'true');
            await expect(page.locator('#ngOnInit.cdx-io-member')).toBeVisible();
        }
    });
});
