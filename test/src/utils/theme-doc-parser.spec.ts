import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    collectStyleSources,
    collectThemeTokens,
    formatHookConflictNotice,
    formatOrphanBlockNotice,
    formatUnknownStyleTagNotice,
    groupThemeTokens,
    mergeThemeTokens,
    parseCssTokens,
    parseDocBody,
    parseScssTokens,
    parseStyleSource,
    type ThemeToken,
    unknownStyleTags
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

        it('drops unknown tags from the description and records them with their line', () => {
            const source = [
                '/**',
                ' * Token.',
                ' * @customField sentinel',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const result = parseCssTokens(source, 'x.css');
            expect(result.tokens[0].description).to.equal('Token.');
            expect(result.unknownTags).to.deep.equal([
                { file: 'x.css', line: 3, tag: 'customField' }
            ]);
        });

        it('reads @relatedTo on a token, comma or space separated', () => {
            const source = [
                '/**',
                ' * Token.',
                ' * @relatedTo FooButton, FooCard BarDirective',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const result = parseCssTokens(source, 'x.css');
            expect(result.tokens[0].relatedTo).to.deep.equal([
                'FooButton',
                'FooCard',
                'BarDirective'
            ]);
            expect(result.tokens[0].description).to.equal('Token.');
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('leaves relatedTo off a token without the tag', () => {
            const source = ['/**', ' * Token.', ' */', ':host { --x: 1; }'].join('\n');
            expect(parseCssTokens(source, 'x.css').tokens[0]).to.not.have.property('relatedTo');
        });

        it('reports none of the known token tags as unknown', () => {
            const source = [
                '/**',
                ' * Token.',
                ' * @type <length>',
                ' * @default 1px',
                ' * @group Size',
                ' * @example',
                ' * .a { --x: 2px; }',
                ' * @since 1.0.0',
                ' * @deprecated use --y',
                ' * @see --y',
                ' * @relatedTo Foo',
                ' */',
                ':host { --x: 1px; }'
            ].join('\n');
            const result = parseCssTokens(source, 'x.css');
            expect(result.unknownTags).to.deep.equal([]);
            const token = result.tokens[0];
            expect([token.type, token.defaultValue, token.group, token.since]).to.deep.equal([
                '<length>',
                '1px',
                'Size',
                '1.0.0'
            ]);
            expect(token.deprecated).to.equal('use --y');
            expect(token.see).to.deep.equal(['--y']);
            expect(token.examples).to.deep.equal(['.a { --x: 2px; }']);
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

    describe('documented mixins and functions', () => {
        it('reads a SassDoc mixin with typed params, defaults and an example', () => {
            const source = [
                '/// Emits the card tokens.',
                '///',
                '/// @param {Map} $theme - Theme map.',
                '/// @param {Number} $elevation [2] - Shadow level.',
                '/// @example scss',
                '///   @include card.theme($t);',
                '@mixin theme($theme, $elevation: 1) {',
                '    color: red;',
                '}'
            ].join('\n');
            const [mixin] = parseScssTokens(source, 'x.scss').mixins;
            expect(mixin.name).to.equal('theme');
            expect(mixin.kind).to.equal('mixin');
            expect(mixin.line).to.equal(7);
            expect(mixin.description).to.equal('Emits the card tokens.');
            expect(mixin.params).to.deep.equal([
                { name: 'theme', default: '', description: 'Theme map.', type: 'Map' },
                { name: 'elevation', default: '2', description: 'Shadow level.', type: 'Number' }
            ]);
            expect(mixin.examples).to.deep.equal(['```scss\n@include card.theme($t);\n```']);
        });

        it('accepts the plain `@param $name text` form', () => {
            const source = ['/// Pads.', '/// @param $size the gap', '@mixin pad($size) {}'].join(
                '\n'
            );
            const [mixin] = parseScssTokens(source, 'x.scss').mixins;
            expect(mixin.params).to.deep.equal([
                { name: 'size', default: '', description: 'the gap', type: '' }
            ]);
        });

        it('lists signature params without a @param line, across a multi-line signature', () => {
            const source = [
                '/// Spacing helper.',
                '@mixin space(',
                '    $x,',
                '    $map: (a: 1, b: 2),',
                '    $rest...',
                ') {}'
            ].join('\n');
            const [mixin] = parseScssTokens(source, 'x.scss').mixins;
            expect(mixin.params.map(p => [p.name, p.default])).to.deep.equal([
                ['x', ''],
                ['map', '(a: 1, b: 2)'],
                ['rest', '']
            ]);
        });

        it('reads @content on a mixin and @return on a function', () => {
            const source = [
                '/// Wraps a block.',
                '/// @content The wrapped rules.',
                '@mixin wrap() { @content; }',
                '',
                '/// Reads a role.',
                '/// @param $role - Role name.',
                '/// @return {Color} The colour.',
                '@function role($role) { @return $role; }'
            ].join('\n');
            const [wrap, role] = parseScssTokens(source, 'x.scss').mixins;
            expect(wrap.content).to.equal('The wrapped rules.');
            expect(wrap.returns).to.equal('');
            expect(role.kind).to.equal('function');
            expect(role.content).to.equal(null);
            expect(role.returns).to.equal('{Color} The colour.');
        });

        it('skips private names and undocumented mixins', () => {
            const source = [
                '/// Private.',
                '@mixin _hidden() {}',
                '/// Private too.',
                '@function -helper($x) { @return $x; }',
                '@mixin undocumented() {}'
            ].join('\n');
            expect(parseScssTokens(source, 'x.scss').mixins).to.deep.equal([]);
        });

        it('records unknown tags of a mixin block and never documents a token with it', () => {
            const source = ['/// Mixin.', '/// @group Nope', '@mixin m() {}', '$x: 1;'].join('\n');
            const result = parseScssTokens(source, 'x.scss');
            expect(result.mixins).to.have.length(1);
            expect(result.tokens).to.deep.equal([]);
            expect(result.unknownTags).to.deep.equal([{ file: 'x.scss', line: 2, tag: 'group' }]);
        });

        it('finds no mixins in CSS', () => {
            expect(
                parseStyleSource('/** A. */\n@mixin a() {}', 'x.css', 'css').mixins
            ).to.deep.equal([]);
        });
    });

    describe('file-level tags', () => {
        it('reads @themes and @relatedTo from the @overview block', () => {
            const source = [
                '/**',
                ' * Intro.',
                ' * @overview',
                ' * @themes FooCard, FooTooltip',
                ' * @themes FooBadge',
                ' * @relatedTo FooButton',
                ' */',
                ':host { --x: 1; }'
            ].join('\n');
            const result = parseCssTokens(source, 'x.css');
            expect(result.overview).to.deep.equal(['Intro.']);
            expect(result.themes).to.deep.equal(['FooCard', 'FooTooltip', 'FooBadge']);
            expect(result.relatedTo).to.deep.equal(['FooButton']);
            expect(result.tokens).to.deep.equal([]);
        });

        it('reads @themes from a SassDoc block that has no @overview', () => {
            const source = ['/// @themes FooCard', '', '@mixin theme($t) {}'].join('\n');
            const result = parseScssTokens(source, 'x.scss');
            expect(result.themes).to.deep.equal(['FooCard']);
            expect(result.overview).to.deep.equal([]);
        });

        it('records other tags of an @overview block as unknown', () => {
            const source = ['/**', ' * Intro.', ' * @overview', ' * @author Someone', ' */'].join(
                '\n'
            );
            const result = parseCssTokens(source, 'x.css');
            expect(result.overview).to.deep.equal(['Intro.']);
            expect(result.unknownTags).to.deep.equal([{ file: 'x.css', line: 4, tag: 'author' }]);
        });

        it('reports the line of an unknown tag in a SassDoc block', () => {
            const source = ['$a: 1;', '/// Token.', '/// @todo later', '$x: 1px;'].join('\n');
            const result = parseScssTokens(source, 'x.scss');
            expect(result.unknownTags).to.deep.equal([{ file: 'x.scss', line: 3, tag: 'todo' }]);
        });
    });

    describe('unknown tag notice', () => {
        it('counts each tag and lists every location', () => {
            const tags = unknownStyleTags([
                {
                    file: 'a.css',
                    content: '/**\n * A.\n * @todo x\n */\n:host { --a: 1; }',
                    language: 'css'
                },
                {
                    file: 'a.css',
                    content: '/**\n * A.\n * @todo x\n */\n:host { --a: 1; }',
                    language: 'css'
                },
                {
                    file: 'b.scss',
                    content: '/// B.\n/// @todo y\n/// @foo z\n$b: 1;',
                    language: 'scss'
                }
            ]);
            expect(formatUnknownStyleTagNotice(tags)).to.deep.equal([
                'Style comments: 3 unknown tags ignored (@todo x2, @foo x1)',
                '  a.css:3 @todo',
                '  b.scss:2 @todo',
                '  b.scss:3 @foo'
            ]);
        });

        it('is empty without findings', () => {
            expect(formatUnknownStyleTagNotice([])).to.deep.equal([]);
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

    describe('hook tokens (@cssprop)', () => {
        const hooks = (tokens: ThemeToken[]) => tokens.filter(t => t.kind === 'css-hook');

        it('reads a /** */ hook block and does not attach it to the next declaration', () => {
            const css = [
                '/**',
                ' * Text colour.',
                ' * @cssprop --x-fg',
                ' */',
                ':root { --x-other: red; }'
            ].join('\n');
            const result = parseCssTokens(css, 'a.css');
            expect(result.tokens.map(t => [t.name, t.kind])).to.deep.equal([
                ['--x-fg', 'css-hook']
            ]);
            expect(result.tokens[0].description).to.equal('Text colour.');
            expect(result.tokens[0].line).to.equal(3);
        });

        it('reads a /// hook block in SCSS and keeps source order with other tokens', () => {
            const scss = [
                '/// Colour.',
                '/// @cssprop {<color>} [--x-fg=red] - Foreground.',
                '',
                '/// Padding',
                '$pad: 4px;'
            ].join('\n');
            const result = parseStyleSource(scss, 'a.scss', 'scss');
            expect(result.tokens.map(t => [t.name, t.kind])).to.deep.equal([
                ['--x-fg', 'css-hook'],
                ['$pad', 'scss-variable']
            ]);
        });

        it('creates one hook per tag, sharing the block tags', () => {
            const css =
                '/**\n * @group Surface\n * @cssprop --a\n * @cssproperty --b - Bee.\n */\n';
            const result = parseCssTokens(css, 'a.css');
            expect(result.tokens.map(t => [t.name, t.group, t.line])).to.deep.equal([
                ['--a', 'Surface', 3],
                ['--b', 'Surface', 4]
            ]);
            expect(result.tokens[1].description).to.equal('Bee.');
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('reads the inline syntax, default and description', () => {
            const [hook] = parseCssTokens(
                '/**\n * Block text.\n * @cssprop {<color>} [--x=var(--accent, red)] - Inline text.\n */\n',
                'a.css'
            ).tokens;
            expect(hook.type).to.equal('<color>');
            expect(hook.defaultValue).to.equal('var(--accent, red)');
            expect(hook.description).to.equal('Inline text.');
        });

        it('lets @type and @default win over the inline forms', () => {
            const [hook] = parseCssTokens(
                '/**\n * @type <length>\n * @default 2px\n * @cssprop {<color>} [--x=red]\n */\n',
                'a.css'
            ).tokens;
            expect(hook.type).to.equal('<length>');
            expect(hook.defaultValue).to.equal('2px');
        });

        it('falls back to the block description without an inline text', () => {
            const [hook] = parseCssTokens(
                '/**\n * Block text.\n * @cssprop --x\n */\n',
                'a.css'
            ).tokens;
            expect(hook.description).to.equal('Block text.');
        });

        it('balances braces inside the syntax', () => {
            const [hook] = parseCssTokens(
                '/**\n * @cssprop {<length>{1,4}} [--x=1px] - Edges.\n */\n',
                'a.css'
            ).tokens;
            expect(hook.type).to.equal('<length>{1,4}');
            expect(hook.name).to.equal('--x');
        });

        it('reports a name without leading dashes, or only lower-case tags, as unknown', () => {
            const result = parseCssTokens(
                '/**\n * @cssprop no-dashes\n * @cssProperty --y\n * @cssprop --ok\n */\n',
                'a.css'
            );
            expect(hooks(result.tokens).map(t => t.name)).to.deep.equal(['--ok']);
            expect(result.unknownTags.map(t => [t.tag, t.line])).to.deep.equal([
                ['cssprop', 2],
                ['cssProperty', 3]
            ]);
        });

        it('reads @cssprop lines inside an @overview block, with the inline text only', () => {
            const result = parseCssTokens(
                '/**\n * Intro text.\n * @overview\n * @cssprop --a - Inline.\n * @cssprop --b\n */\n',
                'a.css'
            );
            expect(result.overview).to.deep.equal(['Intro text.']);
            expect(result.tokens.map(t => [t.name, t.description, t.line])).to.deep.equal([
                ['--a', 'Inline.', 4],
                ['--b', '', 5]
            ]);
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('turns a hook into the declaration of its own sheet and records the conflict once', () => {
            const css = [
                '/**',
                ' * @cssprop {<color>} --x',
                ' */',
                ':host {',
                '    --x: blue;',
                '    --x: green;',
                '}'
            ].join('\n');
            const result = parseCssTokens(css, 'a.css');
            expect(result.tokens).to.have.lengthOf(1);
            expect(result.tokens[0]).to.include({
                kind: 'css-custom-property',
                line: 5,
                defaultValue: 'blue',
                type: '<color>'
            });
            expect(result.hookConflicts).to.deep.equal([{ file: 'a.css', line: 5, name: '--x' }]);
        });

        it('turns a hook into a registered property when the sheet registers it', () => {
            const css = [
                '/** @cssprop --x */',
                "@property --x {\n  syntax: '<length>';\n  inherits: true;\n  initial-value: 1px;\n}"
            ].join('\n');
            const result = parseCssTokens(css, 'a.css');
            const registered = result.tokens.filter(t => t.name === '--x');
            expect(registered.every(t => t.kind === 'css-at-property')).to.equal(true);
            expect(registered[0]).to.include({ type: '<length>', defaultValue: '1px', line: 2 });
            expect(result.hookConflicts).to.deep.equal([{ file: 'a.css', line: 2, name: '--x' }]);
        });

        it('does not take a var() read or a commented-out declaration for a declaration', () => {
            const css = [
                '/** @cssprop --x */',
                'a { color: var(--x, red); }',
                '/* b { --x: 1; } */',
                '/* c {',
                '  --x: 2;',
                '} */'
            ].join('\n');
            const result = parseCssTokens(css, 'a.css');
            expect(result.tokens.map(t => t.kind)).to.deep.equal(['css-hook']);
            expect(result.hookConflicts).to.deep.equal([]);
        });

        it('ignores a // comment in SCSS when looking for the declaration', () => {
            const scss = ['/// @cssprop --x', '// a { --x: 1; }', 'b { color: var(--x); }'].join(
                '\n'
            );
            const result = parseStyleSource(scss, 'a.scss', 'scss');
            expect(result.tokens.map(t => t.kind)).to.deep.equal(['css-hook']);
        });
    });

    describe('unattached doc blocks', () => {
        const orphans = (css: string, file = 'a.css') =>
            parseStyleSource(css, file, file.endsWith('.scss') ? 'scss' : 'css').orphanBlocks.map(
                o => o.line
            );

        it('reports a tagged CSS block above an unrelated rule, at its first line', () => {
            expect(
                orphans('a { x: y; }\n\n/**\n * Pad.\n * @group G\n */\n.chip { color: red; }')
            ).to.deep.equal([3]);
        });

        it('reports a tagged block at the end of a CSS file', () => {
            expect(orphans('a { x: y; }\n/**\n * @default 3\n */\n')).to.deep.equal([2]);
        });

        it('reports a block above a wrapper rule without a custom property inside', () => {
            expect(orphans('/**\n * @type <color>\n */\n:host { color: red; }')).to.deep.equal([1]);
        });

        it('reports a /** */ block above a SCSS variable and a /// block cut off by a rule', () => {
            expect(orphans('/**\n * @since 1\n */\n$a: 1;\n')).to.deep.equal([1]);
            expect(orphans('/// Pad.\n/// @group G\n.chip { x: y; }\n', 'a.scss')).to.deep.equal([
                1
            ]);
        });

        it('reports a /// block at the end of a SCSS file and one replaced by a later block', () => {
            expect(orphans('$a: 1;\n/// @since 1\n', 'a.scss')).to.deep.equal([2]);
            expect(
                orphans('/// First\n/// @since 1\n\n/// Second\n$b: 2;\n', 'a.scss')
            ).to.deep.equal([1]);
        });

        it('does not report attached blocks, whatever their kind', () => {
            expect(orphans('/**\n * @group G\n */\n:root { --a: 1; }')).to.deep.equal([]);
            expect(orphans('/**\n * @group G\n */\n:host { --a: 1; }')).to.deep.equal([]);
            expect(
                orphans(
                    "/**\n * @group G\n */\n@property --a {\n  syntax: '*';\n  inherits: true;\n}"
                )
            ).to.deep.equal([]);
            expect(orphans('/// @group G\n$a: 1;', 'a.scss')).to.deep.equal([]);
            expect(orphans('/// Pad.\n/// @since 1\n@mixin pad() {}', 'a.scss')).to.deep.equal([]);
        });

        it('does not report prose, unknown tags only, file-level or hook blocks', () => {
            expect(orphans('/** Just prose. */\n.chip { x: y; }')).to.deep.equal([]);
            expect(orphans('/**\n * @author me\n */\n.chip { x: y; }')).to.deep.equal([]);
            expect(orphans('/**\n * @overview\n * @group G\n */\n.chip { x: y; }')).to.deep.equal(
                []
            );
            expect(
                orphans('/**\n * @cssprop --a\n * @group G\n */\n.chip { x: y; }')
            ).to.deep.equal([]);
        });

        it('skips a block above a private mixin on purpose', () => {
            expect(orphans('/// Inner.\n/// @since 1\n@mixin _inner() {}', 'a.scss')).to.deep.equal(
                []
            );
        });
    });

    describe('@internal', () => {
        const AT_PROP =
            "@property --x {\n  syntax: '<length>';\n  inherits: true;\n  initial-value: 0px;\n}";
        const names = (result: { tokens: ThemeToken[] }) => result.tokens.map(t => t.name);

        it('hides a documented @property and keeps the fallback from bringing it back', () => {
            const result = parseCssTokens(
                `/**\n * Private alias.\n * @group G\n * @internal\n */\n${AT_PROP}\n`,
                'a.css'
            );
            expect(result.tokens).to.deep.equal([]);
            expect(result.unknownTags).to.deep.equal([]);
            expect(result.orphanBlocks).to.deep.equal([]);
        });

        it('hides a declaration and the first property of a selector head', () => {
            expect(
                names(parseCssTokens('/**\n * @internal\n */\n--x: 1px;\n--y: 2px;', 'a.css'))
            ).to.deep.equal([]);
            expect(
                names(
                    parseCssTokens(
                        '/**\n * @default 1px\n * @internal\n */\n:host { --x: 1px; }',
                        'a.css'
                    )
                )
            ).to.deep.equal([]);
        });

        it('hides the properties of a @cssprop block', () => {
            const result = parseCssTokens(
                '/**\n * @cssprop {<length>} [--x=0] - Hidden.\n * @internal\n */\n.a { b: c; }',
                'a.css'
            );
            expect(result.tokens).to.deep.equal([]);
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('hides the @cssprop lines of a file-level block and keeps its overview', () => {
            const result = parseCssTokens(
                '/**\n * Intro.\n * @overview\n * @cssprop --x\n * @internal\n */\n',
                'a.css'
            );
            expect(result.tokens).to.deep.equal([]);
            expect(result.overview).to.deep.equal(['Intro.']);
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('hides a SCSS variable and a SCSS mixin without reporting the block', () => {
            const result = parseScssTokens(
                '/// Gap.\n/// @group G\n/// @internal\n$gap: 4px;\n\n/// Pad.\n/// @internal\n@mixin pad() {}\n',
                'a.scss'
            );
            expect(result.tokens).to.deep.equal([]);
            expect(result.mixins).to.deep.equal([]);
            expect(result.unknownTags).to.deep.equal([]);
            expect(result.orphanBlocks).to.deep.equal([]);
        });

        it('does not report an @internal block that documents nothing', () => {
            const result = parseCssTokens(
                '/**\n * @group G\n * @internal\n */\n.a { b: c; }',
                'a.css'
            );
            expect(result.orphanBlocks).to.deep.equal([]);
            expect(result.unknownTags).to.deep.equal([]);
        });

        it('leaves the public tokens around it untouched', () => {
            const result = parseCssTokens(
                `/**\n * Public.\n */\n--a: 1px;\n/**\n * @internal\n */\n${AT_PROP}\n/** Next. */\n--b: 2px;\n`,
                'a.css'
            );
            expect(names(result)).to.deep.equal(['--a', '--b']);
            expect(result.tokens[0].description).to.equal('Public.');
        });
    });

    describe('formatOrphanBlockNotice', () => {
        it('is empty without blocks', () => {
            expect(formatOrphanBlockNotice([])).to.deep.equal([]);
        });

        it('counts in the singular and the plural', () => {
            const at = (line: number) => ({ file: 'a.css', line });
            expect(formatOrphanBlockNotice([at(3)])).to.deep.equal([
                'Style comments: 1 doc block not attached',
                '  a.css:3'
            ]);
            expect(formatOrphanBlockNotice([at(3), at(9)])).to.deep.equal([
                'Style comments: 2 doc blocks not attached',
                '  a.css:3',
                '  a.css:9'
            ]);
        });
    });

    describe('formatHookConflictNotice', () => {
        it('is empty without conflicts', () => {
            expect(formatHookConflictNotice([])).to.deep.equal([]);
        });

        it('names one conflict in the singular and several in the plural', () => {
            const one = { file: 'a.css', line: 3, name: '--x' };
            expect(formatHookConflictNotice([one])).to.deep.equal([
                'Style comments: 1 hook token also declared in its sheet, declaration kept',
                '  a.css:3 --x'
            ]);
            expect(formatHookConflictNotice([one, { ...one, name: '--y' }])[0]).to.equal(
                'Style comments: 2 hook tokens also declared in their sheets, declaration kept'
            );
        });
    });

    describe('mergeThemeTokens', () => {
        const token = (over: Partial<ThemeToken>): ThemeToken => ({
            name: '--x',
            kind: 'css-custom-property',
            type: '',
            defaultValue: '',
            description: '',
            group: '',
            examples: [],
            since: '',
            deprecated: null,
            see: [],
            file: 'a.css',
            line: 1,
            ...over
        });

        it('returns the same array when no name repeats', () => {
            const tokens = [token({ name: '--a' }), token({ name: '--b' })];
            expect(mergeThemeTokens(tokens)).to.equal(tokens);
        });

        it('lets a registered property win over a declaration in either order', () => {
            const declared = token({ file: 'base.css', line: 3, description: 'Declared.' });
            const registered = token({ kind: 'css-at-property', file: 'theme.css', line: 9 });
            for (const list of [
                [declared, registered],
                [registered, declared]
            ]) {
                const [merged] = mergeThemeTokens(list);
                expect(merged.kind).to.equal('css-at-property');
                expect(merged.file).to.equal('theme.css');
                expect(merged.line).to.equal(9);
                expect(merged.description).to.equal('Declared.');
            }
        });

        it('keeps the first on a tie and the position of the first occurrence', () => {
            const merged = mergeThemeTokens([
                token({ name: '--a' }),
                token({ file: 'one.css', line: 2 }),
                token({ name: '--b' }),
                token({ file: 'two.css', line: 5 })
            ]);
            expect(merged.map(t => t.name)).to.deep.equal(['--a', '--x', '--b']);
            expect(merged[1].file).to.equal('one.css');
        });

        it('fills prose fields from the first token that has them, never concatenating', () => {
            const [merged] = mergeThemeTokens([
                token({ description: 'First.', examples: ['a'], see: ['s1'] }),
                token({
                    kind: 'css-at-property',
                    group: 'Surface',
                    since: '1.0',
                    examples: ['b'],
                    see: ['s2'],
                    relatedTo: ['Chip']
                })
            ]);
            expect(merged.description).to.equal('First.');
            expect(merged.group).to.equal('Surface');
            expect(merged.since).to.equal('1.0');
            expect(merged.examples).to.deep.equal(['a']);
            expect(merged.see).to.deep.equal(['s1']);
            expect(merged.relatedTo).to.deep.equal(['Chip']);
        });

        it('falls back for type and default only when the winner has none', () => {
            const [empty] = mergeThemeTokens([
                token({ type: '<color>', defaultValue: 'red' }),
                token({ kind: 'css-at-property' })
            ]);
            expect(empty.type).to.equal('<color>');
            expect(empty.defaultValue).to.equal('red');
            const [own] = mergeThemeTokens([
                token({ type: '<color>', defaultValue: 'red' }),
                token({ kind: 'css-at-property', type: '<length>', defaultValue: '1px' })
            ]);
            expect(own.type).to.equal('<length>');
            expect(own.defaultValue).to.equal('1px');
        });

        it('takes deprecated from the winner, else the first that is not null', () => {
            expect(
                mergeThemeTokens([
                    token({ deprecated: 'old' }),
                    token({ kind: 'css-at-property', deprecated: '' })
                ])[0].deprecated
            ).to.equal('');
            expect(
                mergeThemeTokens([
                    token({ deprecated: 'old' }),
                    token({ kind: 'css-at-property' })
                ])[0].deprecated
            ).to.equal('old');
        });

        it('lets any declaration win over a hook', () => {
            const [merged] = mergeThemeTokens([
                token({ kind: 'css-hook', description: 'Hook text.' }),
                token({ file: 'decl.css', line: 4 })
            ]);
            expect(merged.kind).to.equal('css-custom-property');
            expect(merged.file).to.equal('decl.css');
            expect(merged.description).to.equal('Hook text.');
        });

        it('keeps a scss variable and a custom property of the same spelling apart', () => {
            const tokens = [token({ name: '$x', kind: 'scss-variable' }), token({ name: '--x' })];
            expect(mergeThemeTokens(tokens)).to.equal(tokens);
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

        it('merges a token documented in two sheets of one component', () => {
            const entity = writeFile('chip/chip.ts', '// stub');
            writeFile('chip/chip.css', ':host {\n  /** Background. */\n  --c-bg: red;\n}\n');
            writeFile(
                'chip/chip.theme.css',
                "/**\n * @group Surface\n */\n@property --c-bg {\n  syntax: '<color>';\n  inherits: true;\n  initial-value: red;\n}\n"
            );
            const result = collectThemeTokens({
                entityFile: entity,
                styleUrls: ['./chip.css', './chip.theme.css']
            });
            expect(result.tokens).to.have.lengthOf(1);
            expect(result.tokens[0].kind).to.equal('css-at-property');
            expect(result.tokens[0].group).to.equal('Surface');
            expect(result.tokens[0].description).to.equal('Background.');
        });

        it('returns an empty result when no styleUrls and no styles are provided', () => {
            const entity = writeFile('empty/e.component.ts', '// stub');
            const result = collectThemeTokens({ entityFile: entity });
            expect(result.tokens).to.deep.equal([]);
            expect(result.sources).to.deep.equal([]);
        });
    });
});
