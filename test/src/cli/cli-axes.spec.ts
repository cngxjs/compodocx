import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const FIXTURE = './test/fixtures/axes-library';
const FILE = 'test/fixtures/axes-library/projects/kit/src';

const stripAnsi = (text: string): string => text.replaceAll(/\x1b\[[0-9;]*m/g, '');

describe('CLI classification axes', () => {
    const jsonFolder = `${tmp.name}-axes-json`;
    const htmlFolder = `${tmp.name}-axes-html`;
    const pages = pagesIn(htmlFolder);
    const page = (kind: Parameters<typeof pages.of>[0], name: string) =>
        fs.readFileSync(path.join(htmlFolder, pages.of(kind, name)), 'utf8');
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
        tmp.create(htmlFolder);
        shell('node', [
            './bin/index-cli.js',
            '-c',
            `${FIXTURE}/.compodocxrc.json`,
            '-p',
            `${FIXTURE}/tsconfig.json`,
            '--disableSearch',
            '--no-multiVersion',
            '-d',
            htmlFolder
        ]);
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(htmlFolder);
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

    it('shows one badge and one search filter per axis value on symbol pages', () => {
        const button = page('component', 'AxkButton');
        expect(button).to.contain('data-cdx-axis="stability">Stability: stable</span>');
        expect(button).to.contain('data-cdx-axis="level">Level: molecule</span>');
        expect(button).to.contain('data-pagefind-filter="axis-stability:stable"');
        expect(button).to.contain('data-pagefind-filter="axis-level:molecule"');
    });

    it('takes the path rule, leaves an untagged directive without a level', () => {
        const sparkline = page('component', 'AxkSparkline');
        expect(sparkline).to.contain('Stability: experimental');
        expect(sparkline).not.to.contain('data-cdx-axis="level"');
        const badge = page('directive', 'AxkBadge');
        expect(badge).to.contain('Stability: stable');
    });

    it('does not apply a kind-limited axis to a function', () => {
        const format = page('function', 'formatSize');
        expect(format).to.contain('data-cdx-axis="stability"');
        expect(format).not.to.contain('data-cdx-axis="level"');
    });
});
