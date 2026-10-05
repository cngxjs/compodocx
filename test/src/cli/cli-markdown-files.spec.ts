import * as fs from 'node:fs';
import * as path from 'node:path';
import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI Markdown files generation', () => {
    const distFolder = `${tmp.name}-markdown-files`;
    const fixtureFolder = `${tmp.name}-markdown-fixture`;

    describe('when CHANGELOG, CONTRIBUTING, and LICENSE markdown files exist', () => {
        let stdoutString;
        let menuFile;

        beforeAll(() => {
            // Create fixture folder with markdown files
            tmp.create(fixtureFolder);
            tmp.create(distFolder);

            // Copy sample files for basic Angular app
            const srcFolder = path.join(fixtureFolder, 'src');
            fs.mkdirSync(srcFolder, { recursive: true });

            // Copy source file
            fs.copyFileSync(
                './test/fixtures/sample-files/app.config.ts',
                path.join(srcFolder, 'app.config.ts')
            );

            // Create a proper tsconfig.json
            const tsconfigContent = {
                compilerOptions: {
                    target: 'es5',
                    module: 'commonjs',
                    moduleResolution: 'node',
                    emitDecoratorMetadata: true,
                    experimentalDecorators: true,
                    sourceMap: true,
                    lib: ['es2015', 'dom']
                },
                include: ['src/**/*.ts'],
                exclude: ['node_modules']
            };
            fs.writeFileSync(
                path.join(fixtureFolder, 'tsconfig.json'),
                JSON.stringify(tsconfigContent, null, 2)
            );

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                path.join(fixtureFolder, 'tsconfig.json'),
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            stdoutString = ls.stdout.toString();
            menuFile = read(`${distFolder}/index.html`);
        });

        afterAll(() => {
            tmp.clean(distFolder);
            tmp.clean(fixtureFolder);
        });

        it('should display generated message', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should find and process CHANGELOG.md file', () => {
            expect(stdoutString).to.contain('CHANGELOG.md file found');
        });

        it('should find and process CONTRIBUTING.md file', () => {
            expect(stdoutString).to.contain('CONTRIBUTING.md file found');
        });

        it('should find and process LICENSE.md file', () => {
            expect(stdoutString).to.contain('LICENSE.md file found');
        });

        it('should generate changelog.html page', () => {
            const changelogExists = exists(`${distFolder}/changelog.html`);
            expect(changelogExists).to.be.true;
            const changelogContent = read(`${distFolder}/changelog.html`);
            // Note: reads from project root CHANGELOG.md, not fixture
            expect(changelogContent).to.contain('changelog');
        });

        it('should generate contributing.html page', () => {
            const contributingExists = exists(`${distFolder}/contributing.html`);
            expect(contributingExists).to.be.true;
            const contributingContent = read(`${distFolder}/contributing.html`);
            expect(contributingContent).to.contain('Contributing');
        });

        it('should generate license.html page', () => {
            const licenseExists = exists(`${distFolder}/license.html`);
            expect(licenseExists).to.be.true;
            const licenseContent = read(`${distFolder}/license.html`);
            expect(licenseContent).to.contain('License');
        });

        it('should include CHANGELOG link in menu', () => {
            expect(menuFile).to.contain('changelog.html');
            expect(menuFile).to.contain('CHANGELOG');
        });

        it('should include CONTRIBUTING link in menu', () => {
            expect(menuFile).to.contain('contributing.html');
            expect(menuFile).to.contain('CONTRIBUTING');
        });

        it('should include LICENSE link in menu', () => {
            expect(menuFile).to.contain('license.html');
            expect(menuFile).to.contain('LICENSE');
        });
    });

    describe('regression test for markdown menu entries', () => {
        let menuFile;

        beforeAll(() => {
            tmp.create(`${distFolder}-regression`);

            // Run compodoc - it will find project's markdown files from root
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '-d',
                `${distFolder}-regression`
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            menuFile = read(`${distFolder}-regression/index.html`);
        });

        afterAll(() => tmp.clean(`${distFolder}-regression`));

        it('should populate markdowns array when markdown files are found', () => {
            // REGRESSION TEST: This verifies that Configuration.mainData.markdowns.push()
            // is properly called for each markdown file (lines 367-372 in application.ts)
            // The bug was that this code was removed, causing markdown files to not
            // appear in the navigation menu. This test ensures they are present.
            expect(menuFile).to.contain('changelog.html');
            expect(menuFile).to.contain('contributing.html');
            expect(menuFile).to.contain('license.html');
        });
    });
});
