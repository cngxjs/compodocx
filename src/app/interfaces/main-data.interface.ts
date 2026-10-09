import type { SemanticModel } from '../compiler/semantic/model';
import type { DiView } from '../di/model';
import type { FileRefBundle, VendorPackage } from '../engines/stackblitz';
import type { SymbolTable } from '../links/symbol-table';
import type { CoverageData } from './coverageData.interface';

export interface MainDataInterface {
    output: string;
    theme: string;
    extTheme: string;
    customThemePath: string;
    shikiTheme: string;
    serve: boolean;
    hostname: string;
    host: string;
    port: number;
    open: boolean;
    assetsFolder: string;
    documentationMainName: string;
    documentationMainDescription: string;
    base: string;
    hideGenerator: boolean;
    hideDarkModeToggle: boolean;
    hasFilesToCoverage: boolean;
    modules: any;
    readme: boolean;
    readmeAiGenerated?: string | true;
    changelog: string;
    contributing: string;
    license: string;
    todo: string;
    markdowns: any[];
    additionalPages: any;
    pipes: any;
    classes: any;
    interfaces: any;
    components: any;
    entities: any;
    directives: any;
    injectables: any;
    interceptors: any;
    guards: any;
    miscellaneous: any;
    routes: any;
    tsconfig: string;
    toggleMenuItems: string[];
    navTabConfig: any[];
    templates: string;
    includes: string;
    includesName: string;
    includesFolder: string;
    disableSourceCode: boolean;
    disableDomTree: boolean;
    disableTemplateTab: boolean;
    disableStyleTab: boolean;
    disableGraph: boolean;
    disableCoverage: boolean;
    disablePrivate: boolean;
    disableProtected: boolean;
    disableInternal: boolean;
    disableLifeCycleHooks: boolean;
    disableConstructors: boolean;
    disableRoutesGraph: boolean;
    disableSearch: boolean;
    disableDependencies: boolean;
    disableDependenciesTab: boolean;
    /**
     * When true, suppresses the Playground tab on component pages even if
     * `@playground` blocks were parsed. Default false. Independent of
     * `disableDependenciesTab` — that flag only controls the dependency graph.
     */
    disablePlaygroundTab: boolean;
    /**
     * Fail the build when a non-vendored `@playground` imports a subpath or
     * named symbol that is absent from the version of the package pinned in
     * the consumer's `node_modules`. Default false → such breakage only warns.
     * Vendored packages (`playgroundVendor`) are exempt — they ship the local
     * build, not the registry version. CLI: `--strictPlaygrounds`.
     */
    strictPlaygrounds: boolean;
    disableProperties: boolean;
    disableFilePath: boolean;
    disableOverview: boolean;
    showEffects: boolean;
    watch: boolean;
    dependencyGraph: {
        nodes: Array<{ name: string; type: string; url?: string }>;
        edges: Array<{ source: string; target: string }>;
    };
    entityIndex: Record<string, { href: string; kind: string }>;
    coverageTest: boolean;
    coverageTestThreshold: number;
    coverageTestThresholdFail: boolean;
    coverageTestPerFile: boolean;
    coverageMinimumPerFile: number;
    coverageTestShowOnlyFailed: boolean;
    unitTestCoverage: string;
    unitTestData: Object;
    routesLength: number;
    angularVersion: string;
    exportFormat: string;
    /** Indent size (0–8) for `--exportFormat json`. 0 = single-line. */
    jsonIndent: number;
    /**
     * When true, output is written to `<output>/<versionLabel>/`, a
     * `versions.json` manifest is maintained at `versionsRoot`, and the
     * topbar version-switcher widget is rendered. Default true. Pass
     * `--no-multiVersion` to restore the pre-v0.3.0 flat output layout.
     */
    multiVersion: boolean;
    /** Resolved version label used as the version subfolder name. */
    versionLabel: string;
    /** Folder containing `versions.json`. Defaults to the parent of `output`. */
    versionsRoot: string;
    /** Switcher dropdown cap. `0` is unlimited. */
    maxVersionsShown: number;
    /**
     * True when the user explicitly passed `-d` / `--output` on the CLI or in
     * a config file. Used by `--exportFormat llm-md` to decide between writing
     * to a file (`<output>/llm-context.md`) and streaming to stdout.
     */
    outputProvided: boolean;
    coverageData: CoverageData;
    customFavicon: string;
    customLogo: string;
    packageDependencies: Object[];
    packagePeerDependencies: Object[];
    packageProperties: any;
    gaID: string;
    angularProject: boolean;
    /** Whether the project's package.json lists zone.js (absent = zoneless). */
    hasZoneJs?: boolean;
    language: string;
    maxSearchResults: number;
    publicApiOnly: string;
    publicApiExports: Map<string, Set<string>>;
    infoTabSections: string[];
    apiTabSections: string[];
    themingTabSections: string[];
    stackblitz: boolean;
    stackblitzTemplate: string;
    /**
     * Subset of the consumer's `package.json` (`dependencies` and
     * `peerDependencies`) used to pin third-party deps in `@playground`
     * StackBlitz manifests. Set in `application.ts` after the workspace
     * `package.json` is loaded; left as `{}` when no manifest is reachable.
     */
    workspacePackage: {
        dependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };
    /**
     * Config-only override map for `@playground` manifests. Wins over the
     * consumer-`package.json` auto-forward — use it for libraries the
     * consumer hosts but doesn't `npm install` directly (peer-only CSS
     * themes, dev-time-only deps), or to pin a specific version per build.
     * No CLI flag — this surfaces only via `compodocx.config.json`.
     */
    playgroundDependencies: Record<string, string>;
    /**
     * Force the Material "app shell" (Roboto and Material-Icons font links and
     * `mat-typography mat-app-background` body classes) into every generated
     * `@playground` `index.html`, independent of Material auto-detect. Lets a
     * playground themed to look like Material via a Sass theme bridge get the
     * shell without pulling `@angular/material`. No CLI flag — config-only.
     */
    playgroundMaterialShell: boolean;
    /**
     * Max import depth followed when walking a playground's dependency graph
     * (`playgroundDepDepth`, default `STACKBLITZ_DEP_DEPTH`). No CLI flag.
     */
    playgroundDepDepth: number;
    /**
     * Hard ceiling on source files in one playground manifest
     * (`playgroundFileCountCap`, default `STACKBLITZ_FILE_COUNT_CAP`). Exceeding
     * it fails that playground with a message naming the walked files.
     */
    playgroundFileCountCap: number;
    /**
     * Per-file character cap before truncation (`playgroundFileCap`, default
     * `STACKBLITZ_FILE_CAP`). No CLI flag — config-only.
     */
    playgroundFileCap: number;
    /**
     * Arbitrary `<head>` entries injected into every generated `@playground`
     * `index.html` (after the Material shell links, when present). For custom
     * fonts, meta tags, CSP, or preloads. No CLI flag — config-only.
     */
    playgroundHead: string[];
    /**
     * Global CSS appended to every generated `@playground` `src/styles.css`,
     * after the default body reset. For fonts, resets, or any global rules the
     * examples depend on. No CLI flag — config-only.
     */
    playgroundGlobalStyles: string;
    /**
     * Package names and/or globs (`"@cngx/*"`) to vendor into `@playground`
     * StackBlitz projects from the locally built `dist/`. When a playground
     * imports a matching package, its whole dist dir (plus the transitive
     * closure of other matching packages) is embedded in the manifest and
     * wired as a `file:` dependency — so the playground runs against the
     * working tree, not the last published release. No CLI flag — config-only.
     */
    playgroundVendor: string[];
    /**
     * Base directory the `playgroundVendor` closure is read from. Each matched
     * package is located by its `package.json` `name`, anywhere under this
     * root. Defaults to `dist`. No CLI flag — config-only.
     */
    playgroundVendorRoot: string;
    /**
     * Backstop byte cap on a single playground's slimmed-and-pruned vendored
     * closure (`playgroundVendorCap`). Defaults to {@link
     * STACKBLITZ_VENDOR_TOTAL_CAP}, set under StackBlitz's project-POST limit
     * so a build fails fast rather than producing a manifest that 413s. No CLI
     * flag — config-only.
     */
    playgroundVendorCap: number;
    /**
     * Keep `*.map` sourcemaps in vendored packages
     * (`playgroundVendorIncludeSourcemaps`, default `false`). Sourcemaps are a
     * large slice of FESM byte size and the WebContainer build never needs
     * them, so they are dropped unless this is set. No CLI flag — config-only.
     */
    playgroundVendorIncludeSourcemaps: boolean;
    /**
     * Vendor packages resolved from `playgroundVendor` at build time, keyed by
     * full package name. Populated by `PlaygroundVendorResolver` after the
     * workspace scan; forwarded into every block's manifest builder, which
     * embeds only the per-playground import closure. Empty when
     * `playgroundVendor` is unset.
     */
    playgroundVendorPackages: Record<string, VendorPackage>;
    /**
     * Resolved file-ref bundles per playground block. Key format:
     * `${componentName}:${blockIndex}`. Populated in `application.ts` after
     * the dep-graph build by walking every component/directive/etc with at
     * least one `@playground` block carrying `fileRef`. Failed reads warn via
     * `logger.warn` and the entry is skipped — the manifest builder then
     * surfaces a "Project assembly failed" fallback for that block.
     */
    playgroundFiles: Record<string, FileRefBundle>;
    appConfig: any[];
    menuLayout: 'type' | 'feature';
    /** Glob over cwd-relative file paths -> feature key. */
    features: Record<string, string>;
    /** App folders whose children are features. */
    featureContainers: string[];
    /** Entry point folders that belong to the root feature. */
    featureUtilityFolders: string[];
    featuresName: string;
    referencesName: string;
    collapsedAll: boolean;
    generatedAt: string;
    /** Facts of the semantic stage; absent when the stage did not run or failed. */
    semantic?: SemanticModel;
    /** Every documented symbol by id; absent before the first crawl. */
    symbols?: SymbolTable;
    /** Placement of providers, feature functions and tokens; absent before the first crawl. */
    di?: DiView;
}
