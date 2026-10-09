import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI coverage report', () => {
    const distFolder = `${tmp.name}-coverage`;

    describe('excluding coverage', () => {
        const stdoutString = undefined;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--disableCoverage',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should not have coverage page', () => {
            const isFileExists = exists(`${distFolder}/coverage.html`);
            expect(isFileExists).to.be.false;
        });
    });

    describe('coverage test command above', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageTest',
                '10',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold', () => {
            expect(stdoutString).to.contain('is over threshold');
        });
    });

    describe('coverage test command above with src folder provided in arguments', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                './test/fixtures/sample-files/',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageTest',
                '10',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold', () => {
            expect(stdoutString).to.contain('is over threshold');
        });
    });

    describe('coverage test command under', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageTest',
                '40',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should not be over threshold', () => {
            expect(stdoutString).to.contain('is not over threshold');
        });
    });

    describe('coverage test per file command under', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '1',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be under threshold per file', () => {
            expect(stdoutString).to.contain(
                'Documentation coverage per file is not over threshold'
            );
        });
    });

    describe('coverage test per file command under with --coverageTestShowOnlyFailed', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '1',
                '--coverageTestShowOnlyFailed',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be under threshold per file', () => {
            expect(stdoutString).to.contain('under minimum per file');
            expect(stdoutString).to.not.contain('over minimum per file');
        });
    });

    describe('coverage test per file command over', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '0',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold per file', () => {
            expect(stdoutString).to.contain('Documentation coverage per file is over threshold');
        });
    });

    describe('coverage test per file command over and global threshold - 1/4', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '30',
                '--coverageTest',
                '70',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold per file', () => {
            expect(stdoutString).to.contain(
                'Documentation coverage per file is not over threshold'
            );
        });
        it('it should not be over threshold', () => {
            expect(stdoutString).to.contain(') is not over threshold');
        });
    });

    describe('coverage test per file command over and global threshold - 2/4', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '50',
                '--coverageTest',
                '10',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be not over threshold per file', () => {
            expect(stdoutString).to.contain(
                'Documentation coverage per file is not over threshold'
            );
        });
        it('it should be over threshold', () => {
            expect(stdoutString).to.contain(') is over threshold');
        });
    });

    describe('coverage test per file command over and global threshold - 3/4', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '0',
                '--coverageTest',
                '10',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold per file', () => {
            expect(stdoutString).to.contain('Documentation coverage per file is over threshold');
        });
        it('it should be over threshold', () => {
            expect(stdoutString).to.contain(') is over threshold');
        });
    });

    describe('coverage test per file command over and global threshold - 4/4', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--coverageMinimumPerFile',
                '0',
                '--coverageTest',
                '40',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be over threshold per file', () => {
            expect(stdoutString).to.contain('Documentation coverage per file is over threshold');
        });
        it('it should not be over threshold', () => {
            expect(stdoutString).to.contain(') is not over threshold');
        });
    });

    describe('coverage page', () => {
        let stdoutString, coverageFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            coverageFile = read(`${distFolder}/coverage.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should have coverage page - title', () => {
            expect(coverageFile).to.contain('Documentation coverage');
        });
        it('it should have coverage page - badge', () => {
            // Coverage badge is now an inline SVG donut (`cdx-coverage-donut`)
            // with a percentage in `aria-label`, not an external image.
            expect(coverageFile).to.contain('class="cdx-coverage-donut"');
            expect(coverageFile).to.contain('aria-label="Documentation coverage:');
        });
        it('it should have coverage page - score', () => {
            expect(coverageFile).to.contain('17/17');
        });
    });

    describe('coverage page links', () => {
        let stdoutString, coverageFile;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            coverageFile = read(`${distFolder}/coverage.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should have links in coverage page', () => {
            // Entity-type column is now rendered as `cdx-badge--entity-…`
            // chips instead of bare `<td>class</td>` cells.
            expect(coverageFile).to.contain('cdx-badge--entity-class');
            expect(coverageFile).to.contain('cdx-badge--entity-component');
            expect(coverageFile).to.contain('cdx-badge--entity-directive');
            expect(coverageFile).to.contain('cdx-badge--entity-function');
            expect(coverageFile).to.contain('cdx-badge--entity-guard');
            expect(coverageFile).to.contain('cdx-badge--entity-injectable');
            expect(coverageFile).to.contain('cdx-badge--entity-interceptor');
            expect(coverageFile).to.contain('cdx-badge--entity-interface');
            expect(coverageFile).to.contain('cdx-badge--entity-pipe');
            expect(coverageFile).to.contain('cdx-badge--entity-variable');

            expect(coverageFile).to.contain(`${pageOf('component', 'CompodocComponent')}`);
            expect(coverageFile).to.contain(`${pageOf('interface', 'ClockInterface')}`);
            expect(coverageFile).to.contain(`${pageOf('function', 'foo')}`);
            expect(coverageFile).to.contain(`${pageOf('typealias', 'ChartChange')}`);
            expect(coverageFile).to.contain(`${pageOf('variable', 'PI')}`);
            expect(coverageFile).to.contain(`${pageOf('pipe', 'FirstUpperPipe')}`);
            expect(coverageFile).to.contain(`${pageOf('directive', 'DoNothingDirective2')}`);
            expect(coverageFile).to.contain(`${pageOf('injectable', 'TodoStore2')}`);
            expect(coverageFile).to.contain(`${pageOf('class', 'Todo2')}`);
            expect(coverageFile).to.contain(`${pageOf('guard', 'AuthGuard')}`);
            expect(coverageFile).to.contain(`${pageOf('interceptor', 'NoopInterceptor')}`);
        });
    });

    describe('coverage test per file command under with one file through --files', () => {
        let stdoutString;
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '--files',
                './test/fixtures/sample-files/bar.directive.ts',
                '--files',
                './test/fixtures/sample-files/bar.service.ts',
                '--coverageMinimumPerFile',
                '1',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should be under threshold for files', () => {
            expect(stdoutString).to.contain(
                'test/fixtures/sample-files/bar.directive.ts - BarDirective - under minimum per file'
            );
            expect(stdoutString).to.contain(
                'test/fixtures/sample-files/bar.service.ts - BarService - under minimum per file'
            );
        });
    });
});
