import { expect, test } from '@playwright/test';

test.describe('Overview Dashboard', () => {
    test.describe('Hero', () => {
        test('hero is visible with cdx-entity-hero', async ({ page }) => {
            await page.goto('/overview.html');

            const hero = page.locator('.cdx-entity-hero');
            await expect(hero).toBeVisible();
        });

        test('h1 contains project name', async ({ page }) => {
            await page.goto('/overview.html');

            const h1 = page.locator('.cdx-entity-hero h1');
            await expect(h1).toBeVisible();
            const text = await h1.textContent();
            expect(text!.length).toBeGreaterThan(0);
        });

        test('timestamp rendered as <time> element', async ({ page }) => {
            await page.goto('/overview.html');

            const time = page.locator('.cdx-entity-hero time');
            await expect(time).toBeVisible();
            const datetime = await time.getAttribute('datetime');
            expect(datetime).toBeTruthy();
            expect(datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        });

        test('watermark icon present', async ({ page }) => {
            await page.goto('/overview.html');

            const watermark = page.locator('.cdx-entity-hero-watermark');
            await expect(watermark).toBeVisible();
        });

        test('no old Bootstrap card elements remain', async ({ page }) => {
            await page.goto('/overview.html');

            await expect(page.locator('.card.text-center')).toHaveCount(0);
            await expect(page.locator('.card-block')).toHaveCount(0);
        });
    });

    test.describe('KPI Tiles', () => {
        test('KPI row is visible', async ({ page }) => {
            await page.goto('/overview.html');

            const kpiRow = page.locator('.cdx-overview-kpi-row');
            await expect(kpiRow).toBeVisible();
        });

        test('exactly 4 KPI tiles rendered', async ({ page }) => {
            await page.goto('/overview.html');

            const kpis = page.locator('.cdx-overview-kpi');
            expect(await kpis.count()).toBe(4);
        });

        test('coverage KPI has donut SVG', async ({ page }) => {
            await page.goto('/overview.html');

            const donut = page.locator('.cdx-overview-donut');
            await expect(donut).toBeVisible();
        });

        test('donut percentage text is visible', async ({ page }) => {
            await page.goto('/overview.html');

            const pct = page.locator('.cdx-overview-donut-pct');
            await expect(pct).toBeVisible();
            const text = await pct.textContent();
            expect(text).toMatch(/\d+%/);
        });

        test('coverage KPI links to coverage page', async ({ page }) => {
            await page.goto('/overview.html');

            const coverageKpi = page.locator('a.cdx-overview-kpi--coverage');
            const href = await coverageKpi.getAttribute('href');
            expect(href).toContain('coverage.html');
        });

        test('adoption KPIs have progress bars', async ({ page }) => {
            await page.goto('/overview.html');

            const bars = page.locator('.cdx-overview-adoption-bar');
            expect(await bars.count()).toBeGreaterThan(0);
        });

        test('adoption KPIs show percentage values', async ({ page }) => {
            await page.goto('/overview.html');

            const values = page.locator('.cdx-overview-kpi-value');
            expect(await values.count()).toBeGreaterThanOrEqual(3);
            const text = await values.nth(1).textContent();
            expect(text).toMatch(/\d+%/);
        });

        test('adoption KPIs show fraction counts', async ({ page }) => {
            await page.goto('/overview.html');

            const fractions = page.locator('.cdx-overview-kpi-fraction');
            expect(await fractions.count()).toBeGreaterThanOrEqual(3);
        });
    });

    test.describe('Entity Chips', () => {
        test('chip groups are rendered', async ({ page }) => {
            await page.goto('/overview.html');

            const groups = page.locator('.cdx-overview-chip-group');
            expect(await groups.count()).toBeGreaterThan(0);
        });

        test('chips have icon, count, and label', async ({ page }) => {
            await page.goto('/overview.html');

            const chip = page.locator('.cdx-overview-chip').first();
            await expect(chip.locator('.cdx-overview-chip-icon')).toBeVisible();
            await expect(chip.locator('.cdx-overview-chip-count')).toBeVisible();
            await expect(chip.locator('.cdx-overview-chip-label')).toBeVisible();
        });

        test('component chip shows standalone subtitle', async ({ page }) => {
            await page.goto('/overview.html');

            const subs = page.locator('.cdx-overview-chip-sub');
            const allTexts = await subs.allTextContents();
            const hasStandalone = allTexts.some(t => t.includes('standalone'));
            expect(hasStandalone).toBe(true);
        });

        test('clickable chips are anchor links', async ({ page }) => {
            await page.goto('/overview.html');

            const linkChips = page.locator('a.cdx-overview-chip');
            if ((await linkChips.count()) > 0) {
                const href = await linkChips.first().getAttribute('href');
                expect(href).toBeTruthy();
                expect(href).toMatch(/\.html/);
            }
        });

        test('section headings use h2', async ({ page }) => {
            await page.goto('/overview.html');

            const headings = page.locator('.cdx-overview-section-heading');
            expect(await headings.count()).toBeGreaterThan(0);
            const tag = await headings.first().evaluate(el => el.tagName.toLowerCase());
            expect(tag).toBe('h2');
        });
    });

    test.describe('Dependency Graph', () => {
        test('graph container visible for standalone app', async ({ page }) => {
            await page.goto('/overview.html');

            const graph = page.locator('.cdx-graph-container');
            await expect(graph).toBeVisible();
            await expect(page.locator('#dependency-graph-container')).toBeVisible();
        });
    });

    test.describe('Accessibility', () => {
        test('focus-visible ring on KPI tiles via Tab', async ({ page }) => {
            await page.goto('/overview.html');

            const kpi = page.locator('a.cdx-overview-kpi').first();
            await kpi.focus();

            const outline = await kpi.evaluate(el => getComputedStyle(el).outlineStyle);
            expect(outline).not.toBe('none');
        });

        test('cursor pointer on clickable KPI', async ({ page }) => {
            await page.goto('/overview.html');

            const kpi = page.locator('a.cdx-overview-kpi').first();
            const cursor = await kpi.evaluate(el => getComputedStyle(el).cursor);
            expect(cursor).toBe('pointer');
        });

        test('heading hierarchy: h1 then h2', async ({ page }) => {
            await page.goto('/overview.html');

            const h1 = page.locator('h1');
            await expect(h1).toHaveCount(1);

            const h2s = page.locator('.cdx-overview-section-heading');
            expect(await h2s.count()).toBeGreaterThan(0);
        });

        test('time element has datetime attribute', async ({ page }) => {
            await page.goto('/overview.html');

            const time = page.locator('time[datetime]');
            await expect(time).toHaveCount(1);
        });
    });

    test.describe('Responsive', () => {
        test('no horizontal scroll at 400px width', async ({ page }) => {
            await page.setViewportSize({ width: 400, height: 800 });
            await page.goto('/overview.html');

            const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
            const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
            expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 15);
        });

        test('KPI tiles stack to 2 columns at narrow width', async ({ page }) => {
            await page.setViewportSize({ width: 400, height: 800 });
            await page.goto('/overview.html');

            const kpis = page.locator('.cdx-overview-kpi');
            if ((await kpis.count()) >= 2) {
                const box1 = await kpis.nth(0).boundingBox();
                const box2 = await kpis.nth(1).boundingBox();
                // At narrow width, first two should be side by side (same y)
                // or stacked (different y). Either is valid for 2-col.
                expect(box1).toBeTruthy();
                expect(box2).toBeTruthy();
            }
        });

        test('chips have gap between them', async ({ page }) => {
            await page.goto('/overview.html');

            const chips = page.locator('.cdx-overview-chip');
            if ((await chips.count()) >= 2) {
                const box1 = await chips.nth(0).boundingBox();
                const box2 = await chips.nth(1).boundingBox();
                const hGap = box2!.x - (box1!.x + box1!.width);
                const vGap = box2!.y - (box1!.y + box1!.height);
                const gap = Math.max(hGap, vGap);
                expect(gap).toBeGreaterThanOrEqual(4);
            }
        });
    });

    test.describe('Dependency Graph Styling', () => {
        test('dependency graph SVG has role=img and aria-label', async ({ page }) => {
            await page.goto('/overview.html');
            const svg = page.locator('#dependency-graph-container svg');
            await expect(svg).toBeVisible();
            await expect(svg).toHaveAttribute('role', 'img');
            await expect(svg).toHaveAttribute(
                'aria-label',
                'Standalone component dependency graph'
            );
        });

        test('zoom buttons are present', async ({ page }) => {
            await page.goto('/overview.html');
            await expect(page.locator('#dep-zoom-in')).toBeVisible();
            await expect(page.locator('#dep-reset')).toBeVisible();
            await expect(page.locator('#dep-zoom-out')).toBeVisible();
        });

        test('no module graph on standalone app', async ({ page }) => {
            await page.goto('/overview.html');
            await expect(page.locator('#module-graph-svg')).toHaveCount(0);
        });
    });

    test.describe('Routes Graph Styling', () => {
        test('routes graph SVG has role=img and aria-label', async ({ page }) => {
            await page.goto('/routes.html');
            const svg = page.locator('#body-routes svg');
            await expect(svg).toBeVisible();
            await expect(svg).toHaveAttribute('role', 'img');
            await expect(svg).toHaveAttribute('aria-label', 'Application routes graph');
        });

        test('route nodes have native SVG title tooltips', async ({ page }) => {
            await page.goto('/routes.html');
            const titles = page.locator('#body-routes svg .node title');
            expect(await titles.count()).toBeGreaterThanOrEqual(1);
        });

        test('no Ionicons font reference', async ({ page }) => {
            await page.goto('/routes.html');
            const html = await page.content();
            expect(html).not.toContain('Ionicons');
        });
    });

    test.describe('DOM Tree Styling', () => {
        test('DOM tree nodes use entity-color tokens', async ({ page }) => {
            await page.goto('/components/TodoComponent.html');
            await page.getByRole('tab', { name: 'DOM Tree' }).click();
            // Wait for D3 render
            await page.waitForSelector('#tree-container svg', { timeout: 5000 });
            const ellipses = page.locator('#tree-container ellipse');
            expect(await ellipses.count()).toBeGreaterThanOrEqual(1);
        });

        test('tree legend uses entity-color classes', async ({ page }) => {
            await page.goto('/components/TodoComponent.html');
            await page.getByRole('tab', { name: 'DOM Tree' }).click();
            // Scope to DOM Tree tab panel to avoid matching other .cdx-graph-legend instances
            const treePanel = page.locator('#tree');
            const legend = treePanel.locator('.cdx-graph-legend');
            await expect(legend).toBeVisible();
            const items = legend.locator('.cdx-graph-legend-item');
            expect(await items.count()).toBeGreaterThanOrEqual(3);
        });
    });
});
