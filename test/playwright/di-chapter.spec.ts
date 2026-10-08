import { expect, test } from '@playwright/test';
import { memberAnchor } from '../../src/app/links/layout';
import { clusterUrl, pageUrl, rootUrl } from './pages';

// Runs against the semantic-library fixture with search enabled (playwright
// project `semantic`, port 4005). `FooFeature` is a feature type with three
// providers and two feature functions; `provideFooLimit` is a provider
// without a feature type.

const FEATURE_TYPE = 'FooFeature';
const PROVIDERS = ['provideFoo', 'provideFooAt', 'provideFooFeatures'];
const FEATURES = ['withExtras', 'withMode'];

test.describe('Dependency Injection chapter', () => {
    test('sidebar has Dependency Injection and Utilities, no Miscellaneous', async ({ page }) => {
        await page.goto('/index.html');
        await expect(page.locator('#dependency-injection-links')).toHaveCount(1);
        await expect(page.locator('#utilities-links')).toHaveCount(1);
        await expect(page.locator('#miscellaneous-links')).toHaveCount(0);
        await expect(page.locator('#tokens-links')).toHaveCount(0);

        const providers = page.locator('#dependency-injection-group-providers');
        await expect(
            providers.locator(`a[href$="${clusterUrl(FEATURE_TYPE).slice(1)}"]`)
        ).toHaveCount(1);
        await expect(
            providers.locator(`a[href$="${pageUrl('provider', 'provideFooLimit').slice(1)}"]`)
        ).toHaveCount(1);
        await expect(
            page.locator('#dependency-injection-group-tokens a[href$="FOO_CONFIG.html"]')
        ).toHaveCount(1);
    });

    test('landing page links the feature type, its members and the tokens', async ({ page }) => {
        await page.goto(rootUrl('dependency-injection'));
        await expect(
            page.locator(`a[href$="${clusterUrl(FEATURE_TYPE).slice(1)}"]`).first()
        ).toBeAttached();
        for (const name of [...PROVIDERS, ...FEATURES]) {
            await expect(
                page.locator(`a[href$="#${memberAnchor(name, FEATURE_TYPE)}"]`).first()
            ).toBeAttached();
        }
        await expect(
            page.locator(`a[href$="${pageUrl('token', 'FOO_CONFIG').slice(1)}"]`).first()
        ).toBeAttached();
    });
});

test.describe('Feature type page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(clusterUrl(FEATURE_TYPE));
    });

    test('renders type, providers, features and tokens sections', async ({ page }) => {
        for (const id of ['type', 'providers', 'features', 'tokens']) {
            await expect(page.locator(`h2#${id}`)).toHaveCount(1);
        }
        await expect(page.locator('h1')).toContainText(FEATURE_TYPE);
    });

    test('gives every provider and feature function its own namespaced heading', async ({
        page
    }) => {
        for (const name of [...PROVIDERS, ...FEATURES]) {
            const heading = page.locator(`[id="${memberAnchor(name, FEATURE_TYPE)}"]`);
            await expect(heading).toHaveCount(1);
            await expect(heading).toContainText(name);
        }
    });

    test('has one tab set and no source tab', async ({ page }) => {
        await expect(page.locator('#info-tab')).toHaveCount(1);
        await expect(page.locator('#source-tab')).toHaveCount(0);
    });
});

test.describe('Cluster member deep link', () => {
    test('scrolls to the member section', async ({ page }) => {
        const anchor = memberAnchor('withMode', FEATURE_TYPE);
        await page.goto(`${clusterUrl(FEATURE_TYPE)}#${anchor}`);
        const heading = page.locator(`[id="${anchor}"]`);
        await expect(heading).toBeVisible();
        await expect(heading).toBeInViewport();
    });
});

test.describe('Token page', () => {
    test('shows provided by, injected by and used by', async ({ page }) => {
        await page.goto(pageUrl('token', 'FOO_LIMIT'));
        await expect(page.locator('#provided-by')).toHaveCount(1);
        await expect(page.locator('#injected-by')).toHaveCount(1);
        await expect(page.locator('#used-by')).toHaveCount(1);
        await expect(
            page.locator(`a[href$="${pageUrl('provider', 'provideFooLimit').slice(1)}"]`).first()
        ).toBeAttached();
    });
});

test.describe('Command palette', () => {
    test('lists each provider and feature of a feature type page as its own result', async ({
        page
    }) => {
        await page.goto('/index.html');
        await page.keyboard.press('Meta+k');
        const dialog = page.locator('#cdx-command-palette');
        await expect(dialog).toBeVisible();
        await dialog.locator('.cdx-cp-input').fill('withMode');

        const member = dialog.locator(
            `.cdx-cp-item[href$="#${memberAnchor('withMode', FEATURE_TYPE)}"]`
        );
        await expect(member.first()).toBeVisible({ timeout: 10_000 });
        await expect(member.first().locator('.cdx-cp-name')).toHaveText('withMode');
        await expect(member.first().locator('.cdx-cp-kind')).toContainText('Provider');
    });
});
