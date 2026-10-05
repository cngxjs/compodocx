import { afterEach, describe, expect, it } from 'vitest';

import Configuration from '../../../src/app/configuration';
import DependenciesEngine from '../../../src/app/engines/dependencies.engine';
import {
    AdditionalPageGenerator,
    AppConfigPageGenerator,
    ClassPageGenerator,
    ComponentPageGenerator,
    CoveragePageGenerator,
    copyAssetsFolder,
    copyResources,
    DirectivePageGenerator,
    EntityPageGenerator,
    finalizeOutput,
    GuardPageGenerator,
    InjectablePageGenerator,
    InterceptorPageGenerator,
    InterfacePageGenerator,
    MiscellaneousPageGenerator,
    NavTabsResolver,
    OverviewPageGenerator,
    PackageDependenciesPageGenerator,
    PageWriter,
    PipePageGenerator,
    PlaygroundFileResolver,
    RoutesPageGenerator
} from '../../../src/app/page-generator';

const config = Configuration;

function clearState() {
    config.resetPages();
    config.resetAdditionalPages();
    config.mainData.miscellaneous = {
        variables: [],
        functions: [],
        typealiases: [],
        enumerations: [],
        groupedVariables: [],
        groupedFunctions: [],
        groupedEnumerations: [],
        groupedTypeAliases: []
    };
    config.mainData.playgroundFiles = {};
    (DependenciesEngine as any).appConfig = [];
}

