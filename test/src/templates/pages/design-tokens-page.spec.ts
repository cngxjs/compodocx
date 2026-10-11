import { beforeAll, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable, withStyleEntries } from '../../../../src/app/links';
import { designTokenRows } from '../../../../src/app/page-generator/style-page-generator';
import { themeResolver } from '../../../../src/app/run/styles';
import { buildStyleModel, designTokens, resolveThemes } from '../../../../src/app/styles';
import { DesignTokensPage } from '../../../../src/templates/pages/DesignTokensPage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const token = (name: string, group?: string) =>
    `/**\n * ${name} token.\n${group ? ` * @group ${group}\n` : ''} */\n:root { ${name}: 1px; }\n`;

const table = buildSymbolTable(
    { components: [{ name: 'Card', file: 'kit/card.ts' }] },
    { cwd: '/' }
);
const files = resolveThemes(
    buildStyleModel([
        { file: 'a/motion.css', content: token('--speed', 'Motion') + token('--gap') },
        { file: 'b/colour.css', content: token('--brand', 'Colour') + token('--gap', 'Colour') },
        {
            file: 'c/card.css',
            content: `/**\n * Card.\n * @overview\n * @themes Card\n */\n${token('--card')}`
        }
    ]),
    themeResolver(table)
).model.files;

describe('design tokens page', () => {
    it('groups the unlinked tokens: default group first, then by name', () => {
        const { groups } = designTokens(files);
        expect(groups.map(group => [group.name, group.tokens.map(row => row.token.name)])).toEqual([
            ['', ['--gap']],
            ['Colour', ['--brand', '--gap']],
            ['Motion', ['--speed']]
        ]);
        expect(groups.map(group => group.id)).toEqual([
            'group-default',
            'group-colour',
            'group-motion'
        ]);
    });

    it('keeps token-<name> for the first file and numbers a later duplicate', () => {
        const tokens = designTokens(files);
        expect(tokens.groups[0].tokens[0].id).toBe('token-gap');
        expect(tokens.groups[1].tokens[1].id).toBe('token-gap-2');
        expect(tokens.duplicates).toEqual([
            { name: '--gap', files: ['a/motion.css', 'b/colour.css'] }
        ]);
    });

    it('links each row to the style page of its file', () => {
        Configuration.mainData.symbols = withStyleEntries(table, files);
        const { groups } = designTokenRows(files, 0);
        const html = DesignTokensPage({ groups, depth: 0 });
        expect(groups[2].tokens[0].href).toBe('./stylesheets/motion.html');
        expect(html).to.include('id="group-motion"');
        expect(html).to.include('id="token-speed"');
        expect(html).to.include('href="./stylesheets/motion.html"');
        expect(html).to.not.include('--card');
    });

    it('has nothing to show without an unlinked file with documented tokens', () => {
        expect(designTokens(files.filter(file => file.file === 'c/card.css')).groups).toEqual([]);
    });
});
