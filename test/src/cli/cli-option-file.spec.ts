import * as os from 'node:os';

import { exists, fs, hasStderrError, path, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI option file', () => {
    let stdoutString;

    const distFolder = 'test-config-file'; // Match /test/fixtures/todomvc-ng2/.compodocrc

    beforeAll(() => {
        tmp.create(distFolder);

        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-c',
            './test/fixtures/todomvc-ng2/.compodocrc',
            '-p',
            './test/fixtures/todomvc-ng2/src/tsconfig.json'
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
    });
    afterAll(() => {
        tmp.clean(distFolder);
    });

    it('should display generated message', () => {
        expect(stdoutString).to.contain('Documentation generated');
    });

    it('should have generated main folder', () => {
        const isFolderExists = exists(distFolder);
        expect(isFolderExists).to.be.true;
    });

    it('should have generated main pages', () => {
        const isIndexExists = exists(`${distFolder}/index.html`);
        expect(isIndexExists).to.be.true;
        const isAppConfigExists = exists(`${distFolder}/app-config.html`);
        expect(isAppConfigExists).to.be.true;
        const isRoutesExists = exists(`${distFolder}/routes.html`);
        expect(isRoutesExists).to.be.true;
    });
});

describe('CLI option file discovery', () => {
    const repo = process.cwd();
    let cwd: string;
    let stdoutString: string;

    beforeAll(() => {
        cwd = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-rc-discovery-')));
        fs.writeFileSync(
            path.join(cwd, '.compodocxrc.json'),
            JSON.stringify({
                tsconfig: path.relative(
                    cwd,
                    path.join(repo, 'test/fixtures/sample-files/tsconfig.simple.json')
                ),
                output: 'docs',
                multiVersion: false,
                disableSearch: true
            })
        );
        const ls = shell('node', [path.join(repo, 'bin/index-cli.js')], { cwd });
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
    });
    afterAll(() => {
        fs.rmSync(cwd, { recursive: true, force: true });
    });

    it('should find .compodocxrc.json without -c', () => {
        expect(stdoutString).to.contain(
            `Using configuration file : ${path.join(cwd, '.compodocxrc.json')}`
        );
        expect(stdoutString).to.contain('Documentation generated');
        expect(fs.existsSync(path.join(cwd, 'docs/index.html'))).to.be.true;
    });
});
