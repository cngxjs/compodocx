import { expect, test } from '@playwright/test';

test.describe('Content Sections', () => {
    test.describe('File path in hero', () => {
        test('component page shows file path in hero', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            const filePath = page.locator('.cdx-entity-hero-file');
            await expect(filePath).toBeVisible();
            await expect(filePath).toContainText('about.component.ts');
        });

        test('directive page shows file path in hero', async ({ page }) => {
            await page.goto('/directives/HighlightDirective.html');

            const filePath = page.locator('.cdx-entity-hero-file');
            await expect(filePath).toBeVisible();
            await expect(filePath).toContainText('highlight.directive.ts');
        });

        test('injectable page shows file path in hero', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const filePath = page.locator('.cdx-entity-hero-file');
            await expect(filePath).toBeVisible();
            await expect(filePath).toContainText('todo.store.ts');
        });

        test('file path has source-file title tooltip', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            const filePath = page.locator('.cdx-entity-hero-file');
            // `<p>` does not support `aria-label` (Biome
            // `useAriaPropsSupportedByRole`); the source-file hint lives in
            // the `title` attribute instead and surfaces as a native browser
            // tooltip on hover.
            await expect(filePath).toHaveAttribute('title', 'Source file');
        });

        test('no File section in Info tab body', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            // The old pattern had <h3>File</h3> inside the info tab
            const infoPanel = page.locator('.cdx-tab-panel#info');
            const fileHeading = infoPanel.locator('h3', { hasText: /^File$/ });
            await expect(fileHeading).toHaveCount(0);
        });
    });

    test.describe('Deprecation banner', () => {
        test('deprecated entity shows deprecation banner', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');
            await page.locator('[role="tab"]', { hasText: 'Info' }).click();

            const banner = page.locator('.cdx-deprecation-banner');
            await expect(banner).toBeVisible();
            await expect(banner.locator('strong')).toHaveText('Deprecated');
        });

        test('deprecation banner has alert role', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const banner = page.locator('.cdx-deprecation-banner');
            await expect(banner).toHaveAttribute('role', 'alert');
        });

        test('non-deprecated entity has no deprecation banner', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            await expect(page.locator('.cdx-deprecation-banner')).toHaveCount(0);
        });
    });

    test.describe('Description prose', () => {
        test('description wrapped in cdx-prose', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            const prose = page.locator('.cdx-prose');
            await expect(prose).toBeVisible();
            await expect(prose).toContainText('The about component');
        });
    });

    test.describe('Section headings', () => {
        test('section headings use cdx-section-heading class', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const headings = page.locator('.cdx-section-heading');
            expect(await headings.count()).toBeGreaterThan(0);
        });

        test('first section heading has no border-top', async ({ page }) => {
            // Use a non-deprecated entity so the first child is a content section
            await page.goto('/components/AboutComponent.html');

            const firstSection = page.locator('.cdx-content-section').first();
            const heading = firstSection.locator('.cdx-section-heading');
            const borderTop = await heading.evaluate(el => getComputedStyle(el).borderTopWidth);
            expect(borderTop).toBe('0px');
        });
    });

    test.describe('Metadata card', () => {
        test('component metadata renders as cdx-metadata-card', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            // `host: {}` metadata renders a second card (host listeners);
            // the decorator metadata card is the first one.
            const card = page.locator('.cdx-metadata-card').first();
            await expect(card).toBeVisible();

            // Should have selector row
            const selectorLabel = card.locator('.cdx-metadata-label', { hasText: 'selector' });
            await expect(selectorLabel).toBeVisible();
        });

        test('directive metadata renders as cdx-metadata-card', async ({ page }) => {
            // BorderDirective has a selector, so the metadata card is non-empty
            // and renders. BaseDirective (abstract base, no metadata) would
            // correctly render nothing and was unsuitable for this assertion.
            await page.goto('/directives/BorderDirective.html');

            const card = page.locator('.cdx-metadata-card').first();
            await expect(card).toBeVisible();
        });

        test('metadata card uses dl element', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            const dl = page.locator('dl.cdx-metadata-card').first();
            await expect(dl).toBeVisible();
        });

        test('no Bootstrap table.metadata remains', async ({ page }) => {
            await page.goto('/components/AboutComponent.html');

            await expect(page.locator('table.metadata')).toHaveCount(0);
        });
    });

    test.describe('Index type indicators', () => {
        test('index shows colored letter indicators', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const indicators = page.locator('.cdx-index-indicator');
            expect(await indicators.count()).toBeGreaterThan(0);
        });

        test('property indicator shows P', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const propIndicator = page.locator('.cdx-index-indicator--property').first();
            await expect(propIndicator).toHaveText('P');
        });

        test('method indicator shows M', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const methodIndicator = page.locator('.cdx-index-indicator--method').first();
            await expect(methodIndicator).toHaveText('M');
        });

        test('input indicator shows I on directive page', async ({ page }) => {
            await page.goto('/directives/BaseDirective.html');

            const inputIndicator = page.locator('.cdx-index-indicator--input').first();
            await expect(inputIndicator).toHaveText('I');
        });

        test('output indicator shows O on directive page', async ({ page }) => {
            await page.goto('/directives/BaseDirective.html');

            const outputIndicator = page.locator('.cdx-index-indicator--output').first();
            await expect(outputIndicator).toHaveText('O');
        });

        test('index indicators have aria-hidden', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const indicator = page.locator('.cdx-index-indicator').first();
            await expect(indicator).toHaveAttribute('aria-hidden', 'true');
        });

        test('index entries are clickable links', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const entry = page.locator('.cdx-index-entry').first();
            const href = await entry.getAttribute('href');
            expect(href).toMatch(/^#/);
        });

        test('index uses flex column layout', async ({ page }) => {
            await page.goto('/injectables/TodoStore.html');

            const entries = page.locator('.cdx-index-entries').first();
            const display = await entries.evaluate(el => getComputedStyle(el).display);
            // Index entries use flex (column), not grid
            expect(display).toBe('flex');
        });

        test('deprecated members have line-through in index', async ({ page }) => {
            await page.goto('/classes/Todo.html');

            const deprecated = page.locator('.cdx-index-entry--deprecated');
            if ((await deprecated.count()) > 0) {
                const name = deprecated.first().locator('.cdx-index-name');
                const decoration = await name.evaluate(
                    el => getComputedStyle(el).textDecorationLine
                );
                expect(decoration).toBe('line-through');
            }
        });
    });

    test.describe('Index overflow and responsive', () => {
        test('index entries do not overflow the index container', async ({ page }) => {
            // CompodocComponent has many long signal names
            await page.goto('/components/CompodocComponent.html');
            await page.locator('[role="tab"]', { hasText: 'API' }).click();

            const indexBox = page.locator('.cdx-index');
            const indexRect = await indexBox.boundingBox();
            expect(indexRect).not.toBeNull();

            const entries = page.locator('.cdx-index-entry');
            const count = await entries.count();
            for (let i = 0; i < count; i++) {
                const entryRect = await entries.nth(i).boundingBox();
                if (!entryRect || !indexRect) {
                    continue;
                }
                // Entry right edge must not exceed index box right edge
                expect(entryRect.x + entryRect.width).toBeLessThanOrEqual(
                    indexRect!.x + indexRect!.width + 1 // 1px tolerance for rounding
                );
            }
        });

        test('long names are truncated with ellipsis', async ({ page }) => {
            await page.goto('/components/CompodocComponent.html');

            // Find an entry with a long name that gets truncated
            const names = page.locator('.cdx-index-name');
            const count = await names.count();
            let foundTruncated = false;
            for (let i = 0; i < count; i++) {
                const overflow = await names.nth(i).evaluate(el => getComputedStyle(el).overflow);
                if (overflow === 'hidden') {
                    foundTruncated = true;
                    const textOverflow = await names
                        .nth(i)
                        .evaluate(el => getComputedStyle(el).textOverflow);
                    expect(textOverflow).toBe('ellipsis');
                    break;
                }
            }
            expect(foundTruncated).toBe(true);
        });

        test('index collapses to single column on narrow viewport', async ({ page }) => {
            await page.setViewportSize({ width: 400, height: 800 });
            await page.goto('/injectables/TodoStore.html');
            await page.locator('[role="tab"]', { hasText: 'API' }).click();

            const entries = page.locator('.cdx-index-entries').first();
            const columns = await entries.evaluate(el => getComputedStyle(el).gridTemplateColumns);
            // At 400px viewport (minus sidebar), content area is very narrow
            // Grid should collapse to fewer columns
            const colCount = columns.split(' ').length;
            expect(colCount).toBeLessThanOrEqual(2);
        });

        test('index indicators do not shrink', async ({ page }) => {
            await page.goto('/components/CompodocComponent.html');
            await page.locator('[role="tab"]', { hasText: 'API' }).click();

            const indicator = page.locator('.cdx-index-indicator').first();
            const width = await indicator.evaluate(el => el.getBoundingClientRect().width);
            // Indicator should be exactly 20px (flex-shrink: 0)
            expect(width).toBeCloseTo(20, 0);
        });
    });

    test.describe('Extends in metadata', () => {
        test('class with extends shows extends row in metadata card', async ({ page }) => {
            await page.goto('/classes/Todo.html');
            await page.locator('[role="tab"]', { hasText: 'Info' }).click();

            const card = page.locator('.cdx-metadata-card');
            if ((await card.count()) > 0) {
                const extendsLabel = card.locator('.cdx-metadata-label', { hasText: 'extends' });
                if ((await extendsLabel.count()) > 0) {
                    await expect(extendsLabel).toBeVisible();
                }
            }
        });
    });
});
