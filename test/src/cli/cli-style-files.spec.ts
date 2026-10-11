import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI style files in the exports', () => {
    const fixture = `${tmp.name}-style-export-fixture`;
    const jsonDist = `${tmp.name}-style-export-json`;
    const llmDist = `${tmp.name}-style-export-llm`;
    let exported: any;
    let markdown: string;

    const run = (format: string, dist: string) => {
        const ls = shell('node', [
            './bin/index-cli.js',
            '-c',
            path.join(fixture, '.compodocxrc.json'),
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
        run('json', jsonDist);
        run('llm-md', llmDist);
        exported = JSON.parse(read(`${jsonDist}/documentation.json`));
        markdown = read(`${llmDist}/llm-context.md`);
    });

    afterAll(() => {
        tmp.clean(fixture);
        tmp.clean(jsonDist);
        tmp.clean(llmDist);
    });

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
        expect(exported.schemaVersion).to.equal(4);
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

    it('adds a Design tokens section to the llm-md export', () => {
        expect(markdown).to.contain('## Design tokens');
        expect(markdown).to.contain('`--sty-color-primary: <color> = #3355ff` [Colour]');
        expect(markdown).to.contain('`@mixin theme($theme, $elevation: 1)`');
    });
});
