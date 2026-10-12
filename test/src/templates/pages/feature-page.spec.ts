import { beforeAll, describe, expect, it } from 'vitest';

import type { FeatureModel } from '../../../../src/app/compiler/semantic/features';
import {
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts
} from '../../../../src/app/compiler/semantic/model';
import { buildDiView } from '../../../../src/app/di';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable, withStyleEntries } from '../../../../src/app/links';
import type { SymbolId } from '../../../../src/app/links/symbol-id';
import { featurePages } from '../../../../src/app/page-generator/feature-page-generator';
import { emptyGuards, indexRouting, type RouteNode } from '../../../../src/app/routing';
import { themeResolver } from '../../../../src/app/run/styles';
import { buildStyleModel, hasStylePage, resolveThemes } from '../../../../src/app/styles';
import { FeaturePage } from '../../../../src/templates/pages/FeaturePage';
import { featurePage, pageOf } from '../../helpers/pages';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const SELECT = 'lib/select/src';
const engine = {
    components: [
        { name: 'SelectPanel', file: `${SELECT}/panel/panel.ts`, description: 'The panel. More.' }
    ],
    directives: [{ name: 'SelectTrigger', file: `${SELECT}/trigger/trigger.ts` }],
    injectables: [{ name: 'SelectService', file: `${SELECT}/shared/service.ts` }],
    interfaces: [{ name: 'SelectOption', file: `${SELECT}/shared/option.ts` }],
    miscellaneous: {
        functions: [
            { name: 'optionLabel', file: `${SELECT}/shared/option.ts` },
            { name: 'internalHelper', file: `${SELECT}/shared/option.ts` }
        ],
        variables: [{ name: 'MENU_DELAY', file: 'lib/select/src/menu/menu.ts' }]
    }
};

const facts = (name: string, file: string, extra: Partial<SymbolFacts> = {}): SymbolFacts => ({
    key: { name, file },
    exportedBy: ['@x/select'],
    notExported: false,
    usedBy: [],
    ...extra
});

const ROOT = '@x/select#';
const MENU = '@x/select#menu';
const FIELD = '@x/ui#field';
const features: FeatureModel = {
    features: [
        {
            id: ROOT,
            entryPoint: '@x/select',
            key: '',
            label: 'select',
            root: 'lib/select',
            detector: 'entry-point',
            readme: 'lib/select/README.md'
        },
        {
            id: MENU,
            entryPoint: '@x/select',
            key: 'menu',
            label: 'menu',
            root: 'lib/select/src/menu',
            detector: 'cohesion',
            readme: 'lib/select/src/menu/README.md'
        },
        {
            id: FIELD,
            entryPoint: '@x/ui',
            key: 'field',
            label: 'field',
            root: 'lib/ui/src/field',
            detector: 'cohesion'
        }
    ],
    featureOf: new Map([
        [`${SELECT}/panel/panel.ts#SelectPanel`, ROOT],
        [`${SELECT}/trigger/trigger.ts#SelectTrigger`, ROOT],
        [`${SELECT}/shared/service.ts#SelectService`, ROOT],
        [`type:${SELECT}/shared/option.ts#SelectOption`, ROOT],
        [`${SELECT}/shared/option.ts#optionLabel`, ROOT],
        ['lib/select/src/menu/menu.ts#MENU_DELAY', MENU]
    ]),
    families: [{ from: FIELD, to: ROOT, reason: 'wraps', edges: 2 }]
};

const semantic: SemanticModel = {
    ...emptyModel(),
    facts: new Map(
        [
            facts('SelectPanel', `${SELECT}/panel/panel.ts`),
            facts('optionLabel', `${SELECT}/shared/option.ts`, {
                di: { providesTokens: [], readsTokens: [], usesInjectionContext: 'direct' }
            }),
            facts('internalHelper', `${SELECT}/shared/option.ts`, {
                notExported: true,
                exportedBy: []
            })
        ].map(f => [factKey(f.key), f])
    ),
    features
};

