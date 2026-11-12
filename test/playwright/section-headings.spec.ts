import { expect, type Locator, test } from '@playwright/test';
import { pageUrl } from './pages';

// Heading typography. System headings (section headings, block headings,
// index group labels) are sentence case at a readable size; markdown headings
// in `.cdx-readme` step down by level, the first one keeps the page-title look.
// Standalone fixture (port 4002).

const COMPONENT_PAGE = (): string => pageUrl('component', 'LoadingSpinnerComponent');
const MARKDOWN_PAGE = '/additional-documentation/guides/signals-&-reactivity.html';

const typeOf = (heading: Locator) =>
    heading.evaluate(el => {
        const style = getComputedStyle(el);
        return {
            fontSize: style.fontSize,
            textTransform: style.textTransform,
            letterSpacing: style.letterSpacing
        };
    });

test.describe('Heading typography', () => {
    test('system headings are sentence case and not tracked', async ({ page }) => {
        await page.goto(COMPONENT_PAGE());

        const cases: ReadonlyArray<readonly [string, string]> = [
            ['.cdx-section-heading', '15px'],
            ["[data-compodoc^='block-'] > h3", '15px'],
            ['.cdx-index-group-label', '13px']
        ];
        for (const [selector, fontSize] of cases) {
            const heading = page.locator(selector).first();
            await expect(heading, selector).toBeAttached();
            expect(await typeOf(heading), selector).toEqual({
                fontSize,
                textTransform: 'none',
                letterSpacing: 'normal'
            });
        }
    });

    test('the first markdown heading keeps the page-title size', async ({ page }) => {
        await page.goto(MARKDOWN_PAGE);

        const first = page.locator('.cdx-readme > :first-child');
        await expect(first).toHaveJSProperty('tagName', 'H1');
        const style = await typeOf(first);
        expect(style.fontSize).toBe('28px');
        expect(style.textTransform).toBe('none');
    });

    test('following markdown headings step down by level', async ({ page }) => {
        await page.goto(MARKDOWN_PAGE);
        const readme = page.locator('.cdx-readme');

        const sizes: ReadonlyArray<readonly [string, string, string]> = [
            ['h2', '20px', 'none'],
            ['h3', '17px', 'none'],
            ['h4', '15px', 'none'],
            ['h5', '14px', 'uppercase']
        ];
        for (const [tag, fontSize, textTransform] of sizes) {
            const style = await typeOf(readme.locator(tag).first());
            expect(style.fontSize, tag).toBe(fontSize);
            expect(style.textTransform, tag).toBe(textTransform);
        }
    });
});