describe('page-generator — orchestrator wiring', () => {
    afterEach(clearState);

    it('barrel re-exports every generator class and output function', () => {
        const exported = [
            AdditionalPageGenerator,
            AppConfigPageGenerator,
            ClassPageGenerator,
            ComponentPageGenerator,
            CoveragePageGenerator,
            copyAssetsFolder,
            copyResources,
            DirectivePageGenerator,
            EntityPageGenerator,
            finalizeOutput,
            GuardPageGenerator,
            InjectablePageGenerator,
            InterceptorPageGenerator,
            InterfacePageGenerator,
            MiscellaneousPageGenerator,
            NavTabsResolver,
            OverviewPageGenerator,
            PackageDependenciesPageGenerator,
            PageWriter,
            PipePageGenerator,
            PlaygroundFileResolver,
            RoutesPageGenerator
        ];
        for (const cls of exported) {
            expect(typeof cls).toBe('function');
        }
    });

    it('NavTabsResolver resolves a non-empty tab list for a pipe-shaped dep', () => {
        const navTabs = new NavTabsResolver();
        config.mainData.navTabConfig = [];
        config.mainData.disablePlaygroundTab = false;
        const tabs = navTabs.resolve({ type: 'pipe', readme: '', exampleUrls: null });
        expect(Array.isArray(tabs)).toBe(true);
        expect(tabs.length).toBeGreaterThan(0);
    });

    it('PipePageGenerator.prepare populates Configuration.mainData.pipes and adds a page', async () => {
        const navTabs = new NavTabsResolver();
        config.mainData.navTabConfig = [];
        const generator = new PipePageGenerator(navTabs);
        await generator.prepare([
            { name: 'MyPipe', id: 'mypipe', file: '/tmp/x.ts', isDuplicate: false }
        ]);
        expect(config.mainData.pipes).toHaveLength(1);
        expect(config.pages.some(p => p.context === 'pipe')).toBe(true);
    });

    it('ClassPageGenerator.prepare populates Configuration.mainData.classes', async () => {
        const navTabs = new NavTabsResolver();
        config.mainData.navTabConfig = [];
        const generator = new ClassPageGenerator(navTabs);
        await generator.prepare([
            { name: 'MyClass', id: 'myclass', file: '/tmp/y.ts', isDuplicate: false }
        ]);
        expect(config.mainData.classes).toHaveLength(1);
        expect(config.pages.some(p => p.context === 'class')).toBe(true);
    });

    it('AppConfigPageGenerator.prepare is a no-op when DependenciesEngine.appConfig is empty', async () => {
        (DependenciesEngine as any).appConfig = [];
        const generator = new AppConfigPageGenerator();
        await generator.prepare();
        expect(config.pages.some(p => p.context === 'app-config')).toBe(false);
    });

    it('AppConfigPageGenerator.prepare adds the app-config page when DependenciesEngine.appConfig is non-empty', async () => {
        (DependenciesEngine as any).appConfig = [{ name: 'AppConfig' }];
        const generator = new AppConfigPageGenerator();
        await generator.prepare();
        expect(config.pages.some(p => p.context === 'app-config')).toBe(true);
    });

    it('MiscellaneousPageGenerator.prepare adds zero subpages on an empty misc object', async () => {
        const navTabs = new NavTabsResolver();
        config.mainData.navTabConfig = [];
        const generator = new MiscellaneousPageGenerator();
        await generator.prepare({
            functions: [],
            variables: [],
            typealiases: [],
            enumerations: []
        });
        expect(config.pages.some(p => p.path === 'miscellaneous')).toBe(false);
    });

    it('MiscellaneousPageGenerator.prepare adds the functions subpage when only functions exist', async () => {
        const generator = new MiscellaneousPageGenerator();
        await generator.prepare({
            functions: [{ name: 'f' }],
            variables: [],
            typealiases: [],
            enumerations: []
        });
        const miscPages = config.pages.filter(p => p.path === 'miscellaneous');
        expect(miscPages).toHaveLength(1);
        expect(miscPages[0].name).toBe('functions');
    });

    it('MiscellaneousPageGenerator.prepare enqueues a detail page per @category-tagged entry', async () => {
        const generator = new MiscellaneousPageGenerator();
        await generator.prepare({
            functions: [{ name: 'provideToaster', category: 'Toast' }, { name: 'helperFn' }],
            variables: [{ name: 'TOAST_TOKEN', category: 'Toast' }],
            typealiases: [{ name: 'ToastConfig', category: 'Toast' }],
            enumerations: [{ name: 'ToastPosition', category: 'Toast' }]
        });

        const detailPages = config.pages.filter(
            p => p.context?.startsWith('miscellaneous-') && p.filename
        );
        expect(detailPages).toHaveLength(4);

        const fn = config.pages.find(p => p.filename === 'provideToaster');
        expect(fn?.path).toBe('miscellaneous/functions');
        expect(fn?.context).toBe('miscellaneous-function');
        expect((fn as any)?.function?.name).toBe('provideToaster');
        expect(fn?.depth).toBe(2);

        const varPage = config.pages.find(p => p.filename === 'TOAST_TOKEN');
        expect(varPage?.path).toBe('miscellaneous/variables');
        expect(varPage?.context).toBe('miscellaneous-variable');

        const ta = config.pages.find(p => p.filename === 'ToastConfig');
        expect(ta?.path).toBe('miscellaneous/typealiases');
        expect(ta?.context).toBe('miscellaneous-typealias');

        const en = config.pages.find(p => p.filename === 'ToastPosition');
        expect(en?.path).toBe('miscellaneous/enumerations');
        expect(en?.context).toBe('miscellaneous-enumeration');

        expect(config.pages.find(p => p.filename === 'helperFn')).toBeUndefined();
    });

    it('MiscellaneousPageGenerator.prepare treats whitespace-only category as untagged', async () => {
        const generator = new MiscellaneousPageGenerator();
        await generator.prepare({
            functions: [{ name: 'whitespace', category: '   ' }],
            variables: [],
            typealiases: [],
            enumerations: []
        });
        expect(config.pages.some(p => p.filename === 'whitespace')).toBe(false);
    });

    it('PlaygroundFileResolver.resolve leaves playgroundFiles empty when no entity has @playground blocks', () => {
        config.mainData.components = [];
        config.mainData.directives = [];
        config.mainData.injectables = [];
        config.mainData.guards = [];
        config.mainData.interceptors = [];
        config.mainData.pipes = [];
        config.mainData.classes = [];
        config.mainData.interfaces = [];
        config.mainData.entities = [];
        const resolver = new PlaygroundFileResolver();
        resolver.resolve();
        expect(config.mainData.playgroundFiles).toEqual({});
    });
});
