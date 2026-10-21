import { gunzipSync } from 'node:zlib';
import { exists, fs, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();
const fixture = './test/fixtures/additional-identity';
const pages = 'additional-documentation';

const generate = (distFolder: string, includes: string, extra: string[] = []) =>
    shell(
        'node',
        [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/todomvc-ng2/src/tsconfig.json',
            '-d',
            distFolder,
            '--includes',
            includes,
            ...extra
        ],
        { encoding: 'utf8' }
    );

const build = (distFolder: string, includes: string, extra: string[] = [], search = false) => {
    tmp.create(distFolder);
    const run = generate(distFolder, includes, [...(search ? [] : ['--disableSearch']), ...extra]);
    if (run.status !== 0 || hasStderrError(run.stderr.replaceAll(/.*Additional pages: .*/g, ''))) {
        console.error(`shell error: ${run.stderr}`);
        throw new Error(`build failed: ${distFolder}`);
    }
    return run;
};

const htmlFilesOf = (siteRoot: string): string[] => {
    const base = `${siteRoot}/${pages}`;
    const walk = (dir: string): string[] =>
        fs.readdirSync(`${base}/${dir}`.replace(/\/$/, '')).flatMap((entry: string) => {
            const relative = dir ? `${dir}/${entry}` : entry;
            return fs.statSync(`${base}/${relative}`).isDirectory() ? walk(relative) : [relative];
        });
    return walk('')
        .filter(file => file.endsWith('.html'))
        .sort();
};

const titleOf = (file: string): string => /<title>([^<]*)<\/title>/.exec(read(file))?.[1] ?? '';

const writeSummary = (dir: string, summary: unknown) => {
    fs.mkdirpSync(dir);
    fs.writeFileSync(`${dir}/summary.json`, JSON.stringify(summary));
    for (const name of ['page.md', 'a.md', 'b.md']) {
        fs.writeFileSync(`${dir}/${name}`, 'Page.\n');
    }
};

describe('CLI Additional documentation - stable page identity', () => {
    const labels = `${fixture}/labels.json`;
    const enDist = `${tmp.name}-identity-en`;
    const deDist = `${tmp.name}-identity-de`;
    let enMenu: string;
    let enOutput: string;

    beforeAll(() => {
        // English is built once with search on, so the Pagefind case can use it.
        const enRun = build(enDist, `${fixture}/en`, ['--includesLabels', labels], true);
        enOutput = `${enRun.stdout}${enRun.stderr}`;
        build(deDist, `${fixture}/de`);
        enMenu = menuOf(enDist);
    }, 300_000);

    afterAll(() => {
        for (const folder of [enDist, deDist]) {
            tmp.clean(folder);
        }
    });

    it('keeps the page files when title, label and parent title change (criterion 2)', () => {
        // de renames the errors parent, the child titles and labels; the slugs stay.
        const before = htmlFilesOf(enDist);
        expect(before).to.include('errors.html');
        expect(before).to.include('errors/e0002.html');
        expect(htmlFilesOf(deDist)).to.deep.equal(before);

        const germanMenu = menuOf(deDist);
        expect(germanMenu).to.contain('Fehlerreferenz');
        expect(germanMenu).to.not.contain('Error reference');
        expect(germanMenu).to.contain('E0002: Wert geaendert');
        expect(germanMenu).to.contain(`href="${pages}/errors/e0002.html"`);
        expect(titleOf(`${deDist}/${pages}/errors/e0002.html`)).to.contain('Wert geaendert');
    });

    it('keeps label, title and path independent (criterion 3)', () => {
        const file = `${enDist}/${pages}/errors/e0002.html`;
        expect(exists(file)).to.be.true;
        expect(enMenu).to.contain('E0002: node label');
        expect(enMenu).to.contain(`href="${pages}/errors/e0002.html"`);
        expect(titleOf(file)).to.contain('Value changed');
        expect(titleOf(file)).to.not.contain('E0002');
    });

    it('feeds label and title of several pages from the labels file (criterion 4)', () => {
        expect(enMenu).to.contain('E0001: Expression changed');
        expect(titleOf(`${enDist}/${pages}/errors/e0001.html`)).to.contain(
            'Expression changed after it was checked'
        );
        expect(enMenu).to.contain('E0003: from labels file');
        expect(enMenu).to.contain('E0004: from labels file');
        expect(titleOf(`${enDist}/${pages}/errors/e0004.html`)).to.contain(
            'Fourth error from labels file'
        );
        expect(titleOf(`${enDist}/${pages}/errors/e0003.html`)).to.contain('Renamed page');
        expect(read(`${enDist}/${pages}/errors/e0003.html`)).to.contain('<h1>Renamed page</h1>');
        expect(read(`${enDist}/${pages}/errors/e0002.html`)).to.not.contain('<h1>Value changed');
    });

    it('stops with exit code 1 on an invalid slug and names the node (criterion 5)', () => {
        const src = `${tmp.name}-identity-invalid-src`;
        const dist = `${tmp.name}-identity-invalid`;
        tmp.create(dist);
        try {
            writeSummary(src, [
                { title: 'Fine', slug: 'fine', file: 'page.md' },
                { title: 'Broken', slug: 'Bad Slug', file: 'page.md' }
            ]);
            const run = generate(dist, src, ['--disableSearch']);
            expect(run.status).to.equal(1);
            expect(run.stderr + run.stdout).to.contain('invalid slug "Bad Slug"');
            expect(run.stderr + run.stdout).to.contain('summary.json[1]');
        } finally {
            tmp.clean(src);
            tmp.clean(dist);
        }
    }, 120_000);

    it('stops with exit code 1 on a path collision and names both nodes (criterion 6)', () => {
        const src = `${tmp.name}-identity-collision-src`;
        const dist = `${tmp.name}-identity-collision`;
        tmp.create(dist);
        try {
            writeSummary(src, [
                { title: 'First', slug: 'same', file: 'a.md' },
                { title: 'Second', slug: 'same', file: 'b.md' }
            ]);
            const run = generate(dist, src, ['--disableSearch']);
            const output = run.stderr + run.stdout;
            expect(run.status).to.equal(1);
            expect(output).to.contain('same.html');
            expect(output).to.contain('summary.json[0]');
            expect(output).to.contain('summary.json[1]');
            expect(output).to.contain('a.md');
            expect(output).to.contain('b.md');
        } finally {
            tmp.clean(src);
            tmp.clean(dist);
        }
    }, 120_000);

    it('writes a stub that points to the page and keeps it out of the sidebar (criterion 7)', () => {
        const stub = read(`${enDist}/${pages}/errors/e0003-old-name.html`);
        const target = `../../${pages}/errors/e0003.html`;
        expect(stub).to.contain(`<link rel="canonical" href="${target}">`);
        expect(stub).to.contain(`<meta http-equiv="refresh" content="0; url=${target}">`);
        expect(exists(`${enDist}/${pages}/e0003.html`)).to.be.true;
        expect(enMenu).to.not.contain('e0003-old-name');
        expect(enMenu).to.not.contain(`${pages}/e0003.html`);
    });

    it('rewrites a hand link to an alias path to the page (criterion 8a)', () => {
        const page = read(`${enDist}/${pages}/guides/getting-started.html`);
        expect(page).to.contain(`href="../../${pages}/errors/e0003.html"`);
        expect(page).to.not.contain('e0003-old-name');
    });

    it('lists the alias in redirects.json (criterion 8b)', () => {
        const file = JSON.parse(read(`${enDist}/redirects.json`));
        expect(file.schemaVersion).to.equal(1);
        expect(file.redirects[`${pages}/errors/e0003-old-name.html`]).to.equal(
            `${pages}/errors/e0003.html`
        );
        expect(file.redirects[`${pages}/e0003.html`]).to.equal(`${pages}/errors/e0003.html`);
    });

    it('keeps the stubs out of the Pagefind index (criterion 8c)', ctx => {
        const fragments = `${enDist}/pagefind/fragment`;
        if (!exists(fragments)) {
            ctx.skip('Pagefind produced no fragment folder after a successful build');
            return;
        }
        const urls = fs
            .readdirSync(fragments)
            .map((name: string) => gunzipSync(fs.readFileSync(`${fragments}/${name}`)).toString())
            .map((text: string) => /"url":"([^"]*)"/.exec(text)?.[1] ?? '');
        expect(urls).to.include(`/${pages}/errors/e0003.html`);
        expect(urls.filter((url: string) => url.includes('e0003-old-name'))).to.deep.equal([]);
        expect(urls).to.not.include(`/${pages}/e0003.html`);
    });

    it('warns once per slugged child of a parent without a slug', () => {
        const warning =
            'Additional pages: summary.json[1].children[0] has a slug but its parent summary.json[1] has none; renaming the parent moves this page';
        expect(enOutput.split(warning).length - 1).to.equal(1);
    });

    it('lets the unslugged en guides group derive its folder', () => {
        const summary = JSON.parse(read(`${fixture}/en/summary.json`));
        expect(summary[1].slug).to.equal(undefined);
        expect(exists(`${enDist}/${pages}/guides/getting-started.html`)).to.be.true;
    });

    it('gives the same pages for two languages with the same slugs (criterion 9)', () => {
        // Without the explicit de slug "guides", the de pages would land under the translated folder name.
        const english = htmlFilesOf(enDist);
        expect(htmlFilesOf(deDist)).to.deep.equal(english);
        const germanMenu = menuOf(deDist);
        expect(germanMenu).to.contain('Fehlerreferenz');
        expect(germanMenu).to.contain('E0002: Wert geaendert');
        expect(germanMenu).to.contain(`href="${pages}/errors/e0002.html"`);
    });
});
