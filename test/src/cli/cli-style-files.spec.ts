import * as fs from 'node:fs';
import * as path from 'node:path';
import { EXPORT_SCHEMA_VERSION } from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI style files in the exports', () => {
    const fixture = `${tmp.name}-style-export-fixture`;
    const jsonDist = `${tmp.name}-style-export-json`;
    const llmDist = `${tmp.name}-style-export-llm`;
    const publicDist = `${tmp.name}-style-export-public`;
    let exported: any;
    let markdown: string;
    let exportedPublic: any;

    const run = (format: string, dist: string, config = '.compodocxrc.json') => {
        const ls = shell('node', [
            './bin/index-cli.js',
            '-c',
            path.join(fixture, config),
            '-p',
            path.join(fixture, 'tsconfig.json'),
            '-e',
            format,
            '-d',
            dist
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
    };

    beforeAll(() => {
        fs.cpSync(path.resolve('test/fixtures/style-library'), fixture, { recursive: true });
        tmp.create(jsonDist);
        tmp.create(llmDist);
        tmp.create(publicDist);
        run('json', jsonDist);
        run('llm-md', llmDist);
        run('json', publicDist, '.compodocxrc.public.json');
        exported = JSON.parse(read(`${jsonDist}/documentation.json`));
        markdown = read(`${llmDist}/llm-context.md`);
        exportedPublic = JSON.parse(read(`${publicDist}/documentation.json`));
    });

    afterAll(() => {
        tmp.clean(fixture);
        tmp.clean(jsonDist);
        tmp.clean(llmDist);
        tmp.clean(publicDist);
    });

    const highlightFile = (data: any) =>
        data.styleFiles.find((file: any) => file.file.endsWith('sty-highlight.css'));
    const tokenNames = (tokens: any[]) => tokens.map((t: any) => t.name);

    it('writes the style files with content, their themes and their sources', () => {
        const files = exported.styleFiles.map((file: any) => path.basename(file.file));
        expect(files).to.deep.equal([
            'sty-highlight.css',
            'tokens.css',
            '_bridge.scss',
            'card-theme.scss'
        ]);
        const card = exported.styleFiles.find((file: any) => file.file.endsWith('card-theme.scss'));
        expect(card.themes.map((ref: any) => ref.name)).to.deep.equal(['StyCard', 'StyTooltip']);
        expect(card.mixins.map((mixin: any) => mixin.name)).to.deep.equal(['theme']);
        expect(exported.styleSources[card.file].language).to.equal('scss');
        expect(exported.schemaVersion).to.equal(EXPORT_SCHEMA_VERSION);
    });

    it('gives the themed directive the tokens of its style file', () => {
        const highlight = exported.directives.find((d: any) => d.name === 'StyHighlight');
        expect(highlight.themeTokens.map((t: any) => t.name)).to.deep.equal([
            '--sty-highlight-bg',
            '--sty-highlight-strong-bg',
            '--sty-highlight-padding'
        ]);
        expect(highlight.themeStyleSources).to.have.length(1);
    });

    it('leaves the custom properties named with --_ out of both exports', () => {
        expect(tokenNames(highlightFile(exported).tokens)).to.not.contain('--_sty-highlight-inset');
        expect(tokenNames(highlightFile(exported).tokens)).to.contain('--sty-highlight-padding');
        expect(markdown).to.not.contain('--_sty-highlight-inset');
        expect(markdown).to.contain('--sty-highlight-padding');
    });

    it('lists them again with themingPrivatePrefix: false', () => {
        expect(tokenNames(highlightFile(exportedPublic).tokens)).to.contain(
            '--_sty-highlight-inset'
        );
        const highlight = exportedPublic.directives.find((d: any) => d.name === 'StyHighlight');
        expect(tokenNames(highlight.themeTokens)).to.contain('--_sty-highlight-inset');
    });

    it('adds a Design tokens section to the llm-md export', () => {
        expect(markdown).to.contain('## Design tokens');
        expect(markdown).to.contain('`--sty-color-primary: <color> = #3355ff` [Colour]');
        expect(markdown).to.contain('`@mixin theme($theme, $elevation: 1)`');
    });
});
