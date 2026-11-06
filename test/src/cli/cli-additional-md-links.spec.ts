import * as path from 'node:path';
import { pageLocation, pagePath } from '../../../src/app/links/layout';
import { exists, fs, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const folder = 'additional-documentation';

const generate = (
    distFolder: string,
    includes: string,
    tsconfig = './test/fixtures/kitchen-sink-standalone/tsconfig.json',
    extra: readonly string[] = []
) => {
    tmp.create(distFolder);
    const run = shell(
        'node',
        [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            tsconfig,
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

/** A path as the build log shows it: relative to the cwd, posix separators. */
const shown = (file: string): string => path.relative(process.cwd(), file).replace(/\\/g, '/');

/** Lines of the build log that carry the collected `.md` link warning. */
const summaryLines = (stdout: string): string[] =>
    stdout.split('\n').filter(line => line.includes('Markdown links: '));

describe('CLI Additional documentation - links between Markdown pages', () => {
    const fixtureDist = `${tmp.name}-additional-md-links`;
    const ownSrc = `${tmp.name}-additional-md-links-src`;
    const ownDist = `${tmp.name}-additional-md-links-own`;
    const verboseDist = `${tmp.name}-additional-md-links-verbose`;
    let ownRun: ReturnType<typeof generate>;
    let verboseRun: ReturnType<typeof generate>;

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
        verboseRun = generate(verboseDist, ownSrc, undefined, ['--verbose']);
    });

    afterAll(() => {
        tmp.clean(fixtureDist);
        tmp.clean(ownSrc);
        tmp.clean(ownDist);
        tmp.clean(verboseDist);
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

    it('keeps links without a page and reports them in one warning', () => {
        const html = read(`${ownDist}/${additional('start')}`);
        expect(hrefsOf(html, 'Lost')).toEqual(['./lost.md']);
        expect(hrefsOf(html, 'Nowhere')).toEqual(['./nowhere.md']);
        expect(hrefsOf(html, 'Web')).toEqual(['https://example.com/x.md']);
        const [summary, ...more] = summaryLines(ownRun.stdout);
        expect(more).toEqual([]);
        expect(summary).toMatch(/Markdown links: \d+ links to \.md files without a page/);
        expect(summary).toContain('(--verbose lists them)');
        expect(ownRun.stdout).not.toContain(`${shown(`${ownSrc}/start.md`)}: `);
        expect(ownRun.status).toBe(0);
    });

    it('lists the links without a page with --verbose, each once', () => {
        const start = shown(`${ownSrc}/start.md`);
        for (const target of ['lost.md', 'nowhere.md']) {
            const line = `  ${start}: ${shown(`${ownSrc}/${target}`)}`;
            expect(verboseRun.stdout.split(`${line}\n`).length - 1).toBe(1);
        }
        expect(verboseRun.stdout).not.toContain('x.md\n');
        expect(summaryLines(verboseRun.stdout)).toHaveLength(1);
    });
});

describe('CLI Additional documentation - .md links on symbol pages', () => {
    const project = `${tmp.name}-symbol-md-links-src`;
    const dist = `${tmp.name}-symbol-md-links`;
    const pages = pagesIn(dist);
    let run: ReturnType<typeof generate>;

    beforeAll(() => {
        fs.mkdirpSync(`${project}/src/app/features/billing`);
        fs.mkdirpSync(`${project}/docs`);
        fs.writeFileSync(
            `${project}/tsconfig.json`,
            JSON.stringify({
                compilerOptions: {
                    target: 'ES2022',
                    module: 'ES2022',
                    moduleResolution: 'bundler',
                    experimentalDecorators: true,
                    strict: true
                },
                include: ['src/**/*.ts']
            })
        );
        fs.writeFileSync(
            `${project}/docs/summary.json`,
            JSON.stringify([{ title: 'Guide', file: 'guide.md' }])
        );
        fs.writeFileSync(`${project}/docs/guide.md`, '# Guide\n\n## Setup\n');
        fs.writeFileSync(
            `${project}/src/app/guide-card.component.ts`,
            [
                "import { Component } from '@angular/core';",
                '',
                '/**',
                ' * A card. Read {@link ../../docs/guide.md#setup|Relative guide},',
                ' * {@link /guide.md|Root guide}, {@link ./features/billing/README.md|Billing},',
                ' * {@link ./nowhere.md|Nowhere} and {@link https://example.com/y.md|Web}.',
                ' */',
                "@Component({ selector: 'app-guide-card', template: '' })",
                'export class GuideCardComponent {}',
                ''
            ].join('\n')
        );
        fs.writeFileSync(
            `${project}/src/app/guide-card.component.md`,
            '# Guide card\n\n[Readme guide](../../docs/guide.md) and [Helper](./helper.service.md#use).\n'
        );
        fs.writeFileSync(
            `${project}/src/app/helper.service.ts`,
            [
                "import { Injectable } from '@angular/core';",
                '',
                '/** Helps. */',
                "@Injectable({ providedIn: 'root' })",
                'export class HelperService {}',
                ''
            ].join('\n')
        );
        fs.writeFileSync(`${project}/src/app/helper.service.md`, '# Helper\n\nUse it.\n');
        fs.writeFileSync(
            `${project}/src/app/features/billing/billing.component.ts`,
            [
                "import { Component } from '@angular/core';",
                '',
                '/** Bills. */',
                "@Component({ selector: 'app-billing', template: '' })",
                'export class BillingComponent {}',
                ''
            ].join('\n')
        );
        fs.writeFileSync(
            `${project}/src/app/features/billing/README.md`,
            [
                '# Billing',
                '',
                'Pays.',
                '',
                '[Feature relative](../../../../docs/guide.md#setup),',
                '[Feature root](/guide.md), [Feature lost](../../../../docs/lost.md),',
                '[Feature web](https://example.com/z.md) and [Feature text](./notes.txt).',
                '[Feature neighbour](./billing.component.md#use), [Feature own](./README.md)',
                'and [Feature sibling lost](./lost-sibling.md).',
                ''
            ].join('\n')
        );
        fs.writeFileSync(
            `${project}/src/app/features/billing/billing.component.md`,
            '# Billing component\n\n## Use\n'
        );
        run = generate(dist, `${project}/docs`, `${project}/tsconfig.json`, ['--verbose']);
    });

    afterAll(() => {
        tmp.clean(project);
        tmp.clean(dist);
    });

    const card = () => pages.of('component', 'GuideCardComponent');
    const contextOf = (page: string): string | undefined =>
        /COMPODOC_CURRENT_PAGE_CONTEXT = '([^']*)'/.exec(read(`${dist}/${page}`))?.[1];

    it('points a relative JSDoc link at the additional page, anchor kept', () => {
        const page = card();
        const [href] = hrefsOf(read(`${dist}/${page}`), 'Relative guide');
        expect(targetOf(page, href)).toBe(additional('guide'));
        expect(href.endsWith('#setup')).toBe(true);
    });

    it('resolves a root-absolute JSDoc link against the includes folder', () => {
        const page = card();
        const [href] = hrefsOf(read(`${dist}/${page}`), 'Root guide');
        expect(targetOf(page, href)).toBe(additional('guide'));
    });

    it('points a link to a feature README at the feature page', () => {
        const page = card();
        const [href] = hrefsOf(read(`${dist}/${page}`), 'Billing');
        expect(contextOf(targetOf(page, href))).toBe('feature');
    });

    it('points the links of the neighbour README at their pages', () => {
        const page = card();
        const html = read(`${dist}/${page}`);
        expect(targetOf(page, hrefsOf(html, 'Readme guide')[0])).toBe(additional('guide'));
        const [helper] = hrefsOf(html, 'Helper');
        expect(targetOf(page, helper)).toBe(pages.of('injectable', 'HelperService'));
        expect(helper.endsWith('#use')).toBe(true);
    });

    describe('in the README of a feature page', () => {
        const featurePage = () => {
            const page = card();
            return targetOf(page, hrefsOf(read(`${dist}/${page}`), 'Billing')[0]);
        };
        const featureHtml = () => read(`${dist}/${featurePage()}`);

        it('points a relative link at the additional page, anchor kept', () => {
            const [href] = hrefsOf(featureHtml(), 'Feature relative');
            expect(targetOf(featurePage(), href)).toBe(additional('guide'));
            expect(href.endsWith('#setup')).toBe(true);
        });

        it('resolves a root-absolute link against the includes folder', () => {
            const [href] = hrefsOf(featureHtml(), 'Feature root');
            expect(targetOf(featurePage(), href)).toBe(additional('guide'));
        });

        it('keeps a .md link without a page and reports it', () => {
            expect(hrefsOf(featureHtml(), 'Feature lost')).toEqual(['../../../../docs/lost.md']);
            const readme = shown(`${project}/src/app/features/billing/README.md`);
            const target = shown(`${project}/docs/lost.md`);
            expect(run.stdout).toContain(`  ${readme}: ${target}\n`);
        });

        it('points a link to a neighbour file in the feature folder at the symbol page', () => {
            const [href] = hrefsOf(featureHtml(), 'Feature neighbour');
            expect(targetOf(featurePage(), href)).toBe(pages.of('component', 'BillingComponent'));
            expect(href.endsWith('#use')).toBe(true);
        });

        it('points a link to the README of the folder at the feature page', () => {
            const [href] = hrefsOf(featureHtml(), 'Feature own');
            expect(targetOf(featurePage(), href)).toBe(featurePage());
        });

        it('reports a .md link to a missing file in the feature folder', () => {
            expect(hrefsOf(featureHtml(), 'Feature sibling lost')).toEqual(['./lost-sibling.md']);
            const readme = shown(`${project}/src/app/features/billing/README.md`);
            const target = shown(`${project}/src/app/features/billing/lost-sibling.md`);
            expect(run.stdout).toContain(`  ${readme}: ${target}\n`);
        });

        it('keeps an external link and drops a relative link to another file type', () => {
            const html = featureHtml();
            expect(hrefsOf(html, 'Feature web')).toEqual(['https://example.com/z.md']);
            expect(hrefsOf(html, 'Feature text')).toEqual([]);
            expect(html).toContain('Feature text');
        });
    });

    it('keeps external and unknown links and reports the unknown one', () => {
        const page = card();
        const html = read(`${dist}/${page}`);
        expect(hrefsOf(html, 'Web')).toEqual(['https://example.com/y.md']);
        expect(hrefsOf(html, 'Nowhere')).toEqual(['./nowhere.md']);
        const line = `  ${shown(`${project}/src/app/guide-card.component.ts`)}: ${shown(`${project}/src/app/nowhere.md`)}`;
        expect(run.stdout).toContain(`${line}\n`);
        expect(run.stdout).not.toContain('y.md\n');
        expect(summaryLines(run.stdout)).toHaveLength(1);
    });
});
