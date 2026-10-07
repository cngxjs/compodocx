import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

const BIN = path.resolve('./bin/index-cli.js');

describe('CLI simple flags', () => {
    const distFolder = `${tmp.name}-simple-flags`;

    describe('when no tsconfig.json provided', () => {
        let command;
        beforeEach(() => {
            command = shell('node', ['./bin/index-cli.js']);
        });

        it('should display error message', () => {
            expect(command.stdout.toString()).to.contain(
                'tsconfig.json file was not found, please use -p flag'
            );
        });

        it(`should not create a "documentation" directory`, () => {
            const isFolderExists = exists(`${tmp.name}/documentation`);
            expect(isFolderExists).to.be.false;
        });
    });

    describe('when no tsconfig.json provided with just -p', () => {
        let command;
        beforeEach(() => {
            command = shell('node', ['./bin/index-cli.js', '--no-multiVersion', '-p']);
        });

        it('should display error message', () => {
            expect(command.stdout.toString()).to.contain('Please provide a tsconfig file.');
        });
    });

    describe('when no tsconfig.json is found in cwd', () => {
        let command;
        beforeEach(() => {
            command = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test.json'
            ]);
        });

        it('should display error message', () => {
            expect(command.stdout.toString()).to.contain(
                'file was not found in the current directory'
            );
        });

        it(`should not create a "documentation" directory`, () => {
            const isFolderExists = exists(`${tmp.name}/documentation`);
            expect(isFolderExists).to.be.false;
        });
    });

    describe('when just serving without generation', () => {
        // The CLI defaults `-d` to `./documentation/`, resolved against
        // `process.cwd()`. When this spec runs in parallel with
        // cli-serving.spec.ts (which creates `./documentation/` at the repo
        // root), the default-folder error path becomes non-deterministic.
        // Spawn the child in a fresh tmpdir so the default folder is
        // guaranteed not to exist regardless of what other spec files do.
        let command;
        let cwd: string;
        beforeEach(() => {
            cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-cli-serve-noop-'));
            command = shell('node', [BIN, '--no-multiVersion', '-s'], { cwd });
        });
        afterEach(() => {
            if (cwd && fs.existsSync(cwd)) {
                fs.rmSync(cwd, { recursive: true, force: true });
            }
        });

        it('should display error message', () => {
            expect(command.stdout.toString()).to.contain('./documentation/ folder doesn');
        });
    });

    /*describe("when just serving without generation and folder which does't exist", () => {
        let command = undefined;
        beforeEach(() => {
            command = shell('node', ['./bin/index-cli.js', '--no-multiVersion', '-s', '-d', 'doc']);
        });

        it('should display error message', () => {
            expect(command.stdout.toString()).to.contain("folder doesn't exist");
        });
    });*/

    describe('when no README/package.json files available', () => {
        let command;

        beforeEach(() => {
            tmp.create(distFolder);
            tmp.copy('./test/fixtures/sample-files/', distFolder);
            command = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    'tsconfig.simple.json',
                    '-d',
                    distFolder
                ],
                { cwd: distFolder }
            );
        });
        afterEach(() => tmp.clean(distFolder));

        it('should display error message', () => {
            const output: string = command.stdout.toString();

            expect(
                output.indexOf('Continuing without README.md file') > -1,
                'No error displayed for README'
            ).to.be.true;
            expect(
                output.indexOf('Continuing without package.json file') > -1,
                'No error displayed for package.json'
            ).to.be.true;
        });
    });

    describe('showing the output type', () => {
        let componentFile;
        beforeAll(() => {
            tmp.create(distFolder);
            tmp.copy('./test/fixtures/sample-files/', distFolder);
            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    'tsconfig.entry.json',
                    '-d',
                    'documentation'
                ],
                { cwd: distFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            componentFile = read(
                `${distFolder}/documentation/${pageOf('component', 'FooComponent')}`
            );
        });
        afterAll(() => tmp.clean(distFolder));

        it('should show the event output type', () => {
            // Strip HTML tags since Shiki highlights source code with spans
            const stripped = componentFile.replace(/<[^>]+>/g, '');
            expect(stripped).to.contain('foo: string');
        });
    });
});
