import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockTheming } from '../../../../src/templates/blocks/BlockTheming';
import type { ThemeToken } from '../../../../src/utils/theme-doc-parser';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const makeToken = (overrides: Partial<ThemeToken> = {}): ThemeToken => ({
    name: '--cdx-foo',
    kind: 'css-custom-property',
    type: '<color>',
    defaultValue: '#fff',
    description: 'Surface fill.',
    group: '',
    examples: [],
    since: '',
    deprecated: null,
    see: [],
    file: 'foo.css',
    line: 10,
    ...overrides
});

describe('BlockTheming', () => {
    afterEach(() => {
        clearCustomTemplates();
        Configuration.mainData.themingTabSections = [];
    });

    it('renders the root section with data-compodoc but without an inner h3 heading', () => {
        const html = BlockTheming({ tokens: [makeToken()] });
        expect(html).to.include('data-compodoc="block-theming"');
        // The tab header already says "Theming" — a duplicate <h3> would be noise.
        expect(html).to.not.match(/<h3[^>]*id="theming"/);
    });

    it('renders an @overview intro as cdx-prose at the top when provided', () => {
        const html = BlockTheming({
            tokens: [makeToken()],
            overview: 'The block below is the canonical source of truth.'
        });
        expect(html).to.include('cdx-theming-overview');
        expect(html).to.include('cdx-prose');
        expect(html).to.include('canonical source of truth');
        // Overview must appear before any token row
        const overviewIdx = html.indexOf('cdx-theming-overview');
        const memberIdx = html.indexOf('cdx-io-member--theming');
        expect(overviewIdx).to.be.lessThan(memberIdx);
    });

    it('renders markdown inside the @overview intro', () => {
        const html = BlockTheming({
            tokens: [makeToken()],
            overview: 'A **bold** intro with [a link](https://example.com).'
        });
        expect(html).to.match(/<strong>bold<\/strong>/);
        expect(html).to.include('href="https://example.com"');
    });

    it('omits the overview wrapper when overview is empty or whitespace-only', () => {
        const html = BlockTheming({ tokens: [makeToken()], overview: '   \n  ' });
        expect(html).to.not.include('cdx-theming-overview');
    });

    it('emits one cdx-io-member row per token with name/type/default/description', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({
                    name: '--cdx-bg',
                    type: '<color>',
                    defaultValue: '#fff'
                })
            ]
        });
        expect(html).to.include('data-compodoc="block-theming-token"');
        expect(html).to.include('cdx-io-member cdx-io-member--theming');
        expect(html).to.include('cdx-io-member--theming-css-custom-property');
        expect(html).to.include('cdx-io-member-name');
        expect(html).to.include('cdx-io-member-type');
        expect(html).to.include('cdx-io-member-default');
        expect(html).to.include('cdx-io-member-desc');
        expect(html).to.include('--cdx-bg');
        expect(html).to.include('&lt;color>');
        expect(html).to.include('#fff');
        expect(html).to.include('Surface fill');
    });

    it('does NOT emit any table chrome (uses flat cdx-io-member rows like the API tab)', () => {
        const html = BlockTheming({
            tokens: [makeToken({ name: '--a' }), makeToken({ name: '--b' })]
        });
        expect(html).to.not.include('cdx-theming-tokens');
        expect(html).to.not.include('<table');
        expect(html).to.not.include('cdx-theming-name-cell');
    });

    it('renders a kind-specific row class for SCSS variables', () => {
        const html = BlockTheming({
            tokens: [makeToken({ name: '$padding', kind: 'scss-variable' })]
        });
        expect(html).to.include('cdx-io-member--theming-scss-variable');
    });

    it('renders a kind-specific row class for @property at-rules', () => {
        const html = BlockTheming({
            tokens: [makeToken({ name: '--at', kind: 'css-at-property' })]
        });
        expect(html).to.include('cdx-io-member--theming-css-at-property');
    });

    it('emits a permalink anchor on each token row title', () => {
        const html = BlockTheming({ tokens: [makeToken({ name: '--cdx-bg' })] });
        expect(html).to.include('id="theme-cdx-bg"');
        expect(html).to.include('href="#theme-cdx-bg"');
    });

    it('renders an index of all tokens above the rows when there are 2+', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({ name: '--a', group: 'container' }),
                makeToken({ name: '--b', group: 'container' }),
                makeToken({ name: '--c', group: 'typography' })
            ]
        });
        expect(html).to.include('data-compodoc="block-theming-index"');
        expect(html).to.include('cdx-index-indicator--theming');
        expect(html).to.include('id="theme-index"');
        // Each token name listed exactly once in the index plus once on its row
        const aMatches = html.match(/--a/g) ?? [];
        expect(aMatches.length).to.be.greaterThanOrEqual(2);
        // The index appears before the first member row
        const indexIdx = html.indexOf('data-compodoc="block-theming-index"');
        const memberIdx = html.indexOf('data-compodoc="block-theming-token"');
        expect(indexIdx).to.be.lessThan(memberIdx);
    });

    it('omits the index when only a single token is present', () => {
        const html = BlockTheming({ tokens: [makeToken()] });
        expect(html).to.not.include('data-compodoc="block-theming-index"');
    });

    it('omits the group sub-heading for ungrouped tokens', () => {
        const html = BlockTheming({ tokens: [makeToken()] });
        expect(html).to.not.match(/<h4 class="cdx-section-heading"/);
    });

    it('renders one <h4> per named group', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({ name: '--a', group: 'container' }),
                makeToken({ name: '--b', group: 'container' }),
                makeToken({ name: '--c', group: 'typography' })
            ]
        });
        const h4s = html.match(/<h4 class="cdx-section-heading"/g) ?? [];
        expect(h4s).to.have.lengthOf(2);
        expect(html).to.include('container');
        expect(html).to.include('typography');
    });

    it('strikes through the name + emits a deprecated badge with reason title', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({
                    name: '--cdx-old',
                    deprecated: 'Use --cdx-new instead.'
                })
            ]
        });
        expect(html).to.include('<s>--cdx-old</s>');
        expect(html).to.include('cdx-badge--deprecated');
        expect(html).to.include('Use --cdx-new instead');
    });

    it('renders a since badge when @since is set', () => {
        const html = BlockTheming({ tokens: [makeToken({ since: '0.1.0' })] });
        expect(html).to.include('cdx-badge--since');
        expect(html).to.include('0.1.0');
    });

    it('renders @example fenced blocks as Shiki snippets', () => {
        const html = BlockTheming({
            tokens: [makeToken({ examples: ['```scss\n$padding: 8px;\n```'] })]
        });
        expect(html).to.include('cdx-theming-example');
        // highlightCode falls back to escaped text when Shiki is uninitialised
        expect(html).to.include('$padding');
    });

    it('renders @see entries as token cross-links and external URLs', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({
                    see: ['https://example.com/spec', '--cdx-other']
                })
            ]
        });
        expect(html).to.include('href="https://example.com/spec"');
        expect(html).to.include('href="#theme-cdx-other"');
    });

    it('renders the collapsible source panel when styleSources is non-empty', () => {
        const html = BlockTheming({
            tokens: [makeToken()],
            styleSources: [
                {
                    file: '/abs/path/btn/button.component.scss',
                    content: '$x: 1;',
                    language: 'scss'
                }
            ]
        });
        expect(html).to.include('cdx-theming-source');
        expect(html).to.include('btn/button.component.scss');
        expect(html).to.include('$x: 1');
    });

    it('omits the source panel when styleSources is empty or missing', () => {
        const html = BlockTheming({ tokens: [makeToken()] });
        expect(html).to.not.include('cdx-theming-source');
    });

    it('honours the `block-theming` custom-template override', () => {
        registerCustomTemplate('block-theming', () => '<aside id="my-custom-theming"/>');
        const html = BlockTheming({ tokens: [makeToken()] });
        expect(html).to.equal('<aside id="my-custom-theming"/>');
    });

    it('honours the `block-theming-token` custom-template override per row', () => {
        registerCustomTemplate(
            'block-theming-token',
            (data: any) => `<div data-stub="${data.token.name}"></div>`
        );
        const html = BlockTheming({
            tokens: [makeToken({ name: '--cdx-a' }), makeToken({ name: '--cdx-b' })]
        });
        expect(html).to.include('data-stub="--cdx-a"');
        expect(html).to.include('data-stub="--cdx-b"');
        // Default member-row chrome should NOT appear when each row was overridden
        expect(html).to.not.include('cdx-io-member-name');
    });

    it('renders @relatedTo names as Related chips, unresolved ones as code', () => {
        const html = BlockTheming({
            tokens: [makeToken({ relatedTo: ['NoSuchSymbol'] })],
            depth: 1
        });
        expect(html).to.include('cdx-theming-related');
        expect(html).to.include('<code>NoSuchSymbol</code>');
    });

    it('omits the Related row for tokens without @relatedTo', () => {
        expect(BlockTheming({ tokens: [makeToken()] })).to.not.include('cdx-theming-related');
    });

    it('passes the resolved related names to the `block-theming-token` override', () => {
        let seen: unknown;
        registerCustomTemplate('block-theming-token', (data: any) => {
            seen = data.related;
            return '<div></div>';
        });
        BlockTheming({ tokens: [makeToken({ relatedTo: ['NoSuchSymbol'] })], depth: 1 });
        expect(seen).to.deep.equal([{ name: 'NoSuchSymbol' }]);
    });

    const mixin = {
        name: 'theme',
        kind: 'mixin' as const,
        params: [{ name: 'theme', default: '', description: 'Theme map.', type: 'Map' }],
        description: 'Emits the tokens.',
        content: null,
        returns: '',
        examples: [],
        since: '',
        deprecated: null,
        see: [],
        relatedTo: [],
        file: 'x.scss',
        line: 3
    };

    it('renders a Mixins section after the tokens with signature and params', () => {
        const html = BlockTheming({ tokens: [makeToken()], mixins: [mixin] });
        expect(html).to.include('data-compodoc="block-theming-mixins"');
        expect(html).to.include('id="theme-mixin-theme"');
        expect(html).to.include('theme($theme)');
        expect(html).to.include('<code>$theme</code>');
        expect(html.indexOf('block-theming-token')).to.be.lessThan(
            html.indexOf('block-theming-mixins')
        );
    });

    it('omits the Mixins section without mixins or when "mixins" is not a section', () => {
        expect(BlockTheming({ tokens: [makeToken()] })).to.not.include('block-theming-mixins');
        Configuration.mainData.themingTabSections = ['tokens'];
        expect(BlockTheming({ tokens: [makeToken()], mixins: [mixin] })).to.not.include(
            'block-theming-mixins'
        );
    });

    it('honours the `block-theming-mixin` override and passes mixins to `block-theming`', () => {
        registerCustomTemplate('block-theming-mixin', (data: any) => `<i>${data.mixin.name}</i>`);
        expect(BlockTheming({ tokens: [], mixins: [mixin] })).to.include('<i>theme</i>');
        clearCustomTemplates();
        let seen: unknown;
        registerCustomTemplate('block-theming', (data: any) => {
            seen = data.mixins;
            return '';
        });
        BlockTheming({ tokens: [], mixins: [mixin] });
        expect(seen).to.deep.equal([mixin]);
    });

    it('names the linked style files above the overview, linking those with a page', () => {
        const html = BlockTheming({
            tokens: [makeToken()],
            overview: 'Intro.',
            linked: [{ label: 'a.css', href: '../a.html' }, { label: 'b.css' }]
        });
        expect(html).to.include('cdx-theming-linked');
        expect(html).to.include('<a href="../a.html"><code>a.css</code></a>');
        expect(html).to.include('<code>b.css</code>');
        expect(html.indexOf('cdx-theming-linked')).to.be.lessThan(
            html.indexOf('cdx-theming-overview')
        );
        expect(BlockTheming({ tokens: [makeToken()] })).to.not.include('cdx-theming-linked');
    });

    it('handles undefined tokens prop as empty list', () => {
        const html = BlockTheming({ tokens: undefined as any });
        expect(html).to.include('data-compodoc="block-theming"');
        expect(html).to.not.include('data-compodoc="block-theming-token"');
    });

    describe('themingTabSections config', () => {
        const twoTokens = [makeToken({ name: '--cdx-a' }), makeToken({ name: '--cdx-b' })];
        const styleSources = [
            { file: '/p/btn.scss', content: '$x: 1;', language: 'scss' as const }
        ];

        it('drops the source panel when "source" is omitted from themingTabSections', () => {
            Configuration.mainData.themingTabSections = ['overview', 'index', 'tokens'];
            const html = BlockTheming({ tokens: twoTokens, styleSources });
            expect(html).to.not.include('cdx-theming-source');
            // tokens + index still render
            expect(html).to.include('data-compodoc="block-theming-token"');
            expect(html).to.include('data-compodoc="block-theming-index"');
        });

        it('drops the index when "index" is omitted from themingTabSections', () => {
            Configuration.mainData.themingTabSections = ['overview', 'tokens', 'source'];
            const html = BlockTheming({ tokens: twoTokens, styleSources });
            expect(html).to.not.include('data-compodoc="block-theming-index"');
            expect(html).to.include('data-compodoc="block-theming-token"');
            expect(html).to.include('cdx-theming-source');
        });

        it('drops the overview when "overview" is omitted from themingTabSections', () => {
            Configuration.mainData.themingTabSections = ['index', 'tokens', 'source'];
            const html = BlockTheming({
                tokens: twoTokens,
                styleSources,
                overview: 'should not render'
            });
            expect(html).to.not.include('cdx-theming-overview');
            expect(html).to.not.include('should not render');
        });

        it('drops the token rows when "tokens" is omitted from themingTabSections', () => {
            Configuration.mainData.themingTabSections = ['overview', 'index', 'source'];
            const html = BlockTheming({ tokens: twoTokens, styleSources });
            expect(html).to.not.include('data-compodoc="block-theming-token"');
            // index still references the token names
            expect(html).to.include('data-compodoc="block-theming-index"');
        });

        it('shows everything when themingTabSections is empty (defaults apply)', () => {
            Configuration.mainData.themingTabSections = [];
            const html = BlockTheming({
                tokens: twoTokens,
                styleSources,
                overview: 'an intro'
            });
            expect(html).to.include('cdx-theming-overview');
            expect(html).to.include('data-compodoc="block-theming-index"');
            expect(html).to.include('data-compodoc="block-theming-token"');
            expect(html).to.include('cdx-theming-source');
        });
    });
});
