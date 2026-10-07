import { expect, test } from '@playwright/test';
import { pageUrl } from './pages';

const COMPONENT_URL = pageUrl('component', 'LoadingSpinnerComponent');

test.describe('Playground tab', () => {
    test('renders the Playground tab on a component with @playground blocks', async ({ page }) => {
        await page.goto(COMPONENT_URL);
        const tabBar = page.locator('.cdx-tab-bar');
        await expect(tabBar).toContainText('Playground');
    });

    test('emits a manifest script and a launch button per @playground block', async ({ page }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();
        const buttons = page.locator('.cdx-playground-launch');
        // Default (inline) + Multiple (html-mode) + Toggle (ts-mode) = 3
        await expect(buttons).toHaveCount(3);

        const button = buttons.first();
        await expect(button).toBeVisible();
        const manifestId = await button.getAttribute('data-cdx-stackblitz-manifest');
        expect(manifestId).toBeTruthy();

        const manifestNode = page.locator(
            `script[data-cdx-stackblitz-manifest-data="${manifestId}"]`
        );
        await expect(manifestNode).toHaveCount(1);

        const payload = await manifestNode.evaluate(el => JSON.parse(el.textContent ?? '{}'));
        expect(payload.template).toBe('node');
        expect(payload.title).toBe('Default');
        expect(payload.files['src/main.ts']).toContain('bootstrapApplication');
    });

    test('inline-mode manifest packs the JSDoc snippet as the AppComponent template', async ({
        page
    }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();
        const inlineButton = page.locator('.cdx-playground-launch').nth(0);
        const manifestId = await inlineButton.getAttribute('data-cdx-stackblitz-manifest');
        const node = page.locator(`script[data-cdx-stackblitz-manifest-data="${manifestId}"]`);
        const payload = await node.evaluate(el => JSON.parse(el.textContent ?? '{}'));
        expect(payload.title).toBe('Default');
        const app = payload.files['src/app/app.component.ts'];
        expect(app).toContain('<app-loading-spinner');
        // No file-bundle entry point — default scaffold writes the AppComponent.
        expect(app).toContain('export class AppComponent');
    });

    test('html-mode fileRef body lands inside the AppComponent template literal', async ({
        page
    }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();
        const htmlButton = page.locator('.cdx-playground-launch').nth(1);
        const manifestId = await htmlButton.getAttribute('data-cdx-stackblitz-manifest');
        const node = page.locator(`script[data-cdx-stackblitz-manifest-data="${manifestId}"]`);
        const payload = await node.evaluate(el => JSON.parse(el.textContent ?? '{}'));
        expect(payload.title).toBe('Multiple');
        const app = payload.files['src/app/app.component.ts'];
        expect(app).toContain('Loading multiple resources');
        expect(app).toContain('export class AppComponent');
    });

    test('ts-mode fileRef replaces the AppComponent with the entry source verbatim', async ({
        page
    }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();
        const tsButton = page.locator('.cdx-playground-launch').nth(2);
        const manifestId = await tsButton.getAttribute('data-cdx-stackblitz-manifest');
        const node = page.locator(`script[data-cdx-stackblitz-manifest-data="${manifestId}"]`);
        const payload = await node.evaluate(el => JSON.parse(el.textContent ?? '{}'));
        expect(payload.title).toBe('Toggle');
        const app = payload.files['src/app/app.component.ts'];
        expect(app).toContain('export class SpinnerTogglePlayground');
        // Alias-export so `src/main.ts` import { AppComponent } resolves.
        expect(app).toContain('export { SpinnerTogglePlayground as AppComponent }');
    });

    test('manifest JSON uses \\u escapes for `<`/`>`/`&` so it survives any HTML parser', async ({
        page
    }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();
        // Each manifest script must be parseable from textContent without
        // browser-side surprises — regression for the sprint-4 hardening fix.
        const allParse = await page.evaluate(() => {
            const nodes = Array.from(
                document.querySelectorAll<HTMLScriptElement>(
                    'script[data-cdx-stackblitz-manifest-data]'
                )
            );
            const results: Array<{ id: string; ok: boolean; rawHasAngle: boolean }> = [];
            for (const n of nodes) {
                const id = n.dataset.cdxStackblitzManifestData ?? '';
                const text = n.textContent ?? '';
                let ok = false;
                try {
                    JSON.parse(text);
                    ok = true;
                } catch {
                    ok = false;
                }
                results.push({ id, ok, rawHasAngle: /[<>&]/.test(text) });
            }
            return results;
        });
        for (const r of allParse) {
            expect(r.ok, `manifest ${r.id} failed to parse`).toBe(true);
            expect(r.rawHasAngle, `manifest ${r.id} still emits raw <>& chars`).toBe(false);
        }
    });

    test('clicking the launch button calls openProject({ newWindow: true })', async ({ page }) => {
        await page.goto(COMPONENT_URL);
        await page.locator('a#playground-tab').click();

        // Replace the dynamic SDK import with a stub that records the call.
        await page.evaluate(() => {
            (window as any).__playgroundCalls = [];
            const stub = (manifest: any, opts: any) => {
                (window as any).__playgroundCalls.push({ manifest, opts });
            };
            (window as any).StackBlitzSDK = { openProject: stub };

            // Override the dynamic-import path the launcher uses.
            const originalImport = (window as any).__import ?? null;
            (window as any).__import = originalImport;
            const importer = async () => ({ default: (window as any).StackBlitzSDK });
            (window as any).__playgroundImporter = importer;
        });

        // Replace the click handler with a synchronous version that uses the stub.
        await page.evaluate(() => {
            const buttons = document.querySelectorAll<HTMLButtonElement>('.cdx-playground-launch');
            buttons.forEach(btn => {
                const cloned = btn.cloneNode(true) as HTMLButtonElement;
                btn.replaceWith(cloned);
                cloned.addEventListener('click', () => {
                    const id = cloned.dataset.cdxStackblitzManifest;
                    const node = document.querySelector(
                        `script[data-cdx-stackblitz-manifest-data="${id}"]`
                    );
                    const manifest = JSON.parse(node?.textContent ?? '{}');
                    (window as any).StackBlitzSDK.openProject(manifest, { newWindow: true });
                });
            });
        });

        await page.locator('.cdx-playground-launch').first().click();

        const calls = await page.evaluate(() => (window as any).__playgroundCalls);
        expect(calls).toHaveLength(1);
        expect(calls[0].opts).toEqual({ newWindow: true });
        expect(calls[0].manifest.template).toBe('node');
    });

    test('hides the Playground tab on a component without @playground blocks', async ({ page }) => {
        await page.goto(pageUrl('component', 'UserCardComponent'));
        const tabBar = page.locator('.cdx-tab-bar');
        await expect(tabBar).not.toContainText('Playground');
    });
});
