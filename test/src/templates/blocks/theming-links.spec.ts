import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { BlockTheming } from '../../../../src/templates/blocks/BlockTheming';
import { DesignTokensPage } from '../../../../src/templates/pages/DesignTokensPage';
import type { StyleMixin, ThemeToken } from '../../../../src/utils/theme-doc-parser';
import { hrefTo } from '../../helpers/pages';

/**
 * `{@link}` in theming prose: token names link to the token's row on the
 * same page (rendered as code when no row has that name), everything else
 * goes through `parseDescription` like any other description.
 */

const makeToken = (overrides: Partial<ThemeToken> = {}): ThemeToken => ({
    name: '--acme-alert-bg',
    kind: 'css-custom-property',
    type: '<color>',
    defaultValue: '#fff',
    description: '',
    group: '',
    examples: [],
    since: '',
    deprecated: null,
    see: [],
    file: 'alert.css',
    line: 1,
    ...overrides
});

const makeMixin = (overrides: Partial<StyleMixin> = {}): StyleMixin =>
    ({
        name: 'alert-theme',
        kind: 'mixin',
        params: [],
        content: null,
        returns: '',
        description: '',
        examples: [],
        since: '',
        deprecated: null,
        see: [],
        relatedTo: [],
        file: 'alert.scss',
        line: 1,
        ...overrides
    }) as StyleMixin;

let componentsSnapshot: unknown;

beforeAll(() => {
    I18nEngine.init('en-US');
});

beforeEach(() => {
    componentsSnapshot = (DependenciesEngine as any).components;
    (DependenciesEngine as any).components = [{ name: 'AcmeAlert', type: 'component' }];
});

afterEach(() => {
    (DependenciesEngine as any).components = componentsSnapshot;
});

describe('theming {@link}', () => {
    const tokens = [
        makeToken(),
        makeToken({
            name: '--acme-alert-danger-bg',
            description: 'Overrides {@link --acme-alert-bg} for danger alerts.'
        })
    ];

    it('links a token name to its row on the same tab', () => {
        const html = BlockTheming({ tokens, depth: 1 });
        expect(html).toContain(
            'Overrides <a href="#theme-acme-alert-bg"><code>--acme-alert-bg</code></a> for danger alerts.'
        );
        expect(html).not.toContain('{@link');
    });

    it('keeps the label of a labelled token link', () => {
        const html = BlockTheming({
            tokens: [makeToken({ description: 'See {@link --acme-alert-bg|the base fill}.' })],
            depth: 1
        });
        expect(html).toContain('See <a href="#theme-acme-alert-bg">the base fill</a>.');
    });

    it('renders a token name without a row on the tab as code', () => {
        const html = BlockTheming({
            tokens: [makeToken({ description: 'Falls back to {@link --acme-surface}.' })],
            depth: 1
        });
        expect(html).toContain('Falls back to <code>--acme-surface</code>.');
    });

    it('resolves symbols, URLs and unknown names like other descriptions', () => {
        const html = BlockTheming({
            tokens: [
                makeToken({
                    description:
                        'Used by {@link AcmeAlert}, see {@link https://acme.dev|the guide}, not {@link Missing}.'
                })
            ],
            depth: 1
        });
        expect(html).toContain(`<a href="${hrefTo('component', 'AcmeAlert', 1)}">AcmeAlert</a>`);
        expect(html).toContain('<a href="https://acme.dev">the guide</a>');
        expect(html).toContain('<code>Missing</code>');
    });

    it('resolves links in the overview, deprecation notes and mixin descriptions', () => {
        const html = BlockTheming({
            tokens: [makeToken({ deprecated: 'Use {@link --acme-alert-bg} instead.' })],
            overview: 'Theme of {@link AcmeAlert}.',
            mixins: [makeMixin({ description: 'Sets {@link --acme-alert-bg}.' })],
            depth: 1
        });
        expect(html).toContain(
            `Theme of <a href="${hrefTo('component', 'AcmeAlert', 1)}">AcmeAlert</a>.`
        );
        expect(html).toContain(
            'Use <a href="#theme-acme-alert-bg"><code>--acme-alert-bg</code></a> instead.'
        );
        expect(html).toContain(
            'Sets <a href="#theme-acme-alert-bg"><code>--acme-alert-bg</code></a>.'
        );
    });

    it('links token names to their rows on the design tokens page', () => {
        const row = {
            id: 'token-acme-gap',
            name: '--acme-gap',
            type: '',
            defaultValue: '',
            deprecated: null,
            file: 'tokens.css'
        };
        const html = DesignTokensPage({
            depth: 0,
            groups: [
                {
                    name: '',
                    id: 'group-default',
                    tokens: [
                        { ...row, description: '' },
                        {
                            ...row,
                            id: 'token-acme-gap-lg',
                            name: '--acme-gap-lg',
                            description: 'Twice {@link --acme-gap}, see {@link AcmeAlert}.'
                        }
                    ]
                }
            ]
        });
        expect(html).toContain(
            `Twice <a href="#token-acme-gap"><code>--acme-gap</code></a>, see <a href="${hrefTo('component', 'AcmeAlert', 0)}">AcmeAlert</a>.`
        );
    });
});
