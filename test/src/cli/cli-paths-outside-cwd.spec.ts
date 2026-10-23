import * as os from 'node:os';
import * as path from 'node:path';
import { exists, fs, hasStderrError, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/** Runs the CLI from the repository root with `args`. */
const run = (args: string[]) =>
    shell('node', ['./bin/index-cli.js', '--no-multiVersion', '--disableSearch', ...args], {
        encoding: 'utf8'
    });

describe('CLI paths outside the current folder', () => {
    // A copy of a fixture outside the repository, so its tsconfig path is absolute
    // and does not start with the cwd.
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-outside-'));
    const project = path.join(outside, 'src');
    const tsconfigDist = `${tmp.name}-outside-tsconfig`;
    let tsconfigRun: ReturnType<typeof run>;

    beforeAll(() => {
        fs.copySync('./test/fixtures/standalone-app/src', project);
        tsconfigRun = run(['-p', path.join(project, 'tsconfig.json'), '-d', tsconfigDist]);
    });

    afterAll(() => {
        tmp.clean(tsconfigDist);
        fs.removeSync(outside);
    });

    it('reads an absolute tsconfig outside the current folder', () => {
        expect(tsconfigRun.status).to.equal(0);
        expect(hasStderrError(tsconfigRun.stderr)).to.equal(false);
        expect(tsconfigRun.stdout).to.include('Using tsconfig file');
        expect(tsconfigRun.stdout).to.include(path.join(path.basename(outside), 'src'));
        expect(exists(`${tsconfigDist}/index.html`)).to.equal(true);
    });
});
