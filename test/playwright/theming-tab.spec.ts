import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

// E2E coverage for the Theming tab. Standalone fixture (port 4002), target:
// LoadingSpinnerComponent — annotated with @overview + five @property tokens
// across two @groups, plus one deprecated entry.

const COMPONENT_PAGE = pageUrl('component', 'LoadingSpinnerComponent');
const PLAIN_PAGE = pageUrl('component', 'AppComponent');

test.describe('Theming tab — visibility', () => {
    test('appears in the tab bar when a component has documented tokens', async ({ page }) => {
        await page.goto(COMPONENT_PAGE);
        const themingTab = page.locator('a#theming-tab');
        await expect(themingTab).toBeVisible();
    });

    test('does NOT appear on a component without documented tokens', async ({ page }) => {
        await page.goto(PLAIN_PAGE);
        const themingTab = page.locator('a#theming-tab');
        await expect(themingTab).toHaveCount(0);
    });

    test('#theming hash activates the Theming tab', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
        const themingTab = page.locator('a#theming-tab');
        await expect(themingTab).toHaveAttribute('aria-selected', 'true');
        const panel = page.locator('#theming.cdx-tab-panel');
        await expect(panel).toHaveClass(/active/);
    });
});

test.describe('Theming tab — content', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
    });

    test('renders the @overview block as the first paragraph', async ({ page }) => {
        const overview = page.locator('#theming .cdx-theming-overview');
        await expect(overview).toBeVisible();
        await expect(overview).toContainText('Theme tokens for the');
        // Markdown bold from **loading spinner** rendered as <strong>
        await expect(overview.locator('strong')).toContainText('loading spinner');
    });

    test('does NOT render a duplicate <h3>Theming</h3> heading inside the panel', async ({
        page
    }) => {
        const panel = page.locator('#theming.cdx-tab-panel');
        await expect(panel.locator('h3#theming')).toHaveCount(0);
    });

    test('emits one cdx-io-member row per documented token', async ({ page }) => {
        const rows = page.locator('#theming [data-compodoc="block-theming-token"]');
        // Five tokens declared on the component fixture
        await expect(rows).toHaveCount(5);
    });

    test('groups tokens under @group sub-headings (ring, overlay)', async ({ page }) => {
        const ring = page.locator('#theming .cdx-section-heading#theme-group-ring');
        const overlay = page.locator('#theming .cdx-section-heading#theme-group-overlay');
        await expect(ring).toContainText('ring');
        await expect(overlay).toContainText('overlay');
    });

    test('surfaces type and default-value for @property merges', async ({ page }) => {
        const sizeRow = page.locator('#theme-spinner-size');
        await expect(sizeRow).toContainText('--spinner-size');
        await expect(sizeRow).toContainText('<length>');
        await expect(sizeRow).toContainText('32px');
    });

    test('renders the deprecated badge and strikes through the token name', async ({ page }) => {
        const deprecatedRow = page.locator('#theme-spinner-stroke-color');
        await expect(deprecatedRow.locator('s')).toContainText('--spinner-stroke-color');
        await expect(deprecatedRow.locator('.cdx-badge--deprecated')).toBeVisible();
    });

    test('renders @example fenced blocks as Shiki snippets below the description', async ({
        page
    }) => {
        const strokeRow = page.locator('#theme-spinner-stroke');
        await expect(strokeRow.locator('.cdx-theming-example')).toHaveCount(1);
        // Shiki output uses pre.shiki; either light or dark variant works
        await expect(strokeRow.locator('.cdx-theming-example pre')).toBeVisible();
    });
});

test.describe('Theming tab — index', () => {
    test('renders an index above the rows when 2+ tokens exist', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
        const index = page.locator('#theming [data-compodoc="block-theming-index"]');
        await expect(index).toBeVisible();
        // One indicator per token, all with the theming kind
        const indicators = index.locator('.cdx-index-indicator--theming');
        await expect(indicators).toHaveCount(5);
    });

    test('clicking an index entry scrolls its row into view', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
        const indexLink = page
            .locator('#theming [data-compodoc="block-theming-index"]')
            .locator('a[href="#theme-spinner-overlay-bg"]');
        await indexLink.click();
        const targetRow = page.locator('#theme-spinner-overlay-bg');
        await expect(targetRow).toBeInViewport();
    });
});

test.describe('Theming tab — source panel', () => {
    test('renders a collapsible <details> with the original style content', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
        const details = page.locator('#theming details.cdx-theming-source');
        await expect(details).toBeVisible();
        // Closed by default
        await expect(details).not.toHaveAttribute('open', /.*/);
    });

    test('opens when clicked and reveals the inline-style source code', async ({ page }) => {
        await page.goto(`${COMPONENT_PAGE}#theming`);
        const details = page.locator('#theming details.cdx-theming-source');
        await details.locator('summary').click();
        await expect(details).toHaveAttribute('open', '');
        // The fixture uses inline styles[], rendered as <inline-style-0>
        await expect(details.locator('.cdx-theming-source-file-name')).toContainText(
            'inline-style'
        );
    });
});
