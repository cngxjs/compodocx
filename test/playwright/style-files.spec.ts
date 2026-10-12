import { expect, test } from '@playwright/test';
import { featureUrl, pageUrl, rootUrl } from './pages';

// Style files (style-library fixture, port 4006, search on): free-standing
// style files get a page in their feature folder, link to the components and
// directives they theme, feed the design tokens page and the feature pages.

test.describe('Style files', () => {
    test('the sidebar lists the style pages and a style page renders its tokens', async ({
        page
    }) => {
        await page.goto('/index.html');
        await expect(
            page.locator('.cdx-feature-link[data-cdx-kind="style"] .cdx-menu-item-name', {
                hasText: /^tokens$/
            })
        ).toHaveCount(1);
        await page.goto(pageUrl('style', 'tokens'));
        await expect(page.locator('.cdx-entity-hero-name')).toHaveText('tokens');
        await expect(page.locator('#theme-sty-color-primary')).toBeVisible();
    });

    test('a style page shows its import line, the symbols it themes, mixins and source', async ({
        page
    }) => {
        await page.goto(pageUrl('style', 'card-theme'));
        await expect(page.locator('.cdx-entity-hero-selector code')).toHaveText(
            "@use '@sty/themes/material/card-theme';"
        );
        const themes = page.locator('#themes .cdx-related-pill');
        await expect(themes).toHaveText(['StyCard', 'StyTooltip']);
        await expect(page.locator('#theme-mixin-theme')).toBeVisible();
        await expect(page.locator('#source details.cdx-theming-source')).toHaveCount(1);
        await themes.first().click();
        await expect(page).toHaveURL(/StyCard\.html/);
    });

    test('a directive themed by a style file gets a Theming tab with its tokens', async ({
        page
    }) => {
        await page.goto(`${pageUrl('directive', 'StyHighlight')}#theming`);
        const panel = page.locator('#theming');
        await expect(panel).toBeVisible();
        await expect(panel.locator('#theme-sty-highlight-bg')).toBeVisible();
        await expect(panel.locator('.cdx-theming-linked code')).toHaveText('sty-highlight.css');
    });

    test('a component tab names a linked file and links its style page', async ({ page }) => {
        await page.goto(`${pageUrl('component', 'StyCard')}#theming`);
        const linked = page.locator('#theming .cdx-theming-linked a');
        await expect(linked).toHaveText('card-theme.scss');
        await linked.click();
        await expect(page).toHaveURL(/card-theme\.html/);
    });

    test('the design tokens page groups the global tokens and links their file', async ({
        page
    }) => {
        await page.goto(rootUrl('design-tokens'));
        await expect(page.locator('h2.cdx-section-heading')).toHaveText([/Colour/, /Spacing/]);
        await expect(page.locator('#token-sty-space-md')).toBeVisible();
        const definedIn = page.locator('#token-sty-space-md .cdx-theming-defined-in a');
        await expect(definedIn).toHaveText('tokens.css');
        await definedIn.click();
        await expect(page).toHaveURL(/tokens\.html/);
    });

    test('a feature page lists its style files and the design tokens page', async ({ page }) => {
        await page.goto(featureUrl(['kit', 'theming']));
        const section = page.locator('#theming').locator('..');
        await expect(section.locator('[data-cdx-feature-member="style"] code')).toHaveText(
            'tokens.css'
        );
        await expect(section.locator('.cdx-feature-design-tokens a')).toBeVisible();
        await page.goto(featureUrl(['kit', 'highlight']));
        await expect(page.locator('a[href$="StyHighlight.html#theming"]')).toBeVisible();
    });

    test('the command palette finds a style page', async ({ page }) => {
        await page.goto('/index.html');
        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
        await dialog.locator('.cdx-cp-input').fill('card-theme');
        const hit = dialog.locator('.cdx-cp-item[href$="card-theme.html"]');
        await expect(hit.first()).toBeVisible({ timeout: 10_000 });
        await expect(hit.first().locator('.cdx-cp-kind')).toContainText('Style');
    });
});
