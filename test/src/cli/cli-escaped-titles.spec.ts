import { fs, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();
const dist = `${tmp.name}-escaped-titles`;
const includes = './test/fixtures/escaped-titles/en';
const hostileName = `A</title><h1>BREAK</h1> & "Q" 'S'`;
const escapedName = 'A&lt;/title>&lt;h1>BREAK&lt;/h1> &amp; &#34;Q&#34; &#39;S&#39;';

const htmlFiles = (dir: string): string[] =>
    fs.readdirSync(dir).flatMap((entry: string) => {
        const path = `${dir}/${entry}`;
        return fs.statSync(path).isDirectory() ? htmlFiles(path) : [path];
    });

const titleOf = (file: string): string => /<title>(.*?)<\/title>/s.exec(read(file))?.[1] ?? '';

describe('CLI escaped page titles', () => {
    beforeAll(() => {
        tmp.create(dist);
        const run = shell(
            'node',
            [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                dist,
                '-n',
                hostileName,
                '--includes',
                includes,
                '--disableSearch'
            ],
            { encoding: 'utf8' }
        );
        if (run.status !== 0 || hasStderrError(run.stderr)) {
            console.error(`shell error: ${run.stderr}`);
            throw new Error('build failed');
        }
    }, 300_000);

    afterAll(() => tmp.clean(dist));

    it('escapes the documentation name in the title of every page', () => {
        const files = htmlFiles(dist).filter(file => file.endsWith('.html'));
        expect(files.length).toBeGreaterThan(10);
        for (const file of files) {
            expect(read(file), file).not.toContain('</title><h1>');
        }
        expect(titleOf(`${dist}/index.html`)).toContain(escapedName);
    });

    it('escapes the title of an additional page', () => {
        const title = titleOf(`${dist}/additional-documentation/guide.html`);
        expect(title).toContain('Guide &lt;b>X&lt;/b> &amp; &#34;Q&#34; &#39;S&#39;');
        expect(title).not.toContain('<b>');
    });

    it('escapes the additional page label in the menu', () => {
        const menu = menuOf(dist);
        expect(menu).not.toContain('<i>1</i>');
        expect(menu).toContain('Lab &lt;i>1&lt;/i> &amp; &#34;2&#34; &#39;3&#39;');
    });
});
