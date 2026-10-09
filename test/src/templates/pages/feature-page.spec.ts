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
import { buildSymbolTable } from '../../../../src/app/links';
import { featurePages } from '../../../../src/app/page-generator/feature-page-generator';
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

const render = (id: string): string => {
    const symbols = buildSymbolTable(engine as never, { cwd: '/' });
    const di = buildDiView(symbols, semantic);
    const pages = featurePages(semantic, symbols, di, file => READMES[file]);
    const feature = pages.find(page => page.id === id);
    const html = FeaturePage({ feature, symbols, di, semantic, depth: feature?.segments.length });
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
            `<tr data-cdx-feature-card="${MENU}"><td><a href="../${featurePage(['select', 'menu'])}">menu</a></td><td>1</td><td>Menu <em>parts</em>.</td></tr>`
        );
        expect(render(MENU)).not.toContain('data-cdx-feature-card');
    });

    it('links the features of other entry points that extend this one', () => {
        expect(render(ROOT)).toContain(
            `<tr data-cdx-feature-related="${FIELD}"><td><a href="../${featurePage(['ui', 'field'])}">field</a></td><td><code>@x/ui</code></td></tr>`
        );
        expect(render(MENU)).not.toContain('id="extended-by"');
    });

    it('links the features this one builds on', () => {
        const html = render(FIELD);
        expect(sectionIds(html)).toEqual(['builds-on']);
        expect(html).toContain(
            `<tr data-cdx-feature-related="${ROOT}"><td><a href="../../${featurePage(['select'])}">select</a></td><td><code>@x/select</code></td></tr>`
        );
    });
});
