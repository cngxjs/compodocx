import { COMPODOC_DEFAULTS } from '../utils/defaults';
import {
    DEFAULT_FEATURE_CONTAINERS,
    DEFAULT_FEATURE_UTILITY_FOLDERS
} from './compiler/semantic/features';
import { isMovedPage } from './di/model';

import {
    STACKBLITZ_DEP_DEPTH,
    STACKBLITZ_FILE_CAP,
    STACKBLITZ_FILE_COUNT_CAP,
    STACKBLITZ_VENDOR_TOTAL_CAP
} from './engines/stackblitz/constants';
import type { ConfigurationInterface } from './interfaces/configuration.interface';
import type { CoverageData } from './interfaces/coverageData.interface';
import type { MainDataInterface } from './interfaces/main-data.interface';
import type { PageInterface } from './interfaces/page.interface';

export class Configuration implements ConfigurationInterface {
    private _pages: PageInterface[] = [];
    private readonly _mainData: MainDataInterface = {
        output: COMPODOC_DEFAULTS.folder,
        theme: COMPODOC_DEFAULTS.theme,
        extTheme: '',
        customThemePath: '',
        shikiTheme: '',
        serve: false,
        hostname: COMPODOC_DEFAULTS.hostname,
        host: '',
        port: COMPODOC_DEFAULTS.port,
        open: false,
        assetsFolder: '',
        documentationMainName: COMPODOC_DEFAULTS.title,
        documentationMainDescription: '',
        base: COMPODOC_DEFAULTS.base,
        hideGenerator: false,
        hideDarkModeToggle: false,
        hasFilesToCoverage: false,
        modules: [],
        readme: false,
        changelog: '',
        contributing: '',
        license: '',
        todo: '',
        markdowns: [],
        additionalPages: [],
        pipes: [],
        classes: [],
        interfaces: [],
        components: [],
        entities: [],
        directives: [],
        injectables: [],
        tokens: [],
        interceptors: [],
        guards: [],
        miscellaneous: {
            variables: [],
            functions: [],
            typealiases: [],
            enumerations: []
        },
        routes: [],
        tsconfig: '',
        toggleMenuItems: COMPODOC_DEFAULTS.toggleMenuItems,
        navTabConfig: [],
        templates: '',
        includes: '',
        includesName: COMPODOC_DEFAULTS.additionalEntryName,
        includesFolder: COMPODOC_DEFAULTS.additionalEntryPath,
        disableSourceCode: COMPODOC_DEFAULTS.disableSourceCode,
        disableDomTree: COMPODOC_DEFAULTS.disableDomTree,
        disableTemplateTab: COMPODOC_DEFAULTS.disableTemplateTab,
        disableStyleTab: COMPODOC_DEFAULTS.disableStyleTab,
        disableGraph: COMPODOC_DEFAULTS.disableGraph,
        disableCoverage: COMPODOC_DEFAULTS.disableCoverage,
        disablePrivate: COMPODOC_DEFAULTS.disablePrivate,
        disableInternal: COMPODOC_DEFAULTS.disableInternal,
        disableProtected: COMPODOC_DEFAULTS.disableProtected,
        disableLifeCycleHooks: COMPODOC_DEFAULTS.disableLifeCycleHooks,
        disableConstructors: COMPODOC_DEFAULTS.disableConstructors,
        disableRoutesGraph: COMPODOC_DEFAULTS.disableRoutesGraph,
        disableSearch: false,
        disableDependencies: COMPODOC_DEFAULTS.disableDependencies,
        disableDependenciesTab: COMPODOC_DEFAULTS.disableDependenciesTab,
        disablePlaygroundTab: COMPODOC_DEFAULTS.disablePlaygroundTab,
        strictPlaygrounds: COMPODOC_DEFAULTS.strictPlaygrounds,
        disableProperties: COMPODOC_DEFAULTS.disableProperties,
        disableFilePath: COMPODOC_DEFAULTS.disableFilePath,
        disableOverview: COMPODOC_DEFAULTS.disableOverview,
        showEffects: COMPODOC_DEFAULTS.showEffects,
        watch: false,
        dependencyGraph: { nodes: [], edges: [] },
        entityIndex: {},
        coverageTest: false,
        coverageTestThreshold: COMPODOC_DEFAULTS.defaultCoverageThreshold,
        coverageTestThresholdFail: COMPODOC_DEFAULTS.coverageTestThresholdFail,
        coverageTestPerFile: false,
        coverageMinimumPerFile: COMPODOC_DEFAULTS.defaultCoverageMinimumPerFile,
        unitTestCoverage: '',
        unitTestData: undefined,
        coverageTestShowOnlyFailed: COMPODOC_DEFAULTS.coverageTestShowOnlyFailed,
        routesLength: 0,
        angularVersion: '',
        hasZoneJs: true,
        exportFormat: COMPODOC_DEFAULTS.exportFormat,
        jsonIndent: COMPODOC_DEFAULTS.jsonIndent,
        multiVersion: COMPODOC_DEFAULTS.multiVersion,
        versionLabel: '',
        versionsRoot: '',
        maxVersionsShown: COMPODOC_DEFAULTS.maxVersionsShown,
        outputProvided: false,
        coverageData: {} as CoverageData,
        customFavicon: '',
        customLogo: '',
        packageDependencies: [],
        packagePeerDependencies: [],
        packageProperties: {},
        gaID: '',
        angularProject: false,
        language: COMPODOC_DEFAULTS.language,
        maxSearchResults: 15,
        publicApiOnly: '',
        publicApiExports: new Map<string, Set<string>>(),
        infoTabSections: [],
        apiTabSections: [],
        themingTabSections: [],
        stackblitz: false,
        stackblitzTemplate: '',
        workspacePackage: {},
        playgroundDependencies: {},
        playgroundMaterialShell: false,
        playgroundDepDepth: STACKBLITZ_DEP_DEPTH,
        playgroundFileCountCap: STACKBLITZ_FILE_COUNT_CAP,
        playgroundFileCap: STACKBLITZ_FILE_CAP,
        playgroundHead: [],
        playgroundGlobalStyles: '',
        playgroundVendor: [],
        playgroundVendorRoot: 'dist',
        playgroundVendorCap: STACKBLITZ_VENDOR_TOTAL_CAP,
        playgroundVendorIncludeSourcemaps: false,
        playgroundVendorPackages: {},
        playgroundFiles: {},
        appConfig: [],
        menuLayout: 'feature',
        featureLibraryScope: 'auto',
        features: {},
        featureContainers: [...DEFAULT_FEATURE_CONTAINERS],
        featureUtilityFolders: [...DEFAULT_FEATURE_UTILITY_FOLDERS],
        featuresName: 'Features',
        referencesName: 'References',
        collapsedAll: false,
        generatedAt: ''
    };

