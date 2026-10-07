import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { hrefTo } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI Unit Test Report', () => {
    const tmpFolder = `${tmp.name}-unit-test`;
    const distFolder = `${tmpFolder}/documentation`;

    describe('full path in JSON', () => {
        let stdoutString, unitTestFile;
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/todomvc-ng2/', tmpFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './src/tsconfig.json',
                    '--unitTestCoverage',
                    './coverage-summary.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            unitTestFile = read(`${distFolder}/unit-test.html`);
        });

        afterAll(() => tmp.clean(tmpFolder));

        it('should have unit test page', () => {
            expect(unitTestFile).to.contain('Unit test coverage');
            // Per-file count shifted from a single "statements" fraction
            // (legacy `(22/26)`) to an aggregate of all four metrics
            // (lines + statements + functions + branches) inside
            // `cdx-coverage-count-detail`. todo.model.ts: 18+22+6+2 / 22+26+10+2 = 48/60.
            expect(unitTestFile).to.contain('cdx-coverage-count-detail">(48/60)');
        });

        it('should have per-metric stats instead of badge images', () => {
            // Legacy `<img src="./images/coverage-badge-{kind}.svg">`
            // images replaced by a per-metric stat block; assert the
            // four metric labels and one of the covered/total fractions
            // (statements: 256/336, branches: 8/17, functions: 40/104,
            // lines: 217/293).
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Statements');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Branches');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Functions');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Lines');
            expect(unitTestFile).to.contain('cdx-coverage-stat-sub">256/336');
        });

        it('should have full file path links', () => {
            // Entity link now uses the entity name as link text; the
            // file path is rendered separately in a `<td>` and its
            // `title` attribute preserves the JSON input format.
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AppComponent', 0)}">AppComponent</a>`
            );
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AboutComponent', 0)}">AboutComponent</a>`
            );
            expect(unitTestFile).to.contain(
                'title="test/fixtures/todomvc-ng2/src/app/app.component.ts"'
            );
            expect(unitTestFile).to.contain(
                'title="test/fixtures/todomvc-ng2/src/app/about/about.component.ts"'
            );
        });
    });

    describe('partial path in JSON', () => {
        let stdoutString, unitTestFile;
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/todomvc-ng2/', tmpFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './src/tsconfig.json',
                    '--unitTestCoverage',
                    './coverage-summary-alt.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            unitTestFile = read(`${distFolder}/unit-test.html`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should have unit test page', () => {
            expect(unitTestFile).to.contain('Unit test coverage');
            expect(unitTestFile).to.contain('cdx-coverage-count-detail">(48/60)');
        });

        it('should have per-metric stats instead of badge images', () => {
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Statements');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Branches');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Functions');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Lines');
            expect(unitTestFile).to.contain('cdx-coverage-stat-sub">256/336');
        });

        it('should have partial file path links', () => {
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AppComponent', 0)}">AppComponent</a>`
            );
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AboutComponent', 0)}">AboutComponent</a>`
            );
            // Partial path JSON keeps the trimmed `src/app/...` form
            // verbatim in the `title` attribute.
            expect(unitTestFile).to.contain('title="src/app/app.component.ts"');
            expect(unitTestFile).to.contain('title="src/app/about/about.component.ts"');
        });
    });

    describe('Windows style path in JSON', () => {
        let stdoutString, unitTestFile;
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/todomvc-ng2/', tmpFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './src/tsconfig.json',
                    '--unitTestCoverage',
                    './coverage-summary-win.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            unitTestFile = read(`${distFolder}/unit-test.html`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should have unit test page', () => {
            expect(unitTestFile).to.contain('Unit test coverage');
            expect(unitTestFile).to.contain('cdx-coverage-count-detail">(48/60)');
        });

        it('should have per-metric stats instead of badge images', () => {
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Statements');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Branches');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Functions');
            expect(unitTestFile).to.contain('cdx-coverage-stat-label">Lines');
            expect(unitTestFile).to.contain('cdx-coverage-stat-sub">256/336');
        });

        it('should have partial file path links', () => {
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AppComponent', 0)}">AppComponent</a>`
            );
            expect(unitTestFile).to.contain(
                `<a href="${hrefTo('component', 'AboutComponent', 0)}">AboutComponent</a>`
            );
            // Windows-style backslash paths from the input JSON are
            // preserved verbatim in the `title` attribute (display text
            // in the `<td>` is normalised to forward-slash, but the
            // tooltip exposes the raw input format).
            expect(unitTestFile).to.contain('title="src\\app\\app.component.ts"');
            expect(unitTestFile).to.contain('title="src\\app\\about\\about.component.ts"');
            // Display text is forward-slash regardless of input format.
            expect(unitTestFile).to.contain('>src/app/app.component.ts</td>');
            expect(unitTestFile).to.contain('>src/app/about/about.component.ts</td>');
        });
    });
});
