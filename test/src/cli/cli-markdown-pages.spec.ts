import * as fs from 'node:fs';
import * as path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { exists, hasStderrError, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();

/**
 * `disableMarkdownPages` skips root Markdown files (read from the working
 * directory, here the repo's CHANGELOG.md, CONTRIBUTING.md and LICENSE): no
 * page, no sidebar link, nothing in the search index. The pages not listed
 * are still built.
 */
const generate = (distFolder: string, extra: string[]): string => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        './test/fixtures/sample-files/tsconfig.simple.json',
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

/** Text of every Pagefind fragment (gzipped JSON with the page URL). */
const indexedText = (distFolder: string): string => {
    const folder = path.join(distFolder, 'pagefind', 'fragment');
    return fs
        .readdirSync(folder)
        .map(file => gunzipSync(fs.readFileSync(path.join(folder, file))).toString('utf8'))
        .join('\n');
};

describe('CLI disableMarkdownPages', () => {
    describe('from the CLI, with search', () => {
        const distFolder = `${tmp.name}-markdown-pages`;
        let menu: string;
        let index: string;

        beforeAll(() => {
            generate(distFolder, ['--disableMarkdownPages', 'changelog,license']);
            menu = menuOf(distFolder);
            index = indexedText(distFolder);
        });
        afterAll(() => tmp.clean(distFolder));

        it('writes no page for the listed files', () => {
            expect(exists(`${distFolder}/changelog.html`)).to.be.false;
            expect(exists(`${distFolder}/license.html`)).to.be.false;
            expect(exists(`${distFolder}/contributing.html`)).to.be.true;
        });

        it('links no listed page from the sidebar', () => {
            expect(menu).not.to.contain('changelog.html');
            expect(menu).not.to.contain('license.html');
            expect(menu).to.contain('contributing.html');
        });

        it('puts no listed page into the search index', () => {
            expect(index).not.to.contain('changelog.html');
            expect(index).not.to.contain('license.html');
            expect(index).to.contain('contributing.html');
        });
    });

    describe('from the config file', () => {
        const distFolder = `${tmp.name}-markdown-pages-config`;
        const configFolder = `${tmp.name}-markdown-pages-rc`;
        let stdout: string;

        beforeAll(() => {
            tmp.create(configFolder);
            const config = path.join(configFolder, '.compodocxrc.json');
            fs.writeFileSync(
                config,
                JSON.stringify({ disableMarkdownPages: ['contributing', 'readme'] })
            );
            stdout = generate(distFolder, ['-c', config, '--disableSearch']);
        });
        afterAll(() => {
            tmp.clean(distFolder);
            tmp.clean(configFolder);
        });

        it('skips the listed page and keeps the others', () => {
            expect(exists(`${distFolder}/contributing.html`)).to.be.false;
            expect(exists(`${distFolder}/changelog.html`)).to.be.true;
            expect(exists(`${distFolder}/index.html`)).to.be.true;
        });

        it('warns about an entry it does not know', () => {
            expect(stdout).to.contain('disableMarkdownPages: unknown page "readme" ignored');
        });
    });
});