    private static instance: Configuration;
    private constructor() {}
    public static getInstance() {
        if (!Configuration.instance) {
            Configuration.instance = new Configuration();
        }
        return Configuration.instance;
    }

    /** Queue a page; a symbol that reaches no entry point or lives on a DI page gets none here. */
    public addPage(page: PageInterface) {
        if (isMovedPage(page as never, this.mainData.di)) {
            return;
        }
        const indexPage = this._pages.findIndex(p => p.name === page.name);
        if (indexPage === -1) {
            this._pages.push(page);
        }
    }

    public hasPage(name: string): boolean {
        const indexPage = this._pages.findIndex(p => p.name === name);
        return indexPage !== -1;
    }

    public addAdditionalPage(page: PageInterface) {
        this._mainData.additionalPages.push(page);
    }

    public getAdditionalPageById(id): PageInterface {
        return this._mainData.additionalPages.find(page => page.id === id);
    }

    public resetPages() {
        this._pages = [];
    }

    public resetAdditionalPages() {
        this._mainData.additionalPages = [];
    }

    public resetRootMarkdownPages() {
        let indexPage = this._pages.findIndex(p => p.name === 'index');
        this._pages.splice(indexPage, 1);
        indexPage = this._pages.findIndex(p => p.name === 'changelog');
        this._pages.splice(indexPage, 1);
        indexPage = this._pages.findIndex(p => p.name === 'contributing');
        this._pages.splice(indexPage, 1);
        indexPage = this._pages.findIndex(p => p.name === 'license');
        this._pages.splice(indexPage, 1);
        indexPage = this._pages.findIndex(p => p.name === 'todo');
        this._pages.splice(indexPage, 1);
        this._mainData.markdowns = [];
    }

    get pages(): PageInterface[] {
        return this._pages;
    }
    set pages(_pages: PageInterface[]) {
        this._pages = [];
    }

    get markDownPages() {
        return this._pages.filter(page => page.markdown);
    }

    get mainData(): MainDataInterface {
        return this._mainData;
    }
    set mainData(data: MainDataInterface) {
        (Object as any).assign(this._mainData, data);
    }
}

export default Configuration.getInstance();
