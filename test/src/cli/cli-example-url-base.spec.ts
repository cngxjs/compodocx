import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

/**
 * Relative `<example-url>` tags of the cngx-library fixture
 * (`/demo/#/ui/feedback/async-container` on `CngxAsyncSkeletonTpl`) are
 * appended to `exampleUrlBase`; without a base the build warns once.
 */
const generate = (distFolder: string, extra: string[]): string => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '--disableSearch',
        '-p',
        './test/fixtures/cngx-library/tsconfig.json',
        '-d',
        distFolder,
        ...extra
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return ls.stdout.toString();
};

const RESOLVED = 'https://cngx.example/app/demo/#/ui/feedback/async-container';

describe('CLI exampleUrlBase', () => {
    describe('from the CLI', () => {
        const distFolder = `${tmp.name}-example-base`;
        let stdout: string;
        let page: string;

        beforeAll(() => {
            stdout = generate(distFolder, ['--exampleUrlBase', 'https://cngx.example/app/']);
            page = read(
                `${distFolder}/${pagesIn(distFolder).of('directive', 'CngxAsyncSkeletonTpl')}`
            );
        });
        afterAll(() => tmp.clean(distFolder));

        it('loads the example from the base', () => {
            expect(page).to.contain(`src="${RESOLVED}"`);
        });

        it('does not warn about relative URLs', () => {
            expect(stdout).not.to.contain('no exampleUrlBase is set');
        });
    });

    describe('from the config file, in the JSON export', () => {
        const distFolder = `${tmp.name}-example-base-json`;
        const configFolder = `${tmp.name}-example-base-rc`;
        let urls: string[];

        beforeAll(() => {
            tmp.create(configFolder);
            const config = path.join(configFolder, '.compodocxrc.json');
            fs.writeFileSync(
                config,
                JSON.stringify({ exampleUrlBase: 'https://cngx.example/app' })
            );
            generate(distFolder, ['-c', config, '-e', 'json']);
            const data = JSON.parse(read(`${distFolder}/documentation.json`, 'utf8'));
            urls = data.directives.find((d: any) => d.name === 'CngxAsyncSkeletonTpl').exampleUrls;
        });
        afterAll(() => {
            tmp.clean(distFolder);
            tmp.clean(configFolder);
        });

        it('writes the resolved URL', () => {
            expect(urls).to.deep.equal([RESOLVED]);
        });
    });

    describe('without a base', () => {
        const distFolder = `${tmp.name}-example-nobase`;
        let stdout: string;
        let page: string;

        beforeAll(() => {
            stdout = generate(distFolder, []);
            page = read(
                `${distFolder}/${pagesIn(distFolder).of('directive', 'CngxAsyncSkeletonTpl')}`
            );
        });
        afterAll(() => tmp.clean(distFolder));

        it('keeps the URL as written', () => {
            expect(page).to.contain('src="/demo/#/ui/feedback/async-container"');
        });

        it('lists the relative URLs in one warning', () => {
            expect(stdout).to.match(
                /\d+ example URLs? (is|are) relative and no exampleUrlBase is set/
            );
            expect(stdout).to.contain('CngxAsyncSkeletonTpl: /demo/#/ui/feedback/async-container');
        });
    });
});
