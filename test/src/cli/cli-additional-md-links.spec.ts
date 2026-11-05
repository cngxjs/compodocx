import * as path from 'node:path';
import { pageLocation, pagePath } from '../../../src/app/links/layout';
import { exists, fs, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
const folder = 'additional-documentation';

const generate = (distFolder: string, includes: string) => {
    tmp.create(distFolder);
    const run = shell(
        'node',
        [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/kitchen-sink-standalone/tsconfig.json',
            '-d',
            distFolder,
            '--disableSearch',
            '--includes',
            includes
        ],
        { encoding: 'utf8' }
    );
    if (run.status !== 0 || hasStderrError(run.stderr)) {
        console.error(`shell error: ${run.stderr}`);
        throw new Error(`build failed: ${distFolder} (exit ${run.status})`);
    }
    return run;
};

/** Root-relative path of the additional page with these slugs. */
const additional = (...slugs: string[]): string =>
    pagePath(pageLocation({ type: 'additional', folder, slugs }));

/** The `href`s of the links in the content of a page whose text is `text`. */
const hrefsOf = (html: string, text: string): string[] =>
    [...html.matchAll(/<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
        .filter(([, , label]) => label.trim() === text)
        .map(([, href]) => href.replace(/&amp;/g, '&'));

/** Root-relative file an `href` on the page at `page` points at, anchor dropped. */
const targetOf = (page: string, href: string): string =>
    path.posix.normalize(path.posix.join(path.posix.dirname(page), href.split('#')[0]));

describe('CLI Additional documentation - links between Markdown pages', () => {
    const fixtureDist = `${tmp.name}-additional-md-links`;
    const ownSrc = `${tmp.name}-additional-md-links-src`;
    const ownDist = `${tmp.name}-additional-md-links-own`;
    let ownRun: ReturnType<typeof generate>;

    beforeAll(() => {
        generate(fixtureDist, './test/fixtures/kitchen-sink-standalone/additional-doc');

        fs.mkdirpSync(`${ownSrc}/sub`);
        fs.writeFileSync(
            `${ownSrc}/summary.json`,
            JSON.stringify([
                {
                    title: 'Start',
                    file: 'start.md'
                },
                { title: 'Moved', file: 'sub/moved.md', aliases: ['old-moved'] },
                { title: 'Lost', file: 'lost.md', children: [{ title: 'Kid', file: 'kid.md' }] }
            ])
        );
        fs.writeFileSync(
            `${ownSrc}/start.md`,
            [
                '# Start',
                '',
                '[Moved](./sub/moved.md#part)',
                '[Root](/sub/moved.md)',
                '[Lost](./lost.md)',
                '[Nowhere](./nowhere.md)',
                '[Web](https://example.com/x.md)',
                ''
            ].join('\n')
        );
        fs.writeFileSync(`${ownSrc}/sub/moved.md`, '# Moved\n\n[Back](../start.md)\n');
        fs.writeFileSync(`${ownSrc}/kid.md`, '# Kid\n');
        ownRun = generate(ownDist, ownSrc);
    });

    afterAll(() => {
        tmp.clean(fixtureDist);
        tmp.clean(ownSrc);
        tmp.clean(ownDist);
    });

    it.each([
        [['guides'], 'Signals &amp; Reactivity', ['guides', 'signals-&-reactivity']],
        [['guides'], 'Functional Providers', ['guides', 'functional-providers']],
        [
            ['guides'],
            'Migration from NgModules',
            ['guides', 'advanced', 'migration-from-ngmodules']
        ],
        [
            ['guides', 'advanced'],
            'Migration from NgModules',
            ['guides', 'advanced', 'migration-from-ngmodules']
        ]
    ])('links %j to the page of %s', (from, text, to) => {
        const page = additional(...from);
        const hrefs = hrefsOf(read(`${fixtureDist}/${page}`), text);
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
            expect(targetOf(page, href)).toBe(additional(...to));
        }
        expect(exists(`${fixtureDist}/${additional(...to)}`)).toBe(true);
    });

    it('leaves no .md link on the fixture pages', () => {
        for (const page of [additional('guides'), additional('guides', 'advanced')]) {
            expect(read(`${fixtureDist}/${page}`)).not.toMatch(/href="[^"]*\.md[#"]/);
        }
    });

    it('points at the current page of an aliased file, anchor kept', () => {
        const page = additional('start');
        const html = read(`${ownDist}/${page}`);
        const [moved] = hrefsOf(html, 'Moved');
        expect(targetOf(page, moved)).toBe(additional('moved'));
        expect(moved.endsWith('#part')).toBe(true);
        expect(targetOf(page, hrefsOf(html, 'Root')[0])).toBe(additional('moved'));
        const back = additional('moved');
        expect(targetOf(back, hrefsOf(read(`${ownDist}/${back}`), 'Back')[0])).toBe(page);
    });

    it('keeps links without a page and warns once per link', () => {
        const html = read(`${ownDist}/${additional('start')}`);
        expect(hrefsOf(html, 'Lost')).toEqual(['./lost.md']);
        expect(hrefsOf(html, 'Nowhere')).toEqual(['./nowhere.md']);
        expect(hrefsOf(html, 'Web')).toEqual(['https://example.com/x.md']);
        const start = path.relative(process.cwd(), `${ownSrc}/start.md`).replace(/\\/g, '/');
        for (const target of ['lost.md', 'nowhere.md']) {
            const file = path.relative(process.cwd(), `${ownSrc}/${target}`).replace(/\\/g, '/');
            const message = `${start}: link to ${file} has no additional page`;
            expect(ownRun.stdout.split(message).length - 1).toBe(1);
        }
        expect(ownRun.stdout).not.toContain('x.md has no additional page');
        expect(ownRun.status).toBe(0);
    });
});
