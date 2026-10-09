import { expect, test } from '@playwright/test';
import { pageOf } from '../src/helpers/pages';
import { bucketUrl, pageUrl } from './pages';

// Runs against the standalone-app fixture rebuilt with menuLayout: 'feature'
// (see playwright project `standalone-feature`, port 4004). Sidebar holds
// the curated Features chapter (organisms + @docsKind primary promotions);
// the exhaustive reference catalogue lives on the single-page
// `references.html` portal, linked as a top-level chapter.

test.describe('menuLayout: "feature" sidebar', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/index.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('renders Features chapter, References top-nav link, and no per-kind chapters', async ({
        page
    }) => {
        await expect(page.locator('#features-links')).toHaveCount(1);
        // The cross-kind References chapter is replaced by a top-level link
        // pointing at the portal page.
        await expect(page.locator('#references-links')).toHaveCount(0);
        await expect(page.locator('.chapter.references a[href$="references.html"]')).toHaveCount(1);
        // The per-kind chapters that exist in default-layout standalone-doc
        // must NOT be rendered under feature layout.
        await expect(page.locator('#components-links')).toHaveCount(0);
        await expect(page.locator('#directives-links')).toHaveCount(0);
        await expect(page.locator('#injectables-links')).toHaveCount(0);
        await expect(page.locator('#pipes-links')).toHaveCount(0);
    });

    test('Miscellaneous chapter is suppressed in feature mode (everything in References portal)', async ({
        page
    }) => {
        // Miscellaneous is redundant under feature layout — functions /
        // variables / typealiases / enumerations all surface on
        // `references.html` and on per-bucket landings.
        await expect(page.locator('#miscellaneous-links')).toHaveCount(0);
    });

    test('Features chapter mixes primary-kind entities in one bucket', async ({ page }) => {
        // The admin-settings folder in the standalone fixture bundles a
        // service (injectable) with three components — exercises the cross-
        // kind mixing the chapter is built for.
        const bucket = page
            .locator('#features-links')
            .locator('ul[id="features-group-features/admin-settings"]');
        await expect(bucket).toHaveCount(1);

        await expect(
            bucket.locator('> li.cdx-feature-link[data-cdx-kind="component"]').first()
        ).toBeAttached();
        await expect(
            bucket.locator('> li.cdx-feature-link[data-cdx-kind="injectable"]').first()
        ).toBeAttached();
    });

    test('entity links inside Features chapter point at per-kind detail pages', async ({
        page
    }) => {
        const componentLink = page.locator('#features-links a[data-cdx-entity-type="component"]');
        const first = componentLink.first();
        await expect(first).toHaveAttribute('href', /(?:\.\/)?components\/[A-Za-z]+\.html$/);
    });

    test('top-nav Reference link points at references.html', async ({ page }) => {
        // The cross-kind exhaustive surface is no longer a sidebar tree — it
        // lives on the `references.html` portal page. The sidebar surfaces
        // a single chapter-style link to that page.
        const navLink = page.locator('.chapter.references a[data-type="chapter-link"]');
        await expect(navLink).toHaveCount(1);
        const href = await navLink.getAttribute('href');
        expect(href).toMatch(/^(?:\.\/)?references\.html$/);
        // Localised singular label — `t('reference')`.
        await expect(navLink).toContainText(/Reference/);
    });

    test('references.html renders filter bar + bucket sections + items', async ({ page }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        // Portal hero uses its own lean heading element, not the shared
        // entity-hero block.
        await expect(page.locator('h1.cdx-ref-hero-title')).toContainText('API Reference');
        await expect(page.locator('[data-cdx-ref-search]')).toHaveCount(1);
        await expect(page.locator('[data-cdx-ref-bucket-select]')).toHaveCount(1);
        await expect(page.locator('[data-cdx-ref-kind-chip]').first()).toBeAttached();
        await expect(page.locator('.cdx-ref-bucket-section').first()).toBeAttached();
        const items = page.locator('.cdx-ref-item');
        expect(await items.count()).toBeGreaterThan(0);
    });

    test('references.html filter input narrows visible items + sections', async ({ page }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        const before = await page.locator('.cdx-ref-item:not([data-cdx-ref-hidden])').count();
        expect(before).toBeGreaterThan(0);

        await page.locator('[data-cdx-ref-search]').fill('user');
        // Filter is synchronous on input event — no need to wait.
        const after = await page.locator('.cdx-ref-item:not([data-cdx-ref-hidden])').count();
        expect(after).toBeLessThan(before);
        expect(after).toBeGreaterThan(0);
        // Visible items should all carry "user" in their name attr.
        const names = await page
            .locator('.cdx-ref-item:not([data-cdx-ref-hidden])')
            .evaluateAll(els => els.map(el => el.getAttribute('data-cdx-name')));
        expect(names.every(n => (n ?? '').includes('user'))).toBe(true);
        // Empty buckets hide.
        const allSections = await page.locator('.cdx-ref-bucket-section').count();
        const visibleSections = await page
            .locator('.cdx-ref-bucket-section:not([data-cdx-ref-hidden])')
            .count();
        expect(visibleSections).toBeLessThan(allSections);
    });

    test('references.html kind chip click filters by kind + updates URL', async ({ page }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        // Reset to baseline (all chips pressed) — applyFilter writes the
        // current state to the URL on bind, so the first interaction starts
        // from a known clean URL.
        await page.locator('[data-cdx-ref-reset]').first().click();
        await page.locator('[data-cdx-ref-kind-chip="interface"]').click();
        // Interface chip now inactive → no interface items should be visible.
        const visibleKinds = await page
            .locator('.cdx-ref-item:not([data-cdx-ref-hidden])')
            .evaluateAll(els => els.map(el => el.getAttribute('data-cdx-kind')));
        expect(visibleKinds.includes('interface')).toBe(false);
        // URL syncs to the active set (subset of all kinds).
        await expect(page).toHaveURL(/[?&]kind=/);
    });

    test('references.html URL state restores on direct deep-link', async ({ page }) => {
        await page.goto('/references.html?q=user&kind=Component');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('[data-cdx-ref-search]')).toHaveValue('user');
        const visibleKinds = await page
            .locator('.cdx-ref-item:not([data-cdx-ref-hidden])')
            .evaluateAll(els => els.map(el => el.getAttribute('data-cdx-kind')));
        // Only components, no other kinds — case-insensitive URL parsing
        // accepts both `Component` (label) and `component` (id).
        expect(new Set(visibleKinds).size).toBeLessThanOrEqual(1);
        expect(visibleKinds.every(k => k === 'component')).toBe(true);
    });

    test('references.html reset clears every filter and the URL', async ({ page }) => {
        await page.goto('/references.html?q=user&kind=Component');
        await page.waitForLoadState('domcontentloaded');
        await page.locator('[data-cdx-ref-reset]').first().click();
        await expect(page.locator('[data-cdx-ref-search]')).toHaveValue('');
        // Reset writes all-active state, which collapses to no `kind` /
        // `stability` / `q` / `bucket` params.
        const url = new URL(page.url());
        expect(url.searchParams.has('q')).toBe(false);
        expect(url.searchParams.has('kind')).toBe(false);
        expect(url.searchParams.has('stability')).toBe(false);
        expect(url.searchParams.has('bucket')).toBe(false);
    });

    test('references.html row anchors navigate to entity detail pages', async ({ page }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        const anchor = page.locator('.cdx-ref-item-link').first();
        const href = await anchor.getAttribute('href');
        expect(href).toMatch(/\.html(?:#|$)/);
        await anchor.click();
        await page.waitForLoadState('domcontentloaded');
        // We landed on an entity detail page — every detail page exposes
        // the entity-hero block.
        await expect(page.locator('.cdx-entity-hero')).toBeVisible();
    });

    test('entity heroes emit Pagefind-discoverable meta spans (kind, category, description)', async ({
        page
    }) => {
        // Pagefind reads `data-pagefind-meta="key:value"` (literal form) and
        // `data-pagefind-meta="key"` (inner-text form). The per-key attribute
        // form (`data-pagefind-meta-X="value"`) looks plausible but is NOT
        // discovered by Pagefind's static scan — kept as a regression guard
        // against accidentally reintroducing the broken form.
        await page.goto(pageUrl('provider', 'provideUserFeature'));
        await page.waitForLoadState('domcontentloaded');
        const hero = page.locator('.cdx-entity-hero').first();
        await expect(hero.locator('span[data-pagefind-meta="kind:Function"]')).toHaveCount(1);
        await expect(hero.locator('span[data-pagefind-meta="category:Providers"]')).toHaveCount(1);
        // Description uses inner-text form so commas / colons in JSDoc
        // survive Pagefind's attribute parser.
        const description = hero.locator('span[data-pagefind-meta="description"]');
        await expect(description).toHaveCount(1);
        expect((await description.innerText()).trim().length).toBeGreaterThan(0);

        // Primary-kind component — same contract, different kind label.
        await page.goto(pageUrl('component', 'DashboardComponent'));
        await page.waitForLoadState('domcontentloaded');
        const componentHero = page.locator('.cdx-entity-hero').first();
        await expect(
            componentHero.locator('span[data-pagefind-meta="kind:Component"]')
        ).toHaveCount(1);
    });

    test('the references portal links providers and function guards to their own pages', async ({
        page
    }) => {
        // standalone-app fixture: provideUserFeature is a provider without a
        // feature type (providers/), roleGuard a function-declared guard
        // (guards/).
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');

        const tagged = page.locator(
            `.cdx-ref-item-link[href*="${pageOf('provider', 'provideUserFeature')}"]`
        );
        await expect(tagged).toHaveCount(1);

        const anchor = page.locator(`.cdx-ref-item-link[href*="${pageOf('guard', 'roleGuard')}"]`);
        await expect(anchor).toHaveCount(1);

        // The dedicated detail page must actually exist and render the entity name.
        const detailUrl = await tagged.getAttribute('href');
        await page.goto(detailUrl as string);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('h1.cdx-entity-hero-name')).toContainText('provideUserFeature');
    });

    test('hero breadcrumb mirrors the sidebar bucket path in feature layout', async ({ page }) => {
        // Tagged misc symbol — breadcrumb from @category.
        await page.goto(pageUrl('provider', 'provideUserFeature'));
        await page.waitForLoadState('domcontentloaded');
        const taggedCrumbs = page.locator('.cdx-breadcrumb li').allInnerTexts();
        await expect(page.locator('.cdx-breadcrumb li').first()).toHaveText('Providers');
        await expect(page.locator('.cdx-breadcrumb li').last()).toHaveText('provideUserFeature');
        const labels = await taggedCrumbs;
        expect(labels.some(t => t === 'Miscellaneous' || t === 'Functions')).toBe(false);

        // Untagged component — folder-fallback derived path.
        await page.goto(pageUrl('component', 'DashboardComponent'));
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.cdx-breadcrumb li').first()).toHaveText('dashboard');
    });

    test('a function guard has its own page', async ({ page }) => {
        await page.goto(pageUrl('guard', 'roleGuard'));
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('h1.cdx-entity-hero-name')).toContainText('roleGuard');
    });

    test('sidebar bucket label navigates to the auto-generated landing page', async ({ page }) => {
        // Whole-row toggle contract: the row itself is the toggle
        // (role="button"); the inner `<a data-cdx-bucket-link>` navigates
        // to `categories/<bucket>.html`. The client handler short-circuits
        // when the click target sits inside the anchor, so navigation
        // wins over toggle without `stopPropagation()`.
        const features = page.locator('#features-links');
        const labels = features.locator('a.cdx-bucket-link[data-cdx-bucket-link]');
        await expect(labels.first()).toBeAttached();
        const href = await labels.first().getAttribute('href');
        // The SPA router may prefix sidebar links with `./` at runtime;
        // accept either form so the test is depth-resilient.
        expect(href).toMatch(/^(?:\.\/)?categories\/[^"]+\.html$/);

        // Navigate directly (the bucket may be collapsed in the sidebar).
        await page.goto(href!);
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.cdx-entity-hero')).toBeVisible();
        await expect(page.locator('.cdx-bucket-landing-content')).toBeVisible();
    });

    test('clicking the bucket row outside the link toggles expand/collapse', async ({ page }) => {
        // The row is `role="button"` + `data-cdx-toggle="collapse"`, and
        // its chevron sits at the far end of the flex layout — clicking
        // the chevron (which is OUTSIDE `data-cdx-bucket-link`) must
        // toggle the row without navigating away.
        const startUrl = page.url();
        const row = page.locator('#features-links .cdx-bucket-row').first();
        await expect(row).toBeVisible();
        const initial = await row.getAttribute('aria-expanded');
        await row.locator('.cdx-bucket-chevron').click();
        // After click, aria-expanded must flip and the URL must not change.
        await expect(row).toHaveAttribute('aria-expanded', initial === 'true' ? 'false' : 'true');
        expect(page.url()).toBe(startUrl);
    });

    test('clicking the bucket link navigates without toggling the row', async ({ page }) => {
        // Inverse of the above: clicking the inner anchor must navigate
        // to the bucket landing page, not toggle the row. The client
        // handler short-circuits on `[data-cdx-bucket-link]` so the
        // anchor's native click runs unaltered. SPA router intercepts
        // internal anchors and pushes state via fetch + history API
        // (no full page reload), so the URL settles async — wait for
        // it explicitly rather than `waitForLoadState`.
        const link = page.locator('#features-links .cdx-bucket-link').first();
        const href = await link.getAttribute('href');
        const target = href!.replace(/^\.\//, '');
        await link.click();
        await page.waitForURL(url => url.pathname.endsWith(target));
        expect(page.url()).toContain(target);
        await expect(page.locator('.cdx-bucket-landing-content')).toBeVisible();
    });

    test('bucket landing page groups members by kind into card lists', async ({ page }) => {
        // admin-settings bundles a service + multiple components — every
        // landing page emits an "Organisms" section for components/etc.
        // and a "References" section for interfaces/functions/types.
        await page.goto(bucketUrl(['features', 'admin-settings']));
        await page.waitForLoadState('domcontentloaded');
        // Buckets may render one or two card lists (Organisms / References),
        // depending on which kinds the bucket holds. At least one must exist.
        expect(await page.locator('.cdx-bucket-card-list').count()).toBeGreaterThan(0);
        const cards = page.locator('.cdx-bucket-card');
        expect(await cards.count()).toBeGreaterThan(0);
        // Cards link out to per-kind detail pages and carry a kind chip.
        const firstCard = cards.first();
        await expect(firstCard.locator('.cdx-badge')).toBeAttached();
        await expect(firstCard.locator('.cdx-bucket-card-name')).toBeAttached();
        const linkHref = await firstCard.locator('a.cdx-bucket-card-link').getAttribute('href');
        expect(linkHref).toMatch(
            /(?:components|directives|pipes|injectables|classes|guards|interceptors|entities|interfaces|miscellaneous)\/[A-Za-z0-9_-]+\.html$/
        );
    });

    test('intermediate bucket landings aggregate items from every descendant leaf', async ({
        page
    }) => {
        // `users` is an intermediate folder containing `users/components`.
        // Its landing page should list every descendant entity, not zero.
        await page.goto(bucketUrl(['users']));
        await page.waitForLoadState('domcontentloaded');
        const cards = page.locator('.cdx-bucket-card');
        expect(await cards.count()).toBeGreaterThan(0);
    });

    test('entity hero exposes data-pagefind-filter attributes for the facet UI', async ({
        page
    }) => {
        // Filter attrs are emitted as one hidden span per dimension next to
        // the meta block on every entity hero. They drive the command-palette
        // facet rail (kind / lib / bucket / tier / wcag). Pagefind 1.x only
        // recognises the canonical `data-pagefind-filter="dim:value"` form,
        // so each dimension gets its own span.
        await page.goto(pageUrl('component', 'DashboardComponent'));
        await page.waitForLoadState('domcontentloaded');
        const filterSpans = page
            .locator('.cdx-entity-hero')
            .first()
            .locator('span[data-pagefind-filter]');
        // At minimum: kind + tier (every entity has a docsKind classification).
        // Lib + bucket may or may not be present depending on whether the
        // entity sits in a categorised folder.
        const count = await filterSpans.count();
        expect(count).toBeGreaterThanOrEqual(2);
        const attrs = await filterSpans.evaluateAll(els =>
            els.map(el => el.getAttribute('data-pagefind-filter'))
        );
        expect(attrs).toContain('kind:Component');
        expect(attrs.some(a => a?.startsWith('tier:'))).toBe(true);
    });

    test('WCAG chip renders when @wcag tag is present; @a11y is not surfaced visually', async ({
        page
    }) => {
        // The standalone fixture's LoadingSpinnerComponent declares
        // `@wcag AA` + `@a11y ...`. The chip lands in the entity-hero
        // badge row as the single visual accessibility-conformance signal.
        // The `@a11y` note text is preserved in the data model for the
        // LLM-md export but is intentionally NOT rendered on the page —
        // the hero chip already carries the user-visible signal and the
        // section was competing with the description.
        await page.goto(pageUrl('component', 'LoadingSpinnerComponent'));
        await page.waitForLoadState('domcontentloaded');
        const chip = page.locator('.cdx-entity-hero .cdx-badge--wcag-aa');
        await expect(chip).toHaveCount(1);
        await expect(chip).toContainText('WCAG AA');
        await expect(chip).toHaveAttribute('data-cdx-wcag', 'AA');

        // Regression guard: no Accessibility section above the description.
        await expect(page.locator('.cdx-a11y-note')).toHaveCount(0);
    });

    test('cdx-chip[href] has hover + focus affordance', async ({ page }) => {
        // Any rendered chip with an href should have cursor:pointer per the v0.6.0 affordance.
        await page.goto(pageUrl('provider', 'provideUserFeature'));
        await page.waitForLoadState('domcontentloaded');
        // The "Providers" category chip in the entity hero is a static badge
        // (no href). Look for a chip that IS a link — chips appearing in
        // MetadataChipsRow on entity pages, for example. We test the CSS rule
        // by injecting a link-chip and asserting the computed cursor.
        const cursor = await page.evaluate(() => {
            const anchor = document.createElement('a');
            anchor.className = 'cdx-chip cdx-chip--component';
            anchor.href = '#';
            anchor.textContent = 'TestChip';
            document.body.appendChild(anchor);
            const cs = getComputedStyle(anchor);
            const value = cs.cursor;
            anchor.remove();
            return value;
        });
        expect(cursor).toBe('pointer');
    });

    test('Token kind: portal chip rail surfaces a Token facet with count > 0', async ({ page }) => {
        // InjectionToken / HttpContextToken consts now live under the
        // dedicated `token` kind. The references portal's chip rail
        // emits one chip per present kind — so a fixture with tokens
        // produces a Token chip with a non-zero count.
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        const tokenChip = page.locator('[data-cdx-ref-kind-chip="token"]');
        await expect(tokenChip).toHaveCount(1);
        const count = await tokenChip.locator('.cdx-ref-kind-chip-count').textContent();
        expect(Number(count?.trim() ?? '0')).toBeGreaterThan(0);
    });

    test('Token kind: clicking Token chip leaves token rows visible, hides others', async ({
        page
    }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        // Deselect every non-token kind via the chip rail.
        const chips = await page.locator('[data-cdx-ref-kind-chip]').all();
        for (const chip of chips) {
            const k = await chip.getAttribute('data-cdx-ref-kind-chip');
            if (k !== 'token') {
                await chip.click();
            }
        }
        const visibleKinds = await page
            .locator('.cdx-ref-item:not([data-cdx-ref-hidden])')
            .evaluateAll(els => els.map(el => el.getAttribute('data-cdx-kind')));
        expect(visibleKinds.length).toBeGreaterThan(0);
        expect(visibleKinds.every(k => k === 'token')).toBe(true);
    });

    test('Token kind: token row links to tokens/<name>.html (not injectables/)', async ({
        page
    }) => {
        await page.goto('/references.html');
        await page.waitForLoadState('domcontentloaded');
        const tokenRow = page
            .locator('.cdx-ref-item[data-cdx-kind="token"] .cdx-ref-item-link')
            .first();
        const href = await tokenRow.getAttribute('href');
        expect(href).toMatch(/^(?:\.\/)?tokens\/[A-Z][A-Z0-9_]*\.html$/);
    });

    test('Token detail page: hero badge + type + providedIn sections', async ({ page }) => {
        await page.goto(pageUrl('token', 'API_BASE_URL'));
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('.cdx-entity-hero-badges .cdx-badge--entity-token')).toHaveCount(
            1
        );
        // The lean TokenPage emits content sections (NOT the legacy
        // entity-page metadata table). Type section renders the
        // `InjectionToken<...>` signature; Provided in renders the
        // captured `providedIn` literal.
        const sectionText = (await page.locator('.cdx-content-section').allTextContents()).join(
            '\n'
        );
        expect(sectionText).toContain('InjectionToken');
        expect(sectionText).toContain("'root'");
    });
});
