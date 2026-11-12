import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { featurePage, pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

const SITE = 'https://docs.example.test/lib/';
const LABEL = 'v1.0.0';

/**
 * The site-links fixture links to its own docs site: the feature README of
 * `select` to the `button` feature page (present) and to a `gone` page
 * (missing), the `SiteSelect` JSDoc to the site root.
 */
const generate = (distFolder: string, extra: readonly string[]): string => {
    tmp.create(distFolder);
    const run = shell('node', [
        './bin/index-cli.js',
        '--disableSearch',
        '-p',
        './test/fixtures/site-links/tsconfig.json',
        '-d',
        distFolder,
        '--versionLabel',
        LABEL,
        ...extra
    ]);
    if (run.status !== 0 || hasStderrError(run.stderr.toString())) {
        console.error(`shell error: ${run.stderr.toString()}`);
        throw new Error(`build failed: ${distFolder} (exit ${run.status})`);
    }
    return run.stdout.toString();
};

const summaryLines = (stdout: string): string[] =>
    stdout.split('\n').filter(line => line.includes('Site links: '));

describe('CLI siteUrl', () => {
    describe('with a site URL', () => {
        const distFolder = `${tmp.name}-site-url`;
        let stdout: string;
        let feature: string;
        let symbol: string;

        beforeAll(() => {
            stdout = generate(distFolder, ['--siteUrl', 'https://docs.example.test/lib']);
            const root = `${distFolder}/${LABEL}`;
            feature = read(`${root}/${featurePage(['select'])}`);
            symbol = read(`${root}/${pagesIn(root).of('component', 'SiteSelect')}`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('points a link to a page of the build at that page in this version', () => {
            expect(feature).to.contain('href="../button/index.html"');
            expect(feature).not.to.contain(`href="${SITE}main/button/"`);
        });

        it('keeps a link to a page the build does not have absolute', () => {
            expect(feature).to.contain(`href="${SITE}main/gone/"`);
        });

        it('leaves a link to another site alone', () => {
            expect(feature).to.contain('href="https://docs.example.test/lib-other/main/button/"');
        });

        it('rewrites a site link in a JSDoc description', () => {
            expect(symbol).to.contain('href="../index.html"');
            expect(symbol).not.to.contain(`href="${SITE}"`);
        });

        it('warns once about the missing page', () => {
            expect(summaryLines(stdout)).toEqual([
                expect.stringContaining(
                    'Site links: 1 link to a page this build does not have (--verbose lists it)'
                )
            ]);
        });
    });

    describe('with --verbose', () => {
        const distFolder = `${tmp.name}-site-url-verbose`;
        let stdout: string;

        beforeAll(() => {
            stdout = generate(distFolder, ['--siteUrl', SITE, '--verbose']);
        });
        afterAll(() => tmp.clean(distFolder));

        it('lists the missing link with its page', () => {
            expect(stdout).to.contain(`${featurePage(['select'])}: ${SITE}main/gone/`);
        });
    });

    describe('without a site URL', () => {
        const distFolder = `${tmp.name}-site-url-off`;
        let stdout: string;
        let feature: string;

        beforeAll(() => {
            stdout = generate(distFolder, []);
            feature = read(`${distFolder}/${LABEL}/${featurePage(['select'])}`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('keeps the absolute links as written', () => {
            expect(feature).to.contain(`href="${SITE}main/button/"`);
            expect(feature).to.contain(`href="${SITE}main/gone/"`);
        });

        it('does not warn', () => {
            expect(summaryLines(stdout)).toEqual([]);
        });
    });
});
