import { expect, type Page, test } from '@playwright/test';

// Geometry of the sidebar tree, for every toggle the layout renders: the
// chevron leads the row, an open list draws a guide line, and the children
// of a node start (chevron or content) where the node's own content (icon
// or label) starts.

/** Opens every collapsible list so the whole tree is laid out. */
const openAll = (page: Page) =>
    page.evaluate(() => {
        for (const list of document.querySelectorAll<HTMLElement>('.menu .collapse')) {
            list.classList.add('in');
            list.style.display = 'block';
        }
    });

interface ToggleRow {
    readonly target: string;
    readonly chevronLeft: number;
    readonly contentLeft: number;
    readonly firstChildLeft: number | null;
    readonly guideLine: string;
}

/** Per toggle: chevron x, x of the content after the chevron, x of the first child's content. */
const toggleRows = (page: Page): Promise<ToggleRow[]> =>
    page.evaluate(() => {
        /** Left edge of the content of `row` after its chevron (icon, label or text). */
        const contentLeft = (row: Element): number => {
            const range = document.createRange();
            const lefts: number[] = [];
            for (const node of row.childNodes) {
                if (node instanceof Element && node.classList.contains('cdx-chevron')) {
                    continue;
                }
                if (node instanceof Element) {
                    const rect = node.getBoundingClientRect();
                    if (rect.width > 0) {
                        lefts.push(rect.left);
                    }
                } else if (node.textContent?.trim()) {
                    range.selectNodeContents(node);
                    lefts.push(range.getBoundingClientRect().left);
                }
            }
            return lefts.length > 0 ? Math.min(...lefts) : Number.NaN;
        };
        /** Where a list entry starts: the chevron of a nested node, else its content. */
        const startOf = (li: Element): number | null => {
            const chevron = li.querySelector(':scope > [data-cdx-target] > .cdx-chevron');
            if (chevron) {
                return chevron.getBoundingClientRect().left;
            }
            const row = li.querySelector(':scope > a, :scope > .cdx-feature-role-label');
            return row ? contentLeft(row) : null;
        };
        const rows: ToggleRow[] = [];
        for (const toggle of document.querySelectorAll('.menu [data-cdx-target]')) {
            const chevron = toggle.querySelector(':scope > .cdx-chevron');
            const list = document.getElementById(
                (toggle.getAttribute('data-cdx-target') ?? '').slice(1)
            );
            if (!chevron || !list) {
                continue;
            }
            // A page with children: the button holds only the chevron, the link follows it.
            const content = toggle.classList.contains('cdx-additional-toggle')
                ? toggle.nextElementSibling
                : toggle;
            const firstChild = list.querySelector(':scope > li');
            rows.push({
                target: toggle.getAttribute('data-cdx-target') ?? '',
                chevronLeft: chevron.getBoundingClientRect().left,
                contentLeft: content ? contentLeft(content) : Number.NaN,
                firstChildLeft: firstChild ? startOf(firstChild) : null,
                guideLine: `${getComputedStyle(list).borderLeftWidth} ${getComputedStyle(list).borderLeftStyle}`
            });
        }
        return rows;
    });

test.describe('Sidebar tree', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/index.html');
        await page.locator('.menu [data-cdx-target]').first().waitFor({ state: 'attached' });
        // A rotating chevron has a wider box; measure the settled layout.
        await page.addStyleTag({ content: '* { transition: none !important; }' });
        await openAll(page);
    });

    test('puts the chevron of every toggle before its content', async ({ page }) => {
        const rows = await toggleRows(page);
        expect(rows.length).toBeGreaterThan(3);
        for (const row of rows) {
            expect(row.chevronLeft, row.target).toBeLessThan(row.contentLeft);
        }
    });

    test('draws a guide line along every list of children', async ({ page }) => {
        for (const row of await toggleRows(page)) {
            expect(row.guideLine, row.target).toBe('1px solid');
        }
    });

    test('starts the children where the content of their node starts', async ({ page }) => {
        const rows = (await toggleRows(page)).filter(row => row.firstChildLeft !== null);
        expect(rows.length).toBeGreaterThan(3);
        for (const row of rows) {
            expect(row.firstChildLeft, row.target).toBeCloseTo(row.contentLeft, 0);
        }
    });
});
