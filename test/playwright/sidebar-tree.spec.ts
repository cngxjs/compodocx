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

/** The computed colour of a token, in the form `getComputedStyle` reports colours. */
const tokenColor = (page: Page, token: string) =>
    page.evaluate(name => {
        const probe = document.createElement('span');
        probe.style.color = `var(${name})`;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
    }, token);

test.describe('Sidebar tree states', () => {
    test('marks the active page with an accent pill on an accent rail', async ({ page }) => {
        // A page two levels down: its link sits in a list with a guide line.
        await page.goto('/index.html');
        const href = await page
            .locator('.menu ul.links ul.links a[data-type="entity-link"]')
            .first()
            .getAttribute('href');
        expect(href).toBeTruthy();
        await page.goto(`/${href}`);
        const active = page.locator('.menu a.active').first();
        await expect(active).toBeVisible();

        const accent = await tokenColor(page, '--color-cdx-accent');
        await expect(active).toHaveCSS('color', accent);
        // The pill sits flush on the rail: square on the left, rounded on the right.
        const corners = await active.evaluate(el => ({
            left: getComputedStyle(el).borderTopLeftRadius,
            right: getComputedStyle(el).borderTopRightRadius
        }));
        expect(corners.left).toBe('0px');
        expect(corners.right).not.toBe('0px');
        // The rail is the guide line of the list that holds the active page.
        const rail = await active.evaluate(el => {
            const list = getComputedStyle(el.closest('ul') as HTMLElement);
            return { color: list.borderLeftColor, shadow: list.boxShadow };
        });
        expect(rail.color).toBe(accent);
        expect(rail.shadow).toContain(accent);
    });

    test('keeps the active page and the focus ring readable in every theme', async ({ page }) => {
        await page.goto('/index.html');
        const href = await page
            .locator('.menu ul.links ul.links a[data-type="entity-link"]')
            .first()
            .getAttribute('href');
        await page.goto(`/${href}`);
        await page.addStyleTag({ content: '* { transition: none !important; }' });
        await expect(page.locator('.menu a.active').first()).toBeVisible();

        const results = await page.evaluate(async () => {
            const ctx = document.createElement('canvas').getContext('2d', {
                willReadFrequently: true
            }) as CanvasRenderingContext2D;
            /** Any CSS colour as rgba via the canvas (also `color-mix()` results). */
            const rgba = (color: string): number[] => {
                ctx.clearRect(0, 0, 1, 1);
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
                return [r, g, b, a / 255];
            };
            const luminance = ([r, g, b]: number[]) => {
                const f = (v: number) => {
                    const c = v / 255;
                    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
                };
                return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const contrast = (a: number[], b: number[]) => {
                const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
                return (hi + 0.05) / (lo + 0.05);
            };
            const over = (fg: number[], bg: number[]) =>
                [0, 1, 2].map(i => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
            const themes = [
                ...new Set(
                    [...document.querySelectorAll('[data-cdx-theme]')].map(
                        item => item.getAttribute('data-cdx-theme') ?? 'default'
                    )
                )
            ];
            const link = document.getElementById('cdx-theme-link') as HTMLLinkElement;
            const out: { theme: string; text: number; rail: number; ring: number }[] = [];
            for (const theme of themes) {
                if (theme !== 'default') {
                    await new Promise(resolve => {
                        link.onload = resolve;
                        link.href = `${link.getAttribute('data-base')}styles/${theme}.css`;
                    });
                } else {
                    link.removeAttribute('href');
                }
                for (const dark of [false, true]) {
                    document.documentElement.classList.toggle('dark', dark);
                    document.body.classList.toggle('dark', dark);
                    const active = document.querySelector('.menu a.active') as HTMLElement;
                    const sidebar = rgba(
                        getComputedStyle(document.getElementById('sidebar') as HTMLElement)
                            .backgroundColor
                    );
                    const row = over(rgba(getComputedStyle(active).backgroundColor), sidebar);
                    const probe = document.createElement('span');
                    probe.style.color = 'var(--color-cdx-focus-ring)';
                    document.body.append(probe);
                    const ring = rgba(getComputedStyle(probe).color);
                    probe.remove();
                    out.push({
                        theme: `${theme} ${dark ? 'dark' : 'light'}`,
                        text: contrast(rgba(getComputedStyle(active).color), row),
                        rail: contrast(
                            rgba(
                                getComputedStyle(active.closest('ul') as HTMLElement)
                                    .borderLeftColor
                            ),
                            sidebar
                        ),
                        ring: contrast(ring, sidebar)
                    });
                }
            }
            return out;
        });

        expect(results.length).toBeGreaterThanOrEqual(2);
        for (const result of results) {
            expect(result.text, result.theme).toBeGreaterThanOrEqual(4.5);
            expect(result.rail, result.theme).toBeGreaterThanOrEqual(3);
            expect(result.ring, result.theme).toBeGreaterThanOrEqual(3);
        }
    });

    test('outlines a focused toggle with the focus ring colour', async ({ page }) => {
        await page.goto('/index.html');
        const toggle = page.locator('.menu [data-cdx-target]').first();
        await toggle.focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const ring = await tokenColor(page, '--color-cdx-focus-ring');
        await expect(toggle).toHaveCSS('outline-color', ring);
        await expect(toggle).toHaveCSS('outline-style', 'solid');
    });
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

    test('fits the open tree into the sidebar width', async ({ page }) => {
        const width = await page.evaluate(() => {
            const sidebar = document.getElementById('sidebar') as HTMLElement;
            return { scroll: sidebar.scrollWidth, client: sidebar.clientWidth };
        });
        expect(width.scroll).toBeLessThanOrEqual(width.client);
    });

    test('draws a guide line along every list of children', async ({ page }) => {
        for (const row of await toggleRows(page)) {
            expect(row.guideLine, row.target).toBe('1px solid');
        }
    });

    test('writes folder, bucket and role labels in sentence case', async ({ page }) => {
        const transforms = await page.evaluate(() =>
            [
                ...document.querySelectorAll(
                    '.menu .chapter.inner > .menu-toggler .link-name, .menu .cdx-bucket-row .link-name'
                )
            ].map(label => getComputedStyle(label).textTransform)
        );
        expect(transforms.length).toBeGreaterThan(0);
        expect(new Set(transforms)).toEqual(new Set(['none']));
    });

    test('starts the children where the content of their node starts', async ({ page }) => {
        const rows = (await toggleRows(page)).filter(row => row.firstChildLeft !== null);
        expect(rows.length).toBeGreaterThan(3);
        for (const row of rows) {
            expect(row.firstChildLeft, row.target).toBeCloseTo(row.contentLeft, 0);
        }
    });
});