const READMES: Record<string, string> = {
    'lib/select/README.md': '<h1 id="select">Select</h1><p>Pick one option.</p>',
    'lib/select/src/menu/README.md': '<p>Menu <em>parts</em>.</p><p>Second.</p>'
};

const render = (id: string, extra: Record<string, unknown> = {}): string => {
    const symbols = buildSymbolTable(engine as never, { cwd: '/' });
    const di = buildDiView(symbols, semantic);
    const pages = featurePages(semantic, symbols, di, file => READMES[file]);
    const feature = pages.find(page => page.id === id);
    const html = FeaturePage({
        feature,
        symbols,
        di,
        semantic,
        depth: feature?.segments.length,
        ...extra
    });
    // The test transform adds JSX dev attributes; the build does not.
    return html.replace(/ __(self|source)="[^"]*"/g, '');
};

const sectionIds = (html: string): string[] =>
    [...html.matchAll(/<h2 class="cdx-section-heading" id="([^"]+)"/g)].map(m => m[1]);

describe('feature page', () => {
    it('lists the members by role, each linked from the page depth', () => {
        const html = render(ROOT);
        expect(sectionIds(html)).toEqual([
            'overview',
            'features',
            'components-and-directives',
            'services',
            'utilities',
            'types',
            'extended-by'
        ]);
        expect(html).toContain(`href="../${pageOf('component', 'SelectPanel')}"`);
        expect(html).toContain(`href="../${pageOf('directive', 'SelectTrigger')}"`);
        expect(html).toContain('<td>The panel</td>');
        expect(html).toContain('cdx-badge--injection-context');
        expect(html).not.toContain('internalHelper');
    });

    it('renders the README as the overview', () => {
        const html = render(ROOT);
        expect(html).toContain(
            '<div class="cdx-readme"><h1 id="select">Select</h1><p>Pick one option.</p></div>'
        );
    });

    it('shows the import path and the detector', () => {
        const html = render(MENU);
        expect(html).toContain("<code>import { ... } from '@x/select';</code>");
        expect(html).toContain('data-cdx-feature-detector="cohesion">Detected from imports</span>');
        expect(html).toContain(`<a href="../../${featurePage(['select'])}">select</a>`);
    });

    it('omits empty sections', () => {
        const html = render(MENU);
        expect(sectionIds(html)).toEqual(['overview', 'constants']);
        expect(html).not.toContain('id="pipes"');
        expect(html).not.toContain('id="theming"');
    });

    it('lists the sub-features of an entry point with member count and README summary', () => {
        const html = render(ROOT);
        expect(html).toContain(
            `<tr data-cdx-feature-card="${MENU}"><td><a href="../${featurePage(['select', 'menu'])}"><code>menu</code></a></td><td>1</td><td>Menu <em>parts</em>.</td></tr>`
        );
        expect(render(MENU)).not.toContain('data-cdx-feature-card');
    });

    it('links the features of other entry points that extend this one', () => {
        expect(render(ROOT)).toContain(
            `<tr data-cdx-feature-related="${FIELD}"><td><a href="../${featurePage(['ui', 'field'])}"><code>field</code></a></td><td>@x/ui</td></tr>`
        );
        expect(render(MENU)).not.toContain('id="extended-by"');
    });

    it('links the features this one builds on', () => {
        const html = render(FIELD);
        expect(sectionIds(html)).toEqual(['builds-on']);
        expect(html).toContain(
            `<tr data-cdx-feature-related="${ROOT}"><td><a href="../../${featurePage(['select'])}"><code>select</code></a></td><td>@x/select</td></tr>`
        );
    });
});

