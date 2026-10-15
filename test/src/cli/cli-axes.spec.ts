import { shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
const FIXTURE = './test/fixtures/axes-library';
const FILE = 'test/fixtures/axes-library/projects/kit/src';

const stripAnsi = (text: string): string => text.replaceAll(/\x1b\[[0-9;]*m/g, '');

describe('CLI classification axes', () => {
    const jsonFolder = `${tmp.name}-axes-json`;
    let status: number | null;
    let stdout: string;

    beforeAll(() => {
        tmp.create(jsonFolder);
        const run = shell('node', [
            './bin/index-cli.js',
            '-c',
            `${FIXTURE}/.compodocxrc.json`,
            '-p',
            `${FIXTURE}/tsconfig.json`,
            '-e',
            'json',
            '-d',
            jsonFolder
        ]);
        status = run.status;
        stdout = stripAnsi(run.stdout.toString() + run.stderr.toString());
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
    });

    it('exits 0 and logs one summary line for the declared axes', () => {
        expect(status).to.equal(0);
        expect(stdout).to.contain(
            'Axes: stability 5/5 classified, level 2/4 classified (2 unclassified)'
        );
    });

    it('warns once about a tag value the axis does not declare', () => {
        expect(stdout).to.contain(
            `Axes: @axis stability "beta" is not a declared value (1: ${FILE}/badge/badge.ts#AxkBadge)`
        );
        expect(stdout.match(/Axes: @axis/g)).to.have.length(1);
    });
});
