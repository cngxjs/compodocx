import { afterEach, describe, expect, it } from 'vitest';

import Configuration from '../../../src/app/configuration';
import DependenciesEngine from '../../../src/app/engines/dependencies.engine';
import { buildSymbolTable, KIND_FOLDER } from '../../../src/app/links';
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
    config.mainData.symbols = undefined;
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

    it('MiscellaneousPageGenerator.prepare adds the utilities landing page once', async () => {
        const generator = new MiscellaneousPageGenerator();
        await generator.prepare({
            functions: [{ name: 'f' }],
            variables: [],
            typealiases: [],
            enumerations: []
        });
        const landing = config.pages.filter(p => p.context === 'utilities');
        expect(landing).toHaveLength(1);
        expect(landing[0].name).toBe('utilities');
        expect(landing[0].depth).toBe(0);
    });

    it('MiscellaneousPageGenerator.prepare enqueues a page per symbol, tagged or not', async () => {
        const misc = {
            functions: [
                { name: 'provideToaster', file: 'src/toast.ts', category: 'Toast' },
                { name: 'helperFn', file: 'src/helper.ts' }
            ],
            variables: [{ name: 'TOAST_TOKEN', file: 'src/toast.ts' }],
            typealiases: [{ name: 'ToastConfig', file: 'src/toast.ts' }],
            enumerations: [{ name: 'ToastPosition', file: 'src/toast.ts' }]
        };
        config.mainData.symbols = buildSymbolTable({ miscellaneous: misc });
        await new MiscellaneousPageGenerator().prepare(misc);

        const fn = config.pages.find(p => p.filename === 'provideToaster');
        expect(fn?.path).toBe(KIND_FOLDER.function);
        expect(fn?.name).toBe('function-provideToaster');
        expect(fn?.context).toBe('function');
        expect((fn as any)?.function?.name).toBe('provideToaster');
        expect(fn?.depth).toBe(1);
        expect(config.pages.find(p => p.filename === 'helperFn')?.path).toBe(KIND_FOLDER.function);
        expect(config.pages.find(p => p.filename === 'TOAST_TOKEN')?.path).toBe(
            KIND_FOLDER.variable
        );
        expect(config.pages.find(p => p.filename === 'ToastConfig')?.context).toBe('typealias');
        expect(config.pages.find(p => p.filename === 'ToastPosition')?.path).toBe(
            KIND_FOLDER.enumeration
        );
    });

    it('MiscellaneousPageGenerator.prepare numbers same-name copies and merges overloads', async () => {
        const misc = {
            functions: [
                { name: 'pick', file: 'src/a.ts' },
                { name: 'pick', file: 'src/a.ts' },
                { name: 'pick', file: 'src/b.ts' }
            ],
            variables: [],
            typealiases: [],
            enumerations: []
        };
        config.mainData.symbols = buildSymbolTable({ miscellaneous: misc });
        await new MiscellaneousPageGenerator().prepare(misc);
        const picks = config.pages.filter(p => p.context === 'function');
        expect(picks.map(p => p.filename)).toEqual(['pick', 'pick-1']);
        expect(misc.functions[2]).not.toHaveProperty('duplicateName');
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
