import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    testDir: './test/playwright',
    /* Run tests in files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,
    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,
    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: process.env.CI ? 'github' : 'line',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:4000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        colorScheme: 'dark'
    },

    /* Configure projects for major browsers */
    projects: [
        // chromium and Microsoft Edge are intentionally not listed — both run
        // the Chromium engine (identical results to `chrome`) and would only
        // duplicate work for a static-HTML doc generator. Add back here if a
        // Chromium-channel-specific regression ever needs reproducing.
        {
            name: 'chrome',
            use: { ...devices['Desktop Chrome'], channel: 'chrome' },
            testIgnore: ['**/empty-states.spec.ts', '**/standalone-features.spec.ts', '**/entity-hero.spec.ts', '**/content-sections.spec.ts', '**/coverage-report.spec.ts', '**/utilities-index.spec.ts', '**/overview-dashboard.spec.ts', '**/source-viewer.spec.ts', '**/tab-routing.spec.ts', '**/theming-tab.spec.ts', '**/version-switcher.spec.ts', '**/playground-tab.spec.ts', '**/additional-pages.spec.ts', '**/menu-layout.spec.ts', '**/di-chapter.spec.ts', '**/features.spec.ts'],
        },

        // firefox + webkit run on a nightly cron (.github/workflows/e2e-cross-browser.yml),
        // not on every push. Cross-engine bugs in static-HTML output are rare;
        // keeping them out of the per-push matrix saves ~6 minutes per CI run.
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            testIgnore: ['**/empty-states.spec.ts', '**/standalone-features.spec.ts', '**/entity-hero.spec.ts', '**/content-sections.spec.ts', '**/coverage-report.spec.ts', '**/utilities-index.spec.ts', '**/overview-dashboard.spec.ts', '**/source-viewer.spec.ts', '**/tab-routing.spec.ts', '**/theming-tab.spec.ts', '**/version-switcher.spec.ts', '**/playground-tab.spec.ts', '**/additional-pages.spec.ts', '**/menu-layout.spec.ts', '**/di-chapter.spec.ts'],
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testIgnore: ['**/empty-states.spec.ts', '**/standalone-features.spec.ts', '**/entity-hero.spec.ts', '**/content-sections.spec.ts', '**/coverage-report.spec.ts', '**/utilities-index.spec.ts', '**/overview-dashboard.spec.ts', '**/source-viewer.spec.ts', '**/tab-routing.spec.ts', '**/theming-tab.spec.ts', '**/version-switcher.spec.ts', '**/playground-tab.spec.ts', '**/additional-pages.spec.ts', '**/menu-layout.spec.ts', '**/di-chapter.spec.ts'],
        },

        /* todomvc-ng2 fixture tests (empty states, etc.) — uses port 4001 */
        {
            name: 'todomvc',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4001' },
            testMatch: ['**/empty-states.spec.ts', '**/entity-hero.spec.ts', '**/content-sections.spec.ts', '**/coverage-report.spec.ts', '**/utilities-index.spec.ts', '**/overview-dashboard.spec.ts'],
        },

        /* standalone-app fixture tests — uses port 4002. Single-version
         * build (`--no-multiVersion`); version-switcher specs run against
         * the multi-version fixture only. */
        {
            name: 'standalone',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4002' },
            testMatch: ['**/standalone-features.spec.ts', '**/source-viewer.spec.ts', '**/tab-routing.spec.ts', '**/theming-tab.spec.ts', '**/playground-tab.spec.ts', '**/additional-pages.spec.ts'],
        },

        /* multi-version fixture tests (version-switcher) — uses port 4003 */
        {
            name: 'multi-version',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4003' },
            testMatch: ['**/version-switcher.spec.ts'],
        },

        /* standalone-app fixture rebuilt with menuLayout: 'feature' — uses port 4004 */
        {
            name: 'standalone-feature',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4004' },
            testMatch: ['**/menu-layout.spec.ts', '**/features.spec.ts'],
        },

        /* semantic-library fixture with search (DI chapter, feature type pages), uses port 4005 */
        {
            name: 'semantic',
            use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4005' },
            testMatch: ['**/di-chapter.spec.ts', '**/features.spec.ts'],
        },
    ],

    /* Run local dev servers before starting the tests */
    webServer: [
        {
            command: 'npm run test:simple-doc',
            url: 'http://localhost:4000',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run test:todomvc-doc',
            url: 'http://localhost:4001',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run test:standalone-doc',
            url: 'http://localhost:4002',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run test:multi-version-doc',
            url: 'http://localhost:4003/v2.0.0/index.html',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run test:standalone-feature-doc',
            url: 'http://localhost:4004',
            reuseExistingServer: !process.env.CI,
        },
        {
            command: 'npm run test:semantic-doc',
            url: 'http://localhost:4005',
            reuseExistingServer: !process.env.CI,
        },
    ]
});
