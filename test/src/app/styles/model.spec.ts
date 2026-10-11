import { describe, expect, it } from 'vitest';
import {
    buildStyleModel,
    formatListedNote,
    formatStyleSummary,
    hasStylePage
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
