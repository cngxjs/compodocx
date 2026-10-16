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
    const llmFolder = `${tmp.name}-axes-llm`;
    let data: any;
    let markdown: string;
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
        data = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'documentation.json'), 'utf8'));
        tmp.create(llmFolder);
        shell('node', [
            './bin/index-cli.js',
            '-c',
            `${FIXTURE}/.compodocxrc.json`,
            '-p',
            `${FIXTURE}/tsconfig.json`,
            '-e',
            'llm-md',
            '-d',
            llmFolder
        ]);
        markdown = fs.readFileSync(path.join(llmFolder, 'llm-context.md'), 'utf8');
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
        tmp.clean(llmFolder);
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

    it('exports the axis values per symbol and the axes with their counts', () => {
        const button = data.components.find((c: any) => c.name === 'AxkButton');
        expect(button.axes).to.deep.equal({ stability: 'stable', level: 'molecule' });
        const sparkline = data.components.find((c: any) => c.name === 'AxkSparkline');
        expect(sparkline.axes).to.deep.equal({ stability: 'experimental' });
        expect(data.semantic.axes).to.deep.equal([
            {
                name: 'stability',
                label: 'Stability',
                values: [
                    { value: 'stable', count: 4 },
                    { value: 'experimental', count: 1 }
                ],
                classified: 5,
                unclassified: 0
            },
            {
                name: 'level',
                label: 'Level',
                values: [
                    { value: 'atom', count: 1 },
                    { value: 'molecule', count: 1 },
                    { value: 'organism', count: 0 }
                ],
                classified: 2,
                unclassified: 2
            }
        ]);
    });

    it('prints one Axes line per classified symbol in llm-md', () => {
        expect(markdown).to.contain('### AxkButton');
        expect(markdown).to.contain('Axes: stability=stable, level=molecule');
        expect(markdown).to.contain('format-size.ts`\n  Axes: stability=stable');
        expect(markdown.match(/^ *Axes: /gm)).to.have.length(5);
    });
});
