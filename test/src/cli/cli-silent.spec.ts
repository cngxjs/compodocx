import { exec, hasStderrError, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI silent flag', () => {
    const distFolder = `${tmp.name}-silent`;
    let stdoutString = '';

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/sample-files/tsconfig.simple.json',
            '-d',
            distFolder,
            '--silent'
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
    });
    afterAll(() => tmp.clean(distFolder));

    it('should display simple message', () => {
        expect(stdoutString).to.contain('compodocx v');
        expect(stdoutString).not.to.contain('TypeScript version used by compodocx');
    });
});

describe('CLI with missing additional-doc directory', () => {
    let exitCode: number | null = null;
    let stdoutString = '';

    const distFolder = `${tmp.name}-missing-additional-doc`;

    beforeAll(() => {
        tmp.create(distFolder);
        return new Promise<void>(resolve => {
            const ls = exec(
                'node' +
                    [
                        '',
                        './bin/index-cli.js',
                        '--no-multiVersion',
                        '-p',
                        './test/fixtures/sample-files/tsconfig.simple.json',
                        '-d',
                        distFolder,
                        '--silent',
                        '--includes',
                        './test/fixtures/todomvc-ng2/additional-doc-wrong'
                    ].join(' '),
                (_error, stdout) => {
                    stdoutString = stdout;
                }
            );
            ls.on('close', code => {
                exitCode = code;
                resolve();
            });
        });
    });
    afterAll(() => tmp.clean(distFolder));

    it('should exit cleanly and skip the missing summary.json without error', () => {
        expect(exitCode).to.equal(0);
        expect(stdoutString).not.to.contain('Error during Additional documentation generation');
    });
});
