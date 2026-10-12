import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable, type SymbolEntry, withStyleEntries } from '../../../../src/app/links';
import { stylePageData } from '../../../../src/app/page-generator/style-page-generator';
import { themeResolver } from '../../../../src/app/run/styles';
import { buildStyleModel, resolveThemes, type StyleFile } from '../../../../src/app/styles';
import { StylePage } from '../../../../src/templates/pages/StylePage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const base = buildSymbolTable(
    { components: [{ name: 'StyCard', file: 'kit/card.ts' }] },
    { cwd: '/' }
);
const files = resolveThemes(
    buildStyleModel([
        {
            file: 'themes/card-theme.scss',
            content:
                '/// Card bridge.\n///\n/// @overview\n/// @themes StyCard\n\n' +
                '/// Emits the tokens.\n/// @param {Map} $theme - Theme map.\n@mixin theme($theme) {}\n'
        },
        {
            file: 'kit/theming/tokens.css',
            content: '/**\n * Primary.\n * @group Colour\n */\n:root { --primary: red; }\n'
        }
    ]),
    themeResolver(base)
).model.files;
const table = withStyleEntries(base, files);
const entryOf = (file: StyleFile): SymbolEntry =>
    [...table.byId.values()].find(entry => entry.ref.file === file.file) as SymbolEntry;
const [tokens, card] = files;

const render = (file: StyleFile, importLine?: string): string =>
    StylePage({
        style: stylePageData(file, entryOf(file), importLine, 1),
        styleEntry: entryOf(file),
        depth: 1
    });

describe('StylePage', () => {
    afterEach(() => {
        Configuration.mainData.themingTabSections = [];
        Configuration.mainData.disableSourceCode = false;
    });

    it('renders the hero with the language badge and the import line', () => {
        Configuration.mainData.symbols = table;
        const html = render(card, "@use '@sty/themes/card-theme';");
        expect(html).to.include('cdx-badge--entity-style');
        expect(html).to.include('SCSS');
        expect(html).to.include("@use '@sty/themes/card-theme';");
        expect(html).to.include('data-pagefind-meta="kind:Style"');
    });

    it('omits the import line without one', () => {
        Configuration.mainData.symbols = table;
        expect(render(tokens)).to.not.include('@import');
    });

    it('links the symbols the file themes', () => {
        Configuration.mainData.symbols = table;
        const html = render(card);
        expect(html).to.include('id="themes"');
        expect(html).to.match(/class="cdx-related-pill" href="[^"]*StyCard\.html"/);
    });

    it('renders overview, mixins and source; omits empty sections', () => {
        Configuration.mainData.symbols = table;
        const html = render(card);
        expect(html).to.include('id="overview"');
        expect(html).to.include('data-compodoc="block-theming-mixins"');
        expect(html).to.include('id="source"');
        expect(html).to.not.include('id="tokens"');
        expect(render(tokens)).to.not.include('id="themes"');
    });

    it('renders the tokens grouped like the Theming tab', () => {
        Configuration.mainData.symbols = table;
        const html = render(tokens);
        expect(html).to.include('id="tokens"');
        expect(html).to.include('id="theme-group-colour"');
        expect(html).to.include('--primary');
    });

    it('drops the source when the section or source code is disabled', () => {
        Configuration.mainData.symbols = table;
        Configuration.mainData.disableSourceCode = true;
        expect(render(card)).to.not.include('id="source"');
        Configuration.mainData.disableSourceCode = false;
        Configuration.mainData.themingTabSections = ['overview', 'tokens'];
        expect(render(card)).to.not.include('id="source"');
    });
});
