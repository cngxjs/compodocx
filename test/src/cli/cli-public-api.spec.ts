import path from 'node:path';
import fs from 'fs-extra';

import { exists, hasStderrError, shell, temporaryDir } from '../helpers';
import { hasKindPages, readKindPages } from './paths';

const tmp = temporaryDir();

describe('CLI public-api-only option', () => {
    // Prepare the fixture library - check if dist already exists, if not build it
    beforeAll(() => {
        const fixtureDir = './test/fixtures/library';
        const distDir = './test/fixtures/library/dist/libs/my-lib';

        const distExists = fs.existsSync(distDir);
        const coreIndexExists = fs.existsSync(path.join(distDir, 'core/index.d.ts'));
        const dataIndexExists = fs.existsSync(path.join(distDir, 'data/index.d.ts'));

        // If dist already exists with proper structure, skip build
        if (distExists && coreIndexExists && dataIndexExists) {
            console.log('Fixture dist already built, skipping build step');
            return;
        }

        try {
            // First ensure npm dependencies are installed
            console.log('Installing npm dependencies...');
            const npmInstallResult = shell('npm', ['install', '--prefer-offline', '--no-audit'], {
                cwd: fixtureDir
            });
            if (npmInstallResult.status !== 0) {
                console.error(`NPM install stderr: ${npmInstallResult.stderr.toString()}`);
                console.error(`NPM install stdout: ${npmInstallResult.stdout.toString()}`);
                throw new Error('NPM install failed');
            }

            // Build the library
            console.log('Building library...');
            const buildResult = shell('npm', ['run', 'build'], { cwd: fixtureDir });
            if (buildResult.status !== 0) {
                console.error(`Build stderr: ${buildResult.stderr.toString()}`);
                console.error(`Build stdout: ${buildResult.stdout.toString()}`);
                throw new Error('Build failed');
            }

            // Extract API
            console.log('Extracting API...');
            const extractResult = shell('npm', ['run', 'extract-api'], { cwd: fixtureDir });
            if (extractResult.status !== 0) {
                console.error(`Extract API stderr: ${extractResult.stderr.toString()}`);
                console.error(`Extract API stdout: ${extractResult.stdout.toString()}`);
                throw new Error('Extract API failed');
            }

            console.log('Fixture build completed successfully');
        } catch (error) {
            console.error(`Fixture build error: ${error}`);
            throw error;
        }
    });

    describe('without --publicApi flag', () => {
        let stdoutString;
        const distFolder = 'test-public-api-without-flag';

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
            }
            stdoutString = ls.stdout.toString();
        });

        afterAll(() => {
            tmp.clean(distFolder);
        });

        it('should generate documentation', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(distFolder);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isCoverageExists = exists(`${distFolder}/coverage.html`);
            expect(isCoverageExists).to.be.true;
        });

        it('gives getDefaultApiRoot no page: no entry point reaches it', () => {
            expect(readKindPages(distFolder, 'function')).not.to.contain('getDefaultApiRoot');
        });

        it('lists both getDefaultApiRoot copies in the build log', () => {
            expect(stdoutString).to.contain('reach no entry point and are not documented:');
            expect(stdoutString).to.match(/libs\/my-lib\/core\/src\/utils[^\n]*getDefaultApiRoot/);
            expect(stdoutString).to.match(/libs\/my-lib\/data\/src\/utils[^\n]*getDefaultApiRoot/);
        });
    });

    describe('with --publicApiOnly flag', () => {
        let stdoutString;
        const distFolder = 'test-public-api-with-flag';

        beforeAll(() => {
            tmp.create(distFolder);

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/library/libs/my-lib/tsconfig.lib.json',
                '-d',
                distFolder,
                '--publicApiOnly',
                './test/fixtures/library/dist/libs/my-lib'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
            }
            stdoutString = ls.stdout.toString();
        });

        afterAll(() => {
            tmp.clean(distFolder);
        });

        it('should generate documentation', () => {
            expect(stdoutString).to.contain('Documentation generated');
        });

        it('should have generated main folder', () => {
            const isFolderExists = exists(distFolder);
            expect(isFolderExists).to.be.true;
        });

        it('should have generated main pages', () => {
            const isIndexExists = exists(`${distFolder}/index.html`);
            expect(isIndexExists).to.be.true;
            const isCoverageExists = exists(`${distFolder}/coverage.html`);
            expect(isCoverageExists).to.be.true;
        });

        it('should NOT document getDefaultApiRoot when using public API filter', () => {
            // When --publicApiOnly is set, the miscellaneous/functions.html file may not exist
            // because getDefaultApiRoot is the only function and it's not exported from public API
            const functionsFileExists = hasKindPages(distFolder, 'function');

            if (functionsFileExists) {
                // If the file exists, it should not contain getDefaultApiRoot
                const functionsFile = readKindPages(distFolder, 'function');
                expect(functionsFile).to.not.contain('getDefaultApiRoot');
            } else {
                // If the file doesn't exist, that's also correct (no public functions to document)
                expect(functionsFileExists).to.be.false;
            }
        });

        it('should NOT document variables not in public API', () => {
            // When --publicApiOnly is set, variables like API_ROOT and DATA_CONFIG should not be documented
            // because they are not exported in the *.api.md or index.d.ts files
            const variablesFileExists = hasKindPages(distFolder, 'variable');

            if (variablesFileExists) {
                // If the file exists, it should not contain the non-exported variables
                const variablesFile = readKindPages(distFolder, 'variable');
                expect(variablesFile).to.not.contain('API_ROOT');
                expect(variablesFile).to.not.contain('DATA_CONFIG');
            } else {
                // If the file doesn't exist, that's also correct (no public variables to document)
                expect(variablesFileExists).to.be.false;
            }
        });
    });
});
