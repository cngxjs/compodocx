import { describe, expect, it } from 'vitest';
import { buildSymbolTable } from '../../../../src/app/links';
import { themeResolver } from '../../../../src/app/run/styles';
import {
    buildStyleModel,
    formatListedNote,
    formatStyleSummary,
    formatThemeProblem,
    hasStylePage,
    resolveThemes
} from '../../../../src/app/styles';

const overviewOnly = '/**\n * Global reset.\n *\n * @overview\n */\n* { margin: 0; }\n';
const documentedToken = '/**\n * Primary colour.\n */\n:root { --primary: red; }\n';
const undocumentedProperty =
    "@property --x {\n  syntax: '<length>';\n  inherits: true;\n  initial-value: 0px;\n}\n";
const mixinOnly = '/// Emits the theme.\n/// @param $theme - Theme map.\n@mixin theme($theme) {}\n';

describe('buildStyleModel', () => {
    it('counts an overview, a documented token or a documented mixin as content', () => {
        const model = buildStyleModel([
            { file: 'b/overview.css', content: overviewOnly },
            { file: 'a/token.css', content: documentedToken },
            { file: 'c/mixin.scss', content: mixinOnly }
        ]);
        expect(model.files.map(f => f.file)).toEqual([
            'a/token.css',
            'b/overview.css',
            'c/mixin.scss'
        ]);
        expect(model.files.map(f => f.language)).toEqual(['css', 'css', 'scss']);
        expect(model.files[2].mixins.map(m => m.name)).toEqual(['theme']);
        expect(model.listed).toEqual([]);
    });

    it('lists a file whose only token is an undocumented @property, and a plain file', () => {
        const model = buildStyleModel([
            { file: 'x.css', content: undocumentedProperty },
            { file: 'plain.css', content: '/* reset */\nbody { margin: 0; }\n' }
        ]);
        expect(model.files).toEqual([]);
        expect(model.listed).toEqual(['plain.css', 'x.css']);
    });

    it('collects unknown tags of every file, listed ones included', () => {
        const model = buildStyleModel([
            { file: 'x.css', content: '/**\n * Token.\n * @todo later\n */\n:root { --a: 1; }\n' },
            { file: 'y.css', content: '/**\n * @overview\n * @owner team\n */\n' }
        ]);
        expect(model.unknownTags).toEqual([
            { file: 'x.css', line: 3, tag: 'todo' },
            { file: 'y.css', line: 3, tag: 'owner' }
        ]);
    });

    it('keeps @themes names unresolved and reports pages and listed files in the log lines', () => {
        const model = buildStyleModel([
            { file: 'a.css', content: '/**\n * Tokens.\n * @overview\n * @themes Foo, Bar\n */\n' },
            { file: 'b.css', content: 'body {}\n' }
        ]);
        expect(model.files[0].themeNames).toEqual(['Foo', 'Bar']);
        expect(model.files[0].themes).toEqual([]);
        expect(hasStylePage(model.files[0])).toBe(true);
        expect(formatStyleSummary(model)).toBe(
            'Style files: 2 (1 pages, 0 linked to 0 symbols, 1 without documented content)'
        );
        expect(formatListedNote(model)).toBe(
            '1 style files have no documented tokens, mixins or overview: b.css'
        );
    });
});

describe('@themes resolution', () => {
    const table = buildSymbolTable(
        {
            components: [
                { name: 'StyCard', file: 'kit/card.ts' },
                { name: 'StyTwin', file: 'kit/a/twin.ts' }
            ],
            directives: [
                { name: 'StyHighlight', file: 'kit/highlight.ts' },
                { name: 'StyTwin', file: 'kit/b/twin.ts' }
            ],
            classes: [{ name: 'StyHelper', file: 'kit/helper.ts' }],
            tokens: [{ name: 'STY_TOKEN', file: 'kit/tokens.ts' }]
        },
        { cwd: '/' }
    );
    const themed = (names: string) =>
        buildStyleModel([
            {
                file: 'kit/theming/x.css',
                content: `/**\n * X.\n * @overview\n * @themes ${names}\n */\n`
            }
        ]);

    it('resolves components and directives and indexes the file by its targets', () => {
        const { model, problems } = resolveThemes(
            themed('StyCard, StyHighlight'),
            themeResolver(table)
        );
        expect(problems).toEqual([]);
        expect(model.files[0].themes).toEqual([
            'component:kit/card.ts#StyCard',
            'directive:kit/highlight.ts#StyHighlight'
        ]);
        expect([...model.byTarget]).toEqual([
            ['component:kit/card.ts#StyCard', ['style:kit/theming/x.css']],
            ['directive:kit/highlight.ts#StyHighlight', ['style:kit/theming/x.css']]
        ]);
        expect(hasStylePage(model.files[0])).toBe(true);
    });

    it('reports another kind and an unknown name, one warning for the file', () => {
        const { model, problems } = resolveThemes(
            themed('StyHelper STY_TOKEN NoSuch'),
            themeResolver(table)
        );
        expect(model.files[0].themes).toEqual([]);
        expect(problems.map(formatThemeProblem)).toEqual([
            'Style file kit/theming/x.css: @themes NoSuch not found; @themes StyHelper, STY_TOKEN is not a component or directive'
        ]);
    });

    it('uses the first of several same-name targets and says so', () => {
        const { model, problems } = resolveThemes(themed('StyTwin'), themeResolver(table));
        expect(model.files[0].themes).toEqual(['component:kit/a/twin.ts#StyTwin']);
        expect(problems[0].ambiguous).toEqual(['StyTwin']);
    });

    it('renders a file that themes one symbol on its tab only, a mixin file always gets a page', () => {
        const single = resolveThemes(themed('StyHighlight'), themeResolver(table)).model.files[0];
        expect(hasStylePage(single)).toBe(false);
        const withMixin = resolveThemes(
            buildStyleModel([
                {
                    file: 'm.scss',
                    content: '/// @themes StyCard\n\n/// Emits.\n@mixin theme($t) {}\n'
                }
            ]),
            themeResolver(table)
        ).model.files[0];
        expect(withMixin.themes).toHaveLength(1);
        expect(hasStylePage(withMixin)).toBe(true);
    });
});
