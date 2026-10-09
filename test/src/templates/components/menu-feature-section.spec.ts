import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FeatureModel } from '../../../../src/app/compiler/semantic/features';
import { emptyModel } from '../../../../src/app/compiler/semantic/model';
import Configuration from '../../../../src/app/configuration';
import { type DiView, emptyDiView } from '../../../../src/app/di/model';
import {
    clearCustomTemplates,
    registerCustomTemplate,
    renderCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { symbolId } from '../../../../src/app/links/symbol-id';
import { buildSymbolTable, emptySymbolTable } from '../../../../src/app/links/symbol-table';
import { Menu } from '../../../../src/templates/components/Menu';
import { clusterPage, featurePage, pageOf, rootPage } from '../../helpers/pages';

beforeAll(() => {
    I18nEngine.init('en-US');
});

interface MenuDataFixture {
    components?: any[];
    directives?: any[];
    injectables?: any[];
    pipes?: any[];
    classes?: any[];
    interfaces?: any[];
    guards?: any[];
    interceptors?: any[];
    entities?: any[];
    modules?: any[];
    menuLayout?: 'type' | 'feature';
    groupDepth?: number;
    [key: string]: unknown;
}

const baseData = (overrides: Partial<MenuDataFixture>): MenuDataFixture => ({
    modules: [],
    components: [],
    directives: [],
    injectables: [],
    pipes: [],
    classes: [],
    interfaces: [],
    guards: [],
    interceptors: [],
    entities: [],
    miscellaneous: null,
    additionalPages: [],
    appConfig: [],
    routes: null,
    disableRoutesGraph: true,
    disableCoverage: true,
    disableOverview: true,
    disableDependencies: true,
    disableProperties: true,
    hideGenerator: true,
    groupDepth: 2,
    menuLayout: 'type',
    featuresName: '',
    referencesName: '',
    ...overrides
});

interface FeatureFixture {
    readonly id: string;
    readonly entryPoint?: string;
    readonly key: string;
    readonly label: string;
    /** Fact keys of the members (`file#name`, `type:file#name` for interfaces). */
    readonly members: readonly string[];
}

/** Menu data in the feature layout: engine lists, their symbol table and a feature model. */
const featureData = (
    engine: Partial<MenuDataFixture>,
    features: readonly FeatureFixture[],
    overrides: Partial<MenuDataFixture> = {}
): MenuDataFixture => {
    const model: FeatureModel = {
        features: features.map(f => ({
            id: f.id,
            entryPoint: f.entryPoint,
            key: f.key,
            label: f.label,
            root: '',
            detector: f.key ? 'cohesion' : 'entry-point'
        })),
        featureOf: new Map(features.flatMap(f => f.members.map(m => [m, f.id] as const))),
        families: []
    };
    return baseData({
        menuLayout: 'feature',
        ...engine,
        symbols: buildSymbolTable(engine as never, { cwd: '/' }) as never,
        semantic: { ...emptyModel(), features: model },
        ...overrides
    });
};

const BUTTON = {
    components: [{ name: 'ButtonComponent', file: 'lib/button/button.component.ts' }],
    directives: [{ name: 'RippleDirective', file: 'lib/button/ripple.directive.ts' }],
    injectables: [{ name: 'ButtonService', file: 'lib/button/button.service.ts' }],
    interfaces: [{ name: 'ButtonConfig', file: 'lib/button/button.types.ts' }]
};
const BUTTON_FEATURE: FeatureFixture = {
    id: '@x/ui/button#',
    entryPoint: '@x/ui/button',
    key: '',
    label: 'button',
    members: [
        'lib/button/button.component.ts#ButtonComponent',
        'lib/button/ripple.directive.ts#RippleDirective',
        'lib/button/button.service.ts#ButtonService',
        'type:lib/button/button.types.ts#ButtonConfig'
    ]
};

describe('Menu — feature layout', () => {
    const originalToggle = Configuration.mainData.toggleMenuItems;
    const originalCollapsedAll = Configuration.mainData.collapsedAll;

    beforeEach(() => {
        Configuration.mainData.toggleMenuItems = ['features', 'references'];
        Configuration.mainData.collapsedAll = false;
    });

    afterEach(() => {
        Configuration.mainData.toggleMenuItems = originalToggle;
        Configuration.mainData.collapsedAll = originalCollapsedAll;
        clearCustomTemplates();
    });

    it('renders no Features chapter, no References link and no per-kind chapters without features', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'Foo', file: 'src/foo/foo.component.ts' }]
            })
        });
        expect(html).to.not.include('id="features-links"');
        expect(html).to.not.include('href="references.html"');
        expect(html).to.not.include('id="components-links"');
    });

    it('nests entry points by import path and lists the primary members of each feature', () => {
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE]) });
        expect(html).to.include('id="features-links"');
        expect(html).to.include('id="features-group-ui"');
        expect(html).to.include('id="features-group-ui/button"');
        expect(html).to.include(`href="${featurePage(['ui', 'button'])}"`);
        expect(html).to.include(`href="${pageOf('component', 'ButtonComponent')}"`);
        expect(html).to.include(`href="${pageOf('directive', 'RippleDirective')}"`);
        expect(html).to.include(`href="${pageOf('injectable', 'ButtonService')}"`);
        expect(html).to.not.include(`href="${pageOf('interface', 'ButtonConfig')}"`);
        // `ui` has no feature page of its own: a plain label.
        expect(html).to.match(
            /<span class="cdx-bucket-link"[^>]*><span class="link-name"[^>]*>Ui</
        );
    });

    it('lists the whole surface of a feature without primary members', () => {
        const engine = {
            miscellaneous: { functions: [{ name: 'formatDate', file: 'lib/format/date.ts' }] }
        };
        const html = Menu({
            data: featureData(engine, [
                {
                    id: '@x/format#',
                    entryPoint: '@x/format',
                    key: '',
                    label: 'format',
                    members: ['lib/format/date.ts#formatDate']
                }
            ])
        });
        expect(html).to.include('data-cdx-kind="function"');
        expect(html).to.include(`href="${pageOf('function', 'formatDate')}"`);
    });

    it('lists an app root feature first', () => {
        const engine = {
            components: [
                { name: 'AppComponent', file: 'src/app/app.component.ts' },
                { name: 'AdminComponent', file: 'src/app/admin/admin.component.ts' }
            ]
        };
        const html = Menu({
            data: featureData(engine, [
                {
                    id: '#admin',
                    key: 'admin',
                    label: 'admin',
                    members: ['src/app/admin/admin.component.ts#AdminComponent']
                },
                {
                    id: '#',
                    key: '',
                    label: 'shop',
                    members: ['src/app/app.component.ts#AppComponent']
                }
            ])
        });
        expect(html.indexOf('data-cdx-bucket="shop"')).to.be.lessThan(
            html.indexOf('data-cdx-bucket="admin"')
        );
    });

    it('Features-chapter links never carry #api (default-Info tab intent)', () => {
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE]) });
        expect(html).to.not.include(`href="${pageOf('component', 'ButtonComponent')}#api"`);
    });

    it('renders a top-level Reference link to references.html, no References tree', () => {
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE]) });
        expect(html).to.not.include('id="references-links"');
        expect(html).to.include('href="references.html"');
        expect(html).to.include('class="chapter references"');
    });

    it('honours configured featuresName label', () => {
        const html = Menu({
            data: featureData(BUTTON, [BUTTON_FEATURE], { featuresName: 'Building Blocks' })
        });
        expect(html).to.include('Building Blocks');
    });

    it('omits per-kind chapters when menuLayout is feature', () => {
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE]) });
        expect(html).to.not.include('id="components-links"');
        expect(html).to.not.include('id="directives-links"');
    });

    it('keeps per-kind chapters in type layout (backward compat)', () => {
        const html = Menu({
            data: baseData({
                components: [{ name: 'ButtonComponent', file: 'src/button/button.component.ts' }],
                categorizedComponents: {}
            })
        });
        expect(html).to.include('id="components-links"');
        expect(html).to.not.include('id="features-links"');
        expect(html).to.not.include('id="references-links"');
    });

    it('emits the Additional Pages chapter but no Modules chapter in feature mode, hides Miscellaneous', () => {
        const html = Menu({
            data: featureData(BUTTON, [BUTTON_FEATURE], {
                miscellaneous: { variables: [{ name: 'X' }] },
                additionalPages: [
                    {
                        name: 'Guide',
                        path: 'guides',
                        filename: 'guide',
                        depth: 1,
                        children: []
                    }
                ],
                includesName: 'Guides'
            })
        });
        expect(html).not.to.include('id="modules-links"');
        expect(html).to.include('id="additional-pages"');
        expect(html).to.not.include('id="miscellaneous-links"');
        expect(html).to.include('id="features-links"');
    });

    it('collapsedAll: true forces every chapter AND every nested folder closed', () => {
        Configuration.mainData.toggleMenuItems = ['features', 'references', 'miscellaneous'];
        Configuration.mainData.collapsedAll = true;
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE], { groupDepth: 4 }) });
        expect(html).to.not.match(/class="links collapse in"/);
        expect(html).to.not.include('aria-expanded="true"');
        expect(html).to.include('id="features-links"');
        expect(html).to.include('id="features-group-ui"');
    });

    it('collapsedAll: false (default) keeps existing toggleMenuItems / groupDepth behaviour', () => {
        Configuration.mainData.toggleMenuItems = ['features'];
        Configuration.mainData.collapsedAll = false;
        const html = Menu({ data: featureData(BUTTON, [BUTTON_FEATURE]) });
        expect(html).to.include('class="links collapse in"');
    });

    it('drops hidden symbols and follows a rebuilt DI view over the same lists', () => {
        const file = 'src/hidden/hidden.component.ts';
        const components = [
            { name: 'Shown', file: 'src/shown/shown.component.ts' },
            { name: 'Hidden', file }
        ];
        const id = symbolId({ kind: 'component', file, name: 'Hidden' });
        const hiding: DiView = {
            ...emptyDiView(),
            hidden: [id],
            placement: new Map([[id, { type: 'hidden' }]])
        };
        const data = (di: DiView) =>
            baseData({ components, di, symbols: emptySymbolTable() as unknown as never });
        Configuration.mainData.toggleMenuItems = ['components'];

        const first = Menu({ data: data(hiding) });
        expect(first).to.include(`href="${pageOf('component', 'Shown')}"`);
        expect(first).to.not.include(`href="${pageOf('component', 'Hidden')}"`);
        expect(Menu({ data: data(hiding) })).to.equal(first);

        const rebuilt = Menu({ data: data({ ...hiding, hidden: [], placement: new Map() }) });
        expect(rebuilt).to.include(`href="${pageOf('component', 'Hidden')}"`);
    });

    it('reuses the Features chapter within a run and follows collapsedAll and a new crawl', () => {
        const run = featureData(BUTTON, [BUTTON_FEATURE]);
        const open = Menu({ data: run });
        expect(open).to.include(`href="${pageOf('component', 'ButtonComponent')}"`);
        expect(open).to.include('class="links collapse in" id="features-links"');
        expect(Menu({ data: run })).to.equal(open);

        Configuration.mainData.collapsedAll = true;
        expect(Menu({ data: run })).to.include('class="links collapse" id="features-links"');
        Configuration.mainData.collapsedAll = false;

        const renamed = {
            ...BUTTON,
            components: [{ name: 'ButtonBase', file: 'lib/button/button.component.ts' }]
        };
        const next = featureData(renamed, [
            {
                ...BUTTON_FEATURE,
                members: [...BUTTON_FEATURE.members, 'lib/button/button.component.ts#ButtonBase']
            }
        ]);
        expect(Menu({ data: next })).to.include(`href="${pageOf('component', 'ButtonBase')}"`);
    });

    it('renders a Dependency Injection chapter with feature type pages, providers and tokens', () => {
        const file = 'src/foo.ts';
        const symbols = buildSymbolTable(
            {
                interfaces: [{ name: 'FooFeature', file }],
                tokens: [{ name: 'FOO_CONFIG', file }],
                miscellaneous: { functions: [{ name: 'provideLimit', file }] }
            },
            { cwd: '/' }
        );
        const owner = symbolId({ kind: 'interface', file, name: 'FooFeature' });
        const plain = symbolId({ kind: 'function', file, name: 'provideLimit' });
        const di: DiView = {
            ...emptyDiView(),
            clusters: [{ owner, providers: [], features: [], tokens: [] }],
            plainProviders: [plain],
            placement: new Map([
                [owner, { type: 'cluster-owner' }],
                [plain, { type: 'provider' }]
            ])
        };
        Configuration.mainData.toggleMenuItems = ['dependency-injection'];
        const html = Menu({
            data: baseData({
                tokens: [{ name: 'FOO_CONFIG', file }],
                interfaces: [{ name: 'FooFeature', file }],
                di,
                symbols: symbols as never
            })
        });
        expect(html).to.include('id="dependency-injection-links"');
        expect(html).to.include('class="links collapse in" id="dependency-injection-links"');
        expect(html).to.include(`href="${rootPage('dependency-injection')}"`);
        expect(html).to.include(`href="${clusterPage('FooFeature')}"`);
        expect(html).to.include(`href="${pageOf('provider', 'provideLimit')}"`);
        expect(html).to.include(`href="${pageOf('token', 'FOO_CONFIG')}"`);
        expect(html).to.not.include('id="tokens-links"');
        // The feature type has no interface page of its own.
        expect(html).to.not.include(`href="${pageOf('interface', 'FooFeature')}"`);
    });

    it('honours the menu custom-template override regardless of layout', () => {
        registerCustomTemplate(
            'menu',
            (data: any) => `<nav data-cdx-custom-menu="1">${data.menuLayout}</nav>`
        );
        const html = renderCustomTemplate('menu', { menuLayout: 'feature' });
        expect(html).to.equal('<nav data-cdx-custom-menu="1">feature</nav>');
    });
});
