import * as path from 'node:path';
import { exists, fs, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();
const fixture = './test/fixtures/additional-identity';
const pages = 'additional-documentation';

const generate = (distFolder: string, includes: string, extra: string[] = []) => {
    tmp.create(distFolder);
    const run = shell(
        'node',
        [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/todomvc-ng2/src/tsconfig.json',
            '-d',
            distFolder,
            '--disableSearch',
            '--includes',
            includes,
            ...extra
        ],
        { encoding: 'utf8' }
    );
    if (run.status !== 0 || hasStderrError(run.stderr)) {
        console.error(`shell error: ${run.stderr}`);
        throw new Error(`build failed: ${distFolder} (exit ${run.status})`);
    }
    return run;
};

const exportOf = (distFolder: string) => JSON.parse(read(`${distFolder}/documentation.json`));

const slugsOf = (list: { slug: string; children?: unknown[] }[]) =>
    list.map(page => [
        page.slug,
        ...(page.children ?? []).map(child => (child as typeof page).slug)
    ]);

const writeIncludes = (dir: string, summary: unknown, files: readonly string[]) => {
    fs.mkdirpSync(dir);
    fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(summary));
    for (const file of files) {
        fs.writeFileSync(`${dir}/${file}`, `# ${file}\n`);
    }
};

/** The `<li>` of the sidebar group whose list has the id `id`. */
const groupEntryOf = (menu: string, id: string): string => {
    const start = menu.lastIndexOf('<li', menu.indexOf(`aria-controls="${id}"`));
    return menu.slice(start, menu.indexOf('</ul></li>', start));
};

describe('CLI Additional documentation - paths, missing files and groups', () => {
    const labels = path.resolve(`${fixture}/labels.json`);
    const absoluteHtml = `${tmp.name}-additional-paths-abs-html`;
    const absoluteJson = `${tmp.name}-additional-paths-abs-json`;
    const missingSrc = `${tmp.name}-additional-paths-missing-src`;
    const missingDist = `${tmp.name}-additional-paths-missing`;
    const firstSrc = `${tmp.name}-additional-paths-first-src`;
    const firstDist = `${tmp.name}-additional-paths-first`;
    const afterSrc = `${tmp.name}-additional-paths-after-src`;
    const afterDist = `${tmp.name}-additional-paths-after`;
    const afterJson = `${tmp.name}-additional-paths-after-json`;
    let missingRun: ReturnType<typeof generate>;

    beforeAll(() => {
        const absolute = path.resolve(`${fixture}/en`);
        generate(absoluteHtml, absolute, ['--includesLabels', labels]);
        generate(absoluteJson, absolute, ['--includesLabels', labels, '--exportFormat', 'json']);

        writeIncludes(
            missingSrc,
            [
                { title: 'A', file: 'a.md', aliases: ['old-a'] },
                { title: 'Gone', file: 'gone.md', aliases: ['old-gone'] },
                { title: 'C', file: 'c.md' }
            ],
            ['a.md', 'c.md']
        );
        missingRun = generate(missingDist, missingSrc);

        writeIncludes(
            firstSrc,
            [{ title: 'Group', children: [{ title: 'A', file: 'a.md' }] }],
            ['a.md']
        );
        generate(firstDist, firstSrc);

        writeIncludes(
            afterSrc,
            [
                { title: 'First', file: 'first.md' },
                { title: 'Group', children: [{ title: 'B', file: 'b.md' }] }
            ],
            ['first.md', 'b.md']
        );
        generate(afterDist, afterSrc);
        generate(afterJson, afterSrc, ['--exportFormat', 'json']);
    }, 300_000);

    afterAll(() => {
        for (const folder of [
            absoluteHtml,
            absoluteJson,
            missingSrc,
            missingDist,
            firstSrc,
            firstDist,
            afterSrc,
            afterDist,
            afterJson
        ]) {
            tmp.clean(folder);
        }
    });

    it('reads the pages of an absolute --includes folder', () => {
        expect(exists(`${absoluteHtml}/${pages}/errors.html`)).to.equal(true);
        expect(exists(`${absoluteHtml}/${pages}/errors/e0003.html`)).to.equal(true);
        expect(exists(`${absoluteHtml}/${pages}/guides/getting-started.html`)).to.equal(true);
        expect(slugsOf(exportOf(absoluteJson).additionalPages)).to.deep.equal([
            ['errors', 'errors/e0001', 'errors/e0002', 'errors/e0003', 'errors/e0004'],
            ['guides', 'guides/getting-started']
        ]);
    });

    it('skips a page whose file is missing with a warning and keeps its siblings', () => {
        expect(missingRun.stdout).to.contain(
            'Additional pages: summary.json[1] (gone.md) not found, page skipped'
        );
        expect(exists(`${missingDist}/${pages}/a.html`)).to.equal(true);
        expect(exists(`${missingDist}/${pages}/c.html`)).to.equal(true);
        expect(exists(`${missingDist}/${pages}/gone.html`)).to.equal(false);
        expect(exists(`${missingDist}/${pages}/old-gone.html`)).to.equal(false);
        expect(exists(`${missingDist}/${pages}/old-a.html`)).to.equal(true);
        const menu = menuOf(missingDist);
        expect(menu).to.contain(`href="${pages}/a.html"`);
        expect(menu).to.not.contain('gone.html');
    });

    it('shows a first node without a file as a sidebar group with its page', () => {
        const menu = menuOf(firstDist);
        const group = groupEntryOf(menu, 'additional-group-group');
        expect(group).to.match(
            /^<li class="chapter inner cdx-additional-group"><button class="simple menu-toggler"/
        );
        expect(group).to.contain('aria-expanded="false"');
        expect(group).to.contain('<span class="link-name">Group</span>');
        expect(group).to.contain(`href="${pages}/group/a.html"`);
        expect(exists(`${firstDist}/${pages}/group/a.html`)).to.equal(true);
        expect(exists(`${firstDist}/${pages}/group.html`)).to.equal(false);
    });

    it('keeps the pages of a group after a page out of that page', () => {
        const menu = menuOf(afterDist);
        const group = groupEntryOf(menu, 'additional-group-group');
        expect(group).to.contain(`href="${pages}/group/b.html"`);
        expect(menu).to.contain(
            `<li class="link"><a href="${pages}/first.html" data-type="entity-link" data-context-id="additional">First</a></li>`
        );
        expect(menu.indexOf(`${pages}/first.html`)).to.be.lessThan(
            menu.indexOf('additional-group-group')
        );
        expect(slugsOf(exportOf(afterJson).additionalPages)).to.deep.equal([
            ['first'],
            ['group/b']
        ]);
    });
});