describe('FeaturePage - Theming section with style files', () => {
    const KIT = '@x/kit#';
    const kitEngine = {
        components: [{ name: 'KitCard', file: 'kit/card.ts' }],
        directives: [{ name: 'KitHighlight', file: 'kit/highlight.ts' }]
    };
    const base = buildSymbolTable(kitEngine as never, { cwd: '/' });
    const styles = resolveThemes(
        buildStyleModel([
            {
                file: 'kit/theming/highlight.css',
                content:
                    '/**\n * Highlight.\n * @overview\n * @themes KitHighlight\n */\n' +
                    '/**\n * Background.\n */\n:root { --hl: 1; }\n'
            },
            {
                file: 'kit/theming/tokens.css',
                content:
                    '/**\n * Global tokens.\n * @overview\n */\n/**\n * Gap.\n */\n:root { --gap: 1px; }\n'
            }
        ]),
        themeResolver(base)
    ).model;
    const symbols = withStyleEntries(base, styles.files.filter(hasStylePage));
    const kitSemantic: SemanticModel = {
        ...emptyModel(),
        features: {
            features: [
                {
                    id: KIT,
                    entryPoint: '@x/kit',
                    key: '',
                    label: 'kit',
                    root: 'kit',
                    detector: 'entry-point'
                }
            ],
            featureOf: new Map([
                ['kit/card.ts#KitCard', KIT],
                ['kit/highlight.ts#KitHighlight', KIT],
                ['kit/theming/tokens.css#tokens', KIT]
            ]),
            families: []
        }
    };
    const renderKit = (withStyles: boolean): string => {
        const table = withStyles ? symbols : base;
        const page = featurePages(kitSemantic, table, undefined, () => undefined)[0];
        return FeaturePage({
            feature: page,
            symbols: table,
            semantic: kitSemantic,
            styles: withStyles ? styles : undefined,
            depth: page.segments.length
        }).replace(/ __(self|source)="[^"]*"/g, '');
    };

    it('lists the style pages of the feature with summary and token count', () => {
        const html = renderKit(true);
        expect(html).toMatch(
            /data-cdx-feature-member="style"><a href="[^"]*tokens\.html"><code>tokens\.css<\/code>/
        );
        expect(html).toContain('Global tokens');
        expect(html).not.toContain('id="utilities"');
    });

    it('lists a directive themed by a linked file and links the design tokens page', () => {
        const html = renderKit(true);
        expect(html).toMatch(/href="[^"]*KitHighlight\.html#theming"/);
        expect(html).toMatch(
            /class="cdx-feature-design-tokens"><a href="[^"]*design-tokens\.html"/
        );
    });

    it('renders no Theming section without style files and no themed member', () => {
        expect(renderKit(false)).not.toContain('id="theming"');
    });

    const routeNode = (id: string, fullPath: string, symbol?: string): RouteNode => ({
        id,
        path: { kind: 'literal', text: fullPath.slice(1) },
        fullPath,
        ...(symbol
            ? {
                  component: {
                      kind: 'symbol' as const,
                      name: 'SelectPanel',
                      symbol: symbol as SymbolId,
                      lazy: true,
                      source: ''
                  }
              }
            : {}),
        children: [],
        guards: emptyGuards(),
        resolve: [],
        providers: [],
        file: 'app.ts',
        line: 1
    });
    const routing = indexRouting(
        [
            {
                id: '0',
                kind: 'router',
                bootstraps: [],
                features: [],
                routes: [
                    routeNode('0-0', '/panel', `component:${SELECT}/panel/panel.ts#SelectPanel`),
                    routeNode('0-1', '/other')
                ]
            }
        ],
        []
    );

    it('lists the routes of its members, linked to their rows on the routes page', () => {
        const html = render(ROOT, { routing });
        expect(sectionIds(html)).toContain('routes');
        expect(html).toContain('href="../routes.html#route-0-0"><code>/panel</code></a>');
        expect(html).toContain('<code>SelectPanel (lazy)</code>');
        expect(html).not.toContain('/other');
    });

    it('has no routes section without routed members or with routes disabled', () => {
        expect(sectionIds(render(MENU, { routing }))).not.toContain('routes');
        expect(sectionIds(render(ROOT, { routing, disableRoutesGraph: true }))).not.toContain(
            'routes'
        );
    });
});
