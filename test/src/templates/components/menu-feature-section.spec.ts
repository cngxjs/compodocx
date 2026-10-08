import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import { type DiView, emptyDiView } from '../../../../src/app/di/model';
import {
    clearCustomTemplates,
    registerCustomTemplate,
    renderCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { symbolId } from '../../../../src/app/links/symbol-id';
import { emptySymbolTable } from '../../../../src/app/links/symbol-table';
import { Menu } from '../../../../src/templates/components/Menu';
import { pageOf } from '../../helpers/pages';

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
    categorizedByFeature?: Record<string, any[]>;
    categorizedByFeaturePrimary?: Record<string, any[]>;
    categorizedByFeatureReference?: Record<string, any[]>;
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
    categorizedByFeature: {},
    categorizedByFeaturePrimary: {},
    categorizedByFeatureReference: {},
    ...overrides
});

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

    it('renders no Features chapter, no References link, and no per-kind chapters when feature dicts are empty', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'Foo', file: 'src/foo/foo.component.ts' }]
            })
        });
        expect(html).to.not.include('id="features-links"');
        // The References top-nav link is gated on categorizedByFeature
        // having entries — empty dict ⇒ no link.
        expect(html).to.not.include('href="references.html"');
        expect(html).to.not.include('id="components-links"');
    });

    it('Features-chapter links never carry #api (default-Info tab intent)', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'CngxToast', file: 'src/toast/toast.component.ts' }],
                categorizedByFeaturePrimary: {
                    toast: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'CngxToast',
                            file: 'src/toast/toast.component.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include(`href="${pageOf('component', 'CngxToast')}"`);
        expect(html).to.not.include(`href="${pageOf('component', 'CngxToast')}#api"`);
    });

    it('renders a Features chapter mixing primary-kind entities in one folder', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'ButtonComponent', file: 'src/button/button.component.ts' }],
                directives: [{ name: 'RippleDirective', file: 'src/button/ripple.directive.ts' }],
                injectables: [{ name: 'ButtonService', file: 'src/button/button.service.ts' }],
                categorizedByFeaturePrimary: {
                    button: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'ButtonComponent',
                            file: 'src/button/button.component.ts'
                        },
                        {
                            kind: 'directive',
                            hrefPrefix: 'directives',
                            name: 'RippleDirective',
                            file: 'src/button/ripple.directive.ts'
                        },
                        {
                            kind: 'injectable',
                            hrefPrefix: 'injectables',
                            name: 'ButtonService',
                            file: 'src/button/button.service.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include('id="features-links"');
        expect(html).to.include('id="features-group-button"');
        expect(html).to.include('data-cdx-kind="component"');
        expect(html).to.include('data-cdx-kind="directive"');
        expect(html).to.include('data-cdx-kind="injectable"');
        expect(html).to.include(`href="${pageOf('component', 'ButtonComponent')}"`);
        expect(html).to.include(`href="${pageOf('directive', 'RippleDirective')}"`);
        expect(html).to.include(`href="${pageOf('injectable', 'ButtonService')}"`);
    });

    it('renders a top-level Reference link to references.html when categorizedByFeature has entries', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                interfaces: [{ name: 'ToastConfig', file: 'src/toast/toast.types.ts' }],
                categorizedByFeature: {
                    toast: [
                        {
                            kind: 'interface',
                            hrefPrefix: 'interfaces',
                            name: 'ToastConfig',
                            file: 'src/toast/toast.types.ts'
                        }
                    ]
                }
            })
        });
        // No bucket-tree under a References chapter — the portal page
        // owns the exhaustive catalogue now.
        expect(html).to.not.include('id="references-links"');
        expect(html).to.not.include('id="references-group-toast"');
        // Top-level link to the portal page.
        expect(html).to.include('href="references.html"');
        expect(html).to.include('class="chapter references"');
    });

    it('renders only the Features chapter (References is a top-nav link, not a tree)', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'CngxToast', file: 'src/toast/toast.component.ts' }],
                interfaces: [{ name: 'ToastConfig', file: 'src/toast/toast.types.ts' }],
                categorizedByFeaturePrimary: {
                    toast: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'CngxToast',
                            file: 'src/toast/toast.component.ts'
                        }
                    ]
                },
                categorizedByFeature: {
                    toast: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'CngxToast',
                            file: 'src/toast/toast.component.ts'
                        },
                        {
                            kind: 'interface',
                            hrefPrefix: 'interfaces',
                            name: 'ToastConfig',
                            file: 'src/toast/toast.types.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include('id="features-links"');
        expect(html).to.include('id="features-group-toast"');
        // References chapter / per-bucket tree is gone.
        expect(html).to.not.include('id="references-links"');
        expect(html).to.not.include('id="references-group-toast"');
        // Top-nav Reference link points at the portal page.
        expect(html).to.include('href="references.html"');
    });

    it('honours configured featuresName label', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                featuresName: 'Building Blocks',
                components: [{ name: 'Foo', file: 'src/foo/foo.component.ts' }],
                categorizedByFeaturePrimary: {
                    foo: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'Foo',
                            file: 'src/foo/foo.component.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include('Building Blocks');
    });

    it('omits per-kind chapters when menuLayout is feature', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                components: [{ name: 'ButtonComponent', file: 'src/button/button.component.ts' }],
                categorizedByFeaturePrimary: {
                    button: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'ButtonComponent',
                            file: 'src/button/button.component.ts'
                        }
                    ]
                }
            })
        });
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
            data: baseData({
                menuLayout: 'feature',
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
                includesName: 'Guides',
                categorizedByFeaturePrimary: {
                    foo: [
                        {
                            kind: 'class',
                            hrefPrefix: 'classes',
                            name: 'Foo',
                            file: 'src/foo/foo.ts'
                        }
                    ]
                }
            })
        });
        expect(html).not.to.include('id="modules-links"');
        expect(html).to.include('id="additional-pages"');
        // Miscellaneous redundant in feature mode — everything moved into References.
        expect(html).to.not.include('id="miscellaneous-links"');
        expect(html).to.include('id="features-links"');
    });

    it('collapsedAll: true forces every chapter AND every nested folder closed', () => {
        Configuration.mainData.toggleMenuItems = ['features', 'references', 'miscellaneous'];
        Configuration.mainData.collapsedAll = true;
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                groupDepth: 4,
                categorizedByFeaturePrimary: {
                    'features/admin-settings': [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'SettingsComponent',
                            file: 'src/features/admin-settings/settings.component.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.not.match(/class="links collapse in"/);
        expect(html).to.not.include('aria-expanded="true"');
        expect(html).to.include('id="features-links"');
        expect(html).to.include('id="features-group-features"');
    });

    it('collapsedAll: false (default) keeps existing toggleMenuItems / groupDepth behaviour', () => {
        Configuration.mainData.toggleMenuItems = ['features'];
        Configuration.mainData.collapsedAll = false;
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                groupDepth: 2,
                categorizedByFeaturePrimary: {
                    button: [
                        {
                            kind: 'component',
                            hrefPrefix: 'components',
                            name: 'ButtonComponent',
                            file: 'src/button/button.component.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include('class="links collapse in"');
    });

    // Note: reference-kind misc symbols (untagged + tagged functions /
    // variables / typealiases / enumerations) are no longer in the
    // sidebar at all — the References tree was replaced by a single
    // top-nav link to `references.html`. The portal page is responsible
    // for rendering these items; its anchor URLs are exercised by the
    // Playwright `menu-layout.spec.ts` and unit-tested in
    // `api-reference-page-generator.spec.ts`. The Menu tests below stay
    // focused on the Features chapter (curated primary-kinds only) and
    // the presence/absence of the top-nav link itself.

    it('@docsKind primary on a function promotes it into Features chapter', () => {
        const html = Menu({
            data: baseData({
                menuLayout: 'feature',
                miscellaneous: {
                    functions: [
                        { name: 'provideFeedback', category: 'ui/feedback', docsKind: 'primary' }
                    ]
                },
                categorizedByFeaturePrimary: {
                    'ui/feedback': [
                        {
                            kind: 'function',
                            hrefPrefix: 'miscellaneous/functions',
                            name: 'provideFeedback',
                            category: 'ui/feedback',
                            docsKind: 'primary',
                            file: 'src/feedback/providers.ts'
                        }
                    ]
                }
            })
        });
        expect(html).to.include('id="features-links"');
        // Function still renders with its kind icon — promotion changes
        // chapter membership, not the per-item visual.
        expect(html).to.include('data-cdx-kind="function"');
    });

    // (Reference-kind misc walk tests removed; the surface they covered
    // now lives on the references.html portal — see the comment block
    // above and the api-reference-page-generator unit spec.)

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
        const primary = {
            toast: [
                {
                    kind: 'component',
                    hrefPrefix: 'components',
                    name: 'CngxToast',
                    file: 'src/toast/toast.component.ts'
                }
            ]
        };
        const data = (symbols: object) =>
            baseData({
                menuLayout: 'feature',
                categorizedByFeaturePrimary: primary,
                symbols: symbols as never
            });
        const run = emptySymbolTable();

        const open = Menu({ data: data(run) });
        expect(open).to.include(`href="${pageOf('component', 'CngxToast')}"`);
        expect(open).to.include('class="links collapse in" id="features-links"');
        expect(Menu({ data: data(run) })).to.equal(open);

        Configuration.mainData.collapsedAll = true;
        expect(Menu({ data: data(run) })).to.include('class="links collapse" id="features-links"');
        Configuration.mainData.collapsedAll = false;

        primary.toast[0].name = 'CngxToaster';
        expect(Menu({ data: data(run) })).to.equal(open);
        expect(Menu({ data: data(emptySymbolTable()) })).to.include(
            `href="${pageOf('component', 'CngxToaster')}"`
        );
    });

    it('honours the menu custom-template override regardless of layout', () => {
        registerCustomTemplate(
            'menu',
            (data: any) => `<nav data-cdx-custom-menu="1">${data.menuLayout}</nav>`
        );
        const html = renderCustomTemplate('menu', {
            menuLayout: 'feature',
            categorizedByFeature: {},
            categorizedByFeaturePrimary: {},
            categorizedByFeatureReference: {}
        });
        expect(html).to.equal('<nav data-cdx-custom-menu="1">feature</nav>');
    });
});
