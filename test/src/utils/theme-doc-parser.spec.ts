import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    collectStyleSources,
    collectThemeTokens,
    groupThemeTokens,
    parseCssTokens,
    parseDocBody,
    parseScssTokens,
    parseStyleSource
} from '../../../src/utils/theme-doc-parser';

describe('Utils - theme-doc-parser', () => {
    describe('parseDocBody', () => {
        it('returns an empty description and no tags for an empty body', () => {
            const result = parseDocBody('');
            expect(result.description).to.equal('');
            expect(result.tags).to.deep.equal([]);
        });

        it('treats the leading text as description when no tags are present', () => {
            const result = parseDocBody('A free-form description.\nSecond line.');
            expect(result.description).to.equal('A free-form description.\nSecond line.');
            expect(result.tags).to.deep.equal([]);
        });

        it('splits description from tags at the first @-line', () => {
            const result = parseDocBody(
                'Innenabstand des Containers.\n@type Length\n@default 12px 16px\n@group container'
            );
            expect(result.description).to.equal('Innenabstand des Containers.');
            expect(result.tags).to.deep.equal([
                { name: 'type', value: 'Length' },
                { name: 'default', value: '12px 16px' },
                { name: 'group', value: 'container' }
            ]);
        });

        it('captures multi-line @example values up to the next tag', () => {
            const body = [
                'A description.',
                '@example',
                '```scss',
                '$padding: 8px;',
                '```',
                '@since 0.1.0'
            ].join('\n');
            const result = parseDocBody(body);
            expect(result.tags[0].name).to.equal('example');
            expect(result.tags[0].value).to.equal('```scss\n$padding: 8px;\n```');
            expect(result.tags[1]).to.deep.equal({ name: 'since', value: '0.1.0' });
        });

        it('returns @deprecated with empty value when no reason is given', () => {
            const result = parseDocBody('@deprecated');
            expect(result.tags).to.deep.equal([{ name: 'deprecated', value: '' }]);
        });

        it('preserves tag value when it spans onto the next line before the next tag', () => {
            const result = parseDocBody('@deprecated\nUse --new-token instead.\n@since 0.2.0');
            expect(result.tags[0]).to.deep.equal({
                name: 'deprecated',
                value: 'Use --new-token instead.'
            });
            expect(result.tags[1]).to.deep.equal({ name: 'since', value: '0.2.0' });
        });
    });

    describe('parseScssTokens', () => {
        it('extracts a single SassDoc-annotated variable with all tags', () => {
            const source = [
                '/// Innenabstand des Alert-Containers.',
                '/// @type Length',
                '/// @default 12px 16px',
                '/// @group container',
                '$alert-padding: 12px 16px !default;'
            ].join('\n');

            const { tokens } = parseScssTokens(source, 'alert.scss');
            expect(tokens).to.have.lengthOf(1);
            expect(tokens[0]).to.include({
                name: '$alert-padding',
                kind: 'scss-variable',
                type: 'Length',
                defaultValue: '12px 16px',
                description: 'Innenabstand des Alert-Containers.',
                group: 'container',
                file: 'alert.scss'
            });
            expect(tokens[0].line).to.equal(5);
        });

        it('uses the literal value when @default is missing', () => {
            const source = ['/// Background', '$alert-bg: #fff;'].join('\n');
            const { tokens } = parseScssTokens(source, 'a.scss');
            expect(tokens[0].defaultValue).to.equal('#fff');
            expect(tokens[0].type).to.equal('');
        });

        it('returns an empty array when there is no `///` block above the declaration', () => {
            const source = '$plain: red;\n// regular comment\n$other: blue;';
            expect(parseScssTokens(source, 'x.scss').tokens).to.deep.equal([]);
        });

        it('skips a `///` block when an unrelated declaration interrupts the chain', () => {
            const source = ['/// Doc', 'body { color: red; }', '$foo: 1px;'].join('\n');
            expect(parseScssTokens(source, 'x.scss').tokens).to.deep.equal([]);
        });

        it('extracts multiple tokens in source order', () => {
            const source = [
                '/// First',
                '$a: 1;',
                '',
                '/// Second',
                '/// @group misc',
                '$b: 2 !default;'
            ].join('\n');
            const { tokens } = parseScssTokens(source, 's.scss');
            expect(tokens.map(t => t.name)).to.deep.equal(['$a', '$b']);
            expect(tokens[1].group).to.equal('misc');
        });

        it('preserves @example fenced blocks across the doc body', () => {
            const source = [
                '/// Demo token.',
                '/// @example',
                '/// ```scss',
                '/// $foo: 12px;',
                '/// ```',
                '$foo: 12px;'
            ].join('\n');
            const { tokens } = parseScssTokens(source, 'x.scss');
            expect(tokens[0].examples).to.have.lengthOf(1);
            expect(tokens[0].examples[0]).to.include('$foo: 12px;');
        });
    });

    describe('parseCssTokens', () => {
        it('extracts a custom property with a JSDoc block', () => {
            const source = [
                '/**',
                ' * Hintergrundfarbe des Alerts.',
                ' * @type <color>',
                ' * @default #f8fafc',
                ' * @group container',
                ' * @since 0.1.0',
                ' */',
                ':host {',
                '    --cngx-alert-bg: #f8fafc;',
                '}'
            ].join('\n');

            const { tokens } = parseCssTokens(source, 'alert.css');
            expect(tokens).to.have.lengthOf(1);
            expect(tokens[0]).to.include({
                name: '--cngx-alert-bg',
                kind: 'css-custom-property',
                type: '<color>',
                defaultValue: '#f8fafc',
                group: 'container',
                since: '0.1.0'
            });
            expect(tokens[0].description).to.equal('Hintergrundfarbe des Alerts.');
        });

        it('ignores single-asterisk `/* */` blocks', () => {
            const source = [
                '/* not a JSDoc block',
                ' * @type <length>',
                ' */',
                ':host { --foo: 1px; }'
            ].join('\n');
            expect(parseCssTokens(source, 'x.css').tokens).to.deep.equal([]);
        });

        it('merges @property syntax + initial-value with the JSDoc block', () => {
            const source = [
                '/**',
                ' * Innenabstand des Alert-Containers.',
                ' * @group container',
                ' */',
                '@property --cngx-alert-padding {',
                "    syntax: '<length>+';",
                '    inherits: true;',
                '    initial-value: 12px 16px;',
                '}'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'alert.css');
            expect(tokens).to.have.lengthOf(1);
            expect(tokens[0]).to.include({
                name: '--cngx-alert-padding',
                kind: 'css-at-property',
                type: '<length>+',
                defaultValue: '12px 16px',
                group: 'container',
                description: 'Innenabstand des Alert-Containers.'
            });
        });

        it('lets explicit @type / @default override @property descriptors', () => {
            const source = [
                '/**',
                ' * @type Length',
                ' * @default 16px',
                ' */',
                '@property --foo {',
                "    syntax: '<color>';",
                '    initial-value: red;',
                '}'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'x.css');
            expect(tokens[0].type).to.equal('Length');
            expect(tokens[0].defaultValue).to.equal('16px');
        });

        it('captures undocumented @property rules with the browser-native descriptors', () => {
            const source = [
                '@property --bare {',
                "    syntax: '<number>';",
                '    initial-value: 0;',
                '    inherits: true;',
                '}'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'bare.css');
            expect(tokens).to.have.lengthOf(1);
            expect(tokens[0]).to.include({
                name: '--bare',
                kind: 'css-at-property',
                type: '<number>',
                defaultValue: '0',
                description: ''
            });
        });

        it('honours @deprecated with a reason', () => {
            const source = [
                '/**',
                ' * @deprecated Use --cdx-foo instead.',
                ' */',
                ':host { --legacy: 1; }'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'x.css');
            expect(tokens[0].deprecated).to.equal('Use --cdx-foo instead.');
        });

        it('captures multiple @see entries and an inline {@link} in description', () => {
            const source = [
                '/**',
                ' * See {@link OtherToken} for context.',
                ' * @see https://example.com/spec',
                ' * @see --other-token',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'x.css');
            expect(tokens[0].see).to.deep.equal(['https://example.com/spec', '--other-token']);
            expect(tokens[0].description).to.contain('{@link OtherToken}');
        });

        it('preserves unknown tags as plain description text (no error)', () => {
            const source = [
                '/**',
                ' * Token.',
                ' * @customField sentinel',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const { tokens } = parseCssTokens(source, 'x.css');
            expect(tokens[0].description).to.contain('@customField sentinel');
        });

        it('skips a JSDoc block that is followed by something other than a target', () => {
            const source = ['/**', ' * @type Length', ' */', 'body { color: red; }'].join('\n');
            expect(parseCssTokens(source, 'x.css').tokens).to.deep.equal([]);
        });
    });

    describe('@overview', () => {
        it('captures a JSDoc block carrying @overview as the file intro', () => {
            const source = [
                '/**',
                ' * @overview',
                ' * The block below is the canonical source of truth for every',
                ' * --cngx-alert-* custom property.',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const result = parseCssTokens(source, 'alert.css');
            expect(result.overview).to.have.lengthOf(1);
            expect(result.overview[0]).to.contain('canonical source of truth');
            // The @overview block does NOT consume the following declaration
            expect(result.tokens).to.deep.equal([]);
        });

        it('captures the description body when @overview is bare (no value)', () => {
            const source = [
                '/**',
                ' * Theme tokens for the alert component.',
                ' * Each declaration below maps to a CSS custom property.',
                ' * @overview',
                ' */',
                ''
            ].join('\n');
            const result = parseCssTokens(source, 'alert.css');
            expect(result.overview[0]).to.contain('Theme tokens for the alert component');
            expect(result.overview[0]).to.contain('maps to a CSS custom property');
        });

        it('captures @overview from a SassDoc `///` block', () => {
            const source = [
                '/// @overview',
                '/// SCSS-side intro for theme tokens.',
                '',
                '/// Padding',
                '$pad: 8px;'
            ].join('\n');
            const result = parseScssTokens(source, 'x.scss');
            expect(result.overview).to.deep.equal(['SCSS-side intro for theme tokens.']);
            expect(result.tokens.map(t => t.name)).to.deep.equal(['$pad']);
        });

        it('concatenates multiple @overview blocks in source order', () => {
            const source = [
                '/**',
                ' * @overview',
                ' * First paragraph.',
                ' */',
                '/**',
                ' * @overview',
                ' * Second paragraph.',
                ' */'
            ].join('\n');
            const result = parseCssTokens(source, 'x.css');
            expect(result.overview).to.deep.equal(['First paragraph.', 'Second paragraph.']);
        });
    });

    describe('parseStyleSource', () => {
        it('routes scss to the SCSS scanner and folds in CSS too', () => {
            const source = [
                '/// SCSS var',
                '$foo: 1px;',
                '',
                '/**',
                ' * CSS prop',
                ' * @type <color>',
                ' */',
                ':host { --bar: red; }'
            ].join('\n');
            const result = parseStyleSource(source, 'mix.scss', 'scss');
            const names = result.tokens.map(t => t.name).sort();
            expect(names).to.deep.equal(['$foo', '--bar']);
            expect(result.overview).to.deep.equal([]);
        });

        it('routes css to the CSS scanner only', () => {
            const source = '/// not parsed as scss\n$ignored: 1px;';
            expect(parseStyleSource(source, 'x.css', 'css').tokens).to.deep.equal([]);
        });

        it('merges overview blocks from both SCSS and embedded CSS in a .scss file', () => {
            const source = [
                '/// @overview',
                '/// SCSS intro.',
                '',
                '/**',
                ' * @overview',
                ' * CSS intro.',
                ' */'
            ].join('\n');
            const result = parseStyleSource(source, 'mix.scss', 'scss');
            expect(result.overview).to.deep.equal(['SCSS intro.', 'CSS intro.']);
        });
    });

    describe('groupThemeTokens', () => {
        it('puts ungrouped tokens in the flat default bucket first', () => {
            const { tokens } = parseStyleSource(
                [
                    '/// A',
                    '$a: 1;',
                    '/// B',
                    '/// @group typography',
                    '$b: 2;',
                    '/// C',
                    '$c: 3;'
                ].join('\n'),
                'x.scss',
                'scss'
            );
            const groups = groupThemeTokens(tokens);
            expect(groups[0].name).to.equal('');
            expect(groups[0].tokens.map(t => t.name)).to.deep.equal(['$a', '$c']);
            expect(groups[1].name).to.equal('typography');
            expect(groups[1].tokens.map(t => t.name)).to.deep.equal(['$b']);
        });
    });

    describe('collectStyleSources + collectThemeTokens (filesystem)', () => {
        let tmp: string;

        beforeEach(() => {
            tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-doc-parser-'));
        });

        afterEach(() => {
            vi.restoreAllMocks();
            fs.rmSync(tmp, { recursive: true, force: true });
        });

        const writeFile = (rel: string, content: string) => {
            const full = path.join(tmp, rel);
            fs.mkdirSync(path.dirname(full), { recursive: true });
            fs.writeFileSync(full, content);
            return full;
        };

        it('reads styleUrls relative to the entity file', () => {
            const entity = writeFile('button/button.component.ts', '// stub');
            writeFile('button/button.component.scss', ['/// Padding', '$padding: 8px;'].join('\n'));

            const result = collectThemeTokens({
                entityFile: entity,
                styleUrls: ['./button.component.scss'],
                styles: []
            });
            expect(result.sources).to.have.lengthOf(1);
            expect(result.tokens).to.have.lengthOf(1);
            expect(result.tokens[0].name).to.equal('$padding');
        });

        it('follows @use one level deep into a partial', () => {
            const entity = writeFile('btn/btn.component.ts', '// stub');
            writeFile(
                'btn/btn.component.scss',
                ["@use './tokens';", '/// Local', '$local: 1px;'].join('\n')
            );
            writeFile('btn/_tokens.scss', ['/// Imported', '$imported: 4px;'].join('\n'));

            const result = collectThemeTokens({
                entityFile: entity,
                styleUrls: ['./btn.component.scss'],
                styles: []
            });
            const names = result.tokens.map(t => t.name).sort();
            expect(names).to.deep.equal(['$imported', '$local']);
        });

        it('treats inline styles[] as anonymous CSS', () => {
            const entity = writeFile('inline/x.component.ts', '// stub');
            const result = collectThemeTokens({
                entityFile: entity,
                styleUrls: [],
                styles: ['/**\n * inline\n * @type <color>\n */\n:host { --inline: red; }']
            });
            expect(result.tokens).to.have.lengthOf(1);
            expect(result.tokens[0].name).to.equal('--inline');
            expect(result.tokens[0].file).to.equal('<inline-style-0>');
        });

        it('skips missing styleUrls with a warning instead of throwing', () => {
            const entity = writeFile('miss/m.component.ts', '// stub');
            const result = collectStyleSources({
                entityFile: entity,
                styleUrls: ['./does-not-exist.scss']
            });
            expect(result).to.deep.equal([]);
        });

        it('stores source files relative to the working directory with forward slashes', () => {
            vi.spyOn(process, 'cwd').mockReturnValue(tmp);
            const entity = writeFile('rel/card.component.ts', '// stub');
            writeFile('rel/card.component.scss', ["@use './tokens';", '$local: 1px;'].join('\n'));
            writeFile('rel/_tokens.scss', '$imported: 4px;');

            const sources = collectStyleSources({
                entityFile: entity,
                styleUrls: ['./card.component.scss']
            });
            expect(sources.map(s => s.file)).to.deep.equal([
                'rel/card.component.scss',
                'rel/_tokens.scss'
            ]);
        });

        it('stores token files relative to the working directory with forward slashes', () => {
            vi.spyOn(process, 'cwd').mockReturnValue(tmp);
            const entity = writeFile('rel/chip.component.ts', '// stub');
            writeFile('rel/chip.component.css', '/** Chip color */\n:host { --chip-color: red; }');

            const result = collectThemeTokens({
                entityFile: entity,
                styleUrls: ['./chip.component.css']
            });
            expect(result.tokens).to.have.lengthOf(1);
            expect(result.tokens[0].file).to.equal('rel/chip.component.css');
            expect(path.isAbsolute(result.tokens[0].file)).to.equal(false);
        });

        it('returns an empty result when no styleUrls and no styles are provided', () => {
            const entity = writeFile('empty/e.component.ts', '// stub');
            const result = collectThemeTokens({ entityFile: entity });
            expect(result.tokens).to.deep.equal([]);
            expect(result.sources).to.deep.equal([]);
        });
    });
});
