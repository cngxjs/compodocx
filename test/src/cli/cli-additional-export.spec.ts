import { fs, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
const fixture = './test/fixtures/additional-identity';

const generate = (distFolder: string, format: string, extra: string[] = []) => {
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
            '--exportFormat',
            format,
            ...extra
        ],
        { encoding: 'utf8' }
    );
    if (run.status !== 0 || hasStderrError(run.stderr.replaceAll(/.*Additional pages: .*/g, ''))) {
        console.error(`shell error: ${run.stderr}`);
        throw new Error(`build failed: ${distFolder}`);
    }
    return run;
};

const exportOf = (distFolder: string) => JSON.parse(read(`${distFolder}/documentation.json`));

const GUIDE = [
    '<!-- @aiGenerated -->',
    '# Guide',
    '',
    'Intro text.',
    '',
    '```sh',
    '# a shell comment',
    '```',
    '',
    '## Part',
    ''
].join('\n');

const writeIncludes = (dir: string) => {
    fs.mkdirpSync(dir);
    fs.writeFileSync(
        `${dir}/summary.json`,
        JSON.stringify([
            {
                title: 'Guide',
                slug: 'guide',
                file: 'guide.md',
                children: [{ title: 'Child page', slug: 'child', file: 'child.md' }]
            }
        ])
    );
    fs.writeFileSync(`${dir}/guide.md`, GUIDE);
    fs.writeFileSync(`${dir}/child.md`, '### Deep start\n\nChild text.\n');
};

describe('CLI Additional documentation - exports', () => {
    const labels = `${fixture}/labels.json`;
    const jsonDist = `${tmp.name}-additional-export-json`;
    const plainDist = `${tmp.name}-additional-export-plain`;
    const llmDist = `${tmp.name}-additional-export-llm`;
    const plainLlmDist = `${tmp.name}-additional-export-llm-plain`;
    const includes = `${tmp.name}-additional-export-src`;

    beforeAll(() => {
        writeIncludes(includes);
        generate(jsonDist, 'json', ['--includes', `${fixture}/en`, '--includesLabels', labels]);
        generate(plainDist, 'json');
        generate(llmDist, 'llm-md', ['--includes', includes, '--includesName', 'Handbook']);
        generate(plainLlmDist, 'llm-md');
    }, 300_000);

    afterAll(() => {
        for (const folder of [jsonDist, plainDist, llmDist, plainLlmDist, includes]) {
            tmp.clean(folder);
        }
    });

    it('writes the pages with slug, title, label, file and raw markdown to the JSON export', () => {
        const pages = exportOf(jsonDist).additionalPages;
        expect(pages.map((page: { slug: string }) => page.slug)).to.deep.equal([
            'errors',
            'guides'
        ]);
        const [errors, guides] = pages;
        expect(errors).to.deep.equal({
            ...errors,
            title: 'Error reference',
            file: 'errors/index.md',
            markdown: 'This page lists the error codes (en).\n'
        });
        expect(errors).to.not.have.property('label');
        expect(errors.children.map((child: { slug: string }) => child.slug)).to.deep.equal([
            'errors/e0001',
            'errors/e0002',
            'errors/e0003',
            'errors/e0004'
        ]);
        expect(errors.children[1]).to.deep.equal({
            slug: 'errors/e0002',
            title: 'Value changed',
            label: 'E0002: node label',
            file: 'errors/e0002.md',
            markdown: 'Details of the second error (en).\n'
        });
        // Links stay as written in the Markdown.
        expect(guides.children[0].markdown).to.contain('(../errors/e0003-old-name.html)');
    });

    it('writes no additionalPages key without --includes', () => {
        expect(exportOf(plainDist)).to.not.have.property('additionalPages');
    });

    it('adds the pages to llm-md under the includes name with demoted headings', () => {
        const markdown = read(`${llmDist}/llm-context.md`);
        expect(markdown).to.contain(
            [
                '## Handbook',
                '',
                '### Guide',
                '',
                '<!-- @aiGenerated -->',
                '#### Guide',
                '',
                'Intro text.',
                '',
                '```sh',
                '# a shell comment',
                '```',
                '',
                '##### Part',
                '',
                '### Child page',
                '',
                '#### Deep start'
            ].join('\n')
        );
    });

    it('writes no additional pages section to llm-md without --includes', () => {
        const markdown = read(`${plainLlmDist}/llm-context.md`);
        expect(markdown).to.not.contain('## Additional documentation');
        expect(markdown).to.not.contain('## Handbook');
    });

    it('does not compare the pages in compodocx diff', () => {
        const run = shell(
            'node',
            [
                './bin/index-cli.js',
                'diff',
                '--old',
                `${plainDist}/documentation.json`,
                '--new',
                `${jsonDist}/documentation.json`,
                '--json'
            ],
            { encoding: 'utf8' }
        );
        expect(run.status, run.stderr).to.equal(0);
        expect(run.stdout).to.not.contain('additional');
        expect(run.stdout).to.not.contain('Error reference');
    });
});
