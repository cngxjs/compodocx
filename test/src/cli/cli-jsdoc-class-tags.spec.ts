import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

/**
 * Regression test for the bug where class-level JSDoc tags (`@example`,
 * `@see`, `@since`, `@category`, …) on a Component or Directive were
 * silently dropped from the generated docs because both dep-factories
 * used the legacy `IO.jsdoctags[0].tags` accessor instead of the flat
 * `IO.jsdoctags` array that `markedtags()` actually returns.
 *
 * The fixture mirrors the cngx-style multi-entry-point library layout
 * (`libs/<name>/<feature>/src/...`). `ApiStatusComponent` carries class-
 * level `@example`, `@since`, and `@category` tags; the generated
 * `${pageOf('component', 'ApiStatusComponent')}` MUST surface all three. Pre-fix
 * the page rendered without an Examples section at all.
 *
 * Runs without `--publicApiOnly` so we don't depend on the library's
 * pre-built `dist/` matching the new `api-status.component.ts` source.
 */
describe('CLI class-level JSDoc tags on library Components', () => {
    const distFolder = `${tmp.name}-class-jsdoc-lib`;
    let apiStatusFile: string;
    let stdout: string;

    beforeAll(() => {
        tmp.create(distFolder);

        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/library/libs/my-lib/tsconfig.lib.json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }

        stdout = ls.stdout.toString();
        apiStatusFile = read(`${distFolder}/${pageOf('component', 'ApiStatusComponent')}`);
    });

    it('lists the ignored @category tag in the build notice', () => {
        expect(stdout).to.contain('@category / @docsKind tag');
        expect(stdout).to.match(/libs\/my-lib\/core\/src\/api-status\.component\.ts:18 @category/);
    });

    afterAll(() => tmp.clean(distFolder));

    it('renders the ApiStatusComponent page', () => {
        expect(exists(`${distFolder}/${pageOf('component', 'ApiStatusComponent')}`)).to.be.true;
    });

    it('renders an Examples section on the Info tab from the class-level @example', () => {
        expect(apiStatusFile).to.match(/cdx-section-heading[^>]*>\s*[Ee]xamples?\s*</);
    });

    it('renders the @example body as a code-fence snippet', () => {
        expect(apiStatusFile).to.contain('cdx-code-example');
        expect(apiStatusFile).to.contain('my-lib-api-status');
        expect(apiStatusFile).to.contain('/api/health');
    });

    it('exposes the class-level @since tag in the page', () => {
        expect(apiStatusFile).to.contain('0.0.5');
    });

    // ─── <example-url> → Example navTab ───────────────────────────
    // ApiStatusComponent also carries a `<example-url>` JSDoc HTML tag
    // (the iframe-preview mechanism, separate from the `@example` JSDoc
    // tag tested above).

    it('renders the Example navTab when <example-url> is set on the class', () => {
        // A tab panel with id="example" only exists when exampleUrls is
        // non-empty (gated in application.ts).
        expect(apiStatusFile).to.match(/<div[^>]+id="example"[^>]*role="tabpanel"/);
    });

    it('renders an iframe pointing at the <example-url> target', () => {
        expect(apiStatusFile).to.contain(
            '<iframe class="cdx-example-container" src="http://localhost:4200/#/common/a11y/focus-trap"'
        );
    });
});
