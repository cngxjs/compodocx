import { COMPODOC_DEFAULTS } from '../utils/defaults';
import { DEFAULT_MENU_FEATURE_SECTIONS } from '../utils/menu-feature-sections';
import {
    DEFAULT_FEATURE_CONTAINERS,
    DEFAULT_FEATURE_ROLE_FOLDERS,
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
import { pageFile } from './links/layout';

/** Root-relative file a page is written to: its folder and file name (its name without one). */
export const pageOutputPath = (page: PageInterface): string =>
    pageFile(page.path ?? '', page.filename || page.name);

/** Root pages built from the project markdown files; README is written as `index`. */
const ROOT_MARKDOWN_PAGE_NAMES: ReadonlySet<string> = new Set([
    'index',
    'changelog',
    'contributing',
    'license',
    'todo'
]);

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
        hideGenerator: false,
        hideDarkModeToggle: false,
        hasFilesToCoverage: false,
        readme: false,
        changelog: '',
        contributing: '',
        license: '',
        todo: '',
        markdowns: [],
        additionalPages: [],
        additionalAliases: [],
        pipes: [],
        classes: [],
        interfaces: [],
        components: [],
        entities: [],
        directives: [],
        injectables: [],
        services: [],
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
        includesLabels: '',
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
        disableRoutes: COMPODOC_DEFAULTS.disableRoutes,
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
        entityIndex: {},
        coverageTest: false,
        coverageTestThreshold: COMPODOC_DEFAULTS.defaultCoverageThreshold,
        coverageTestThresholdFail: COMPODOC_DEFAULTS.coverageTestThresholdFail,
        coverageTestPerFile: false,
        coverageMinimumPerFile: COMPODOC_DEFAULTS.defaultCoverageMinimumPerFile,
        unitTestCoverage: '',
        unitTestData: undefined,
        coverageTestShowOnlyFailed: COMPODOC_DEFAULTS.coverageTestShowOnlyFailed,
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
        logoLayout: 'auto',
        packageDependencies: [],
        packagePeerDependencies: [],
        packageProperties: {},
        gaID: '',
        angularProject: false,
        language: COMPODOC_DEFAULTS.language,
        maxSearchResults: 15,
        publicApiOnly: '',
        publicApiExports: new Map<string, Set<string>>(),
        publicApiDeclarations: new Map<string, Set<string>>(),
        infoTabSections: [],
        apiTabSections: [],
        themingTabSections: [],
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
        features: {},
        featureContainers: [...DEFAULT_FEATURE_CONTAINERS],
        featureUtilityFolders: [...DEFAULT_FEATURE_UTILITY_FOLDERS],
        featureRoleFolders: [...DEFAULT_FEATURE_ROLE_FOLDERS],
        classificationAxes: {},
        styleFiles: [],
        styleFilesBase: '',
        featuresName: 'Features',
        referencesName: 'References',
        collapsedAll: false,
        menuFeatureSections: DEFAULT_MENU_FEATURE_SECTIONS,
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

    /**
     * Queue a page unless one is already queued for the same output file; a
     * symbol that reaches no entry point or lives on a DI page gets none here.
     */
    public addPage(page: PageInterface) {
        if (isMovedPage(page as never, this.mainData.di)) {
            return;
        }
        if (!this.hasPage(pageOutputPath(page))) {
            this._pages.push(page);
        }
    }

    /** True when a queued page is written to `path` (root-relative, see `pageOutputPath`). */
    public hasPage(path: string): boolean {
        return this._pages.some(p => pageOutputPath(p) === path);
    }

    public addAdditionalPage(page: PageInterface) {
        this._mainData.additionalPages.push(page);
    }

    public resetPages() {
        this._pages = [];
    }

    public resetAdditionalPages() {
        this._mainData.additionalPages = [];
        this._mainData.additionalAliases = [];
    }

    /** Drops the root markdown pages (README as `index`, CHANGELOG, ...) that are queued. */
    public resetRootMarkdownPages() {
        this._pages = this._pages.filter(p => !(ROOT_MARKDOWN_PAGE_NAMES.has(p.name) && !p.path));
        this._mainData.markdowns = [];
    }

    get pages(): PageInterface[] {
        return this._pages;
    }
    set pages(_pages: PageInterface[]) {
        this._pages = [];
    }

    get mainData(): MainDataInterface {
        return this._mainData;
    }
    set mainData(data: MainDataInterface) {
        (Object as any).assign(this._mainData, data);
    }
}

export default Configuration.getInstance();
