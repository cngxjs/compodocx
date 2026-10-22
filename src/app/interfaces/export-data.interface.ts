import type { StyleMixin, ThemeToken } from '../../utils/theme-doc-parser';
import type {
    HostDirectiveEntry,
    ProviderEntry
} from '../compiler/angular/deps/helpers/component-helper';
import type { JsdocTagInterface } from './jsdoc-tag.interface';

/**
 * A guard, resolver, title or redirect function, matcher, provider or router
 * feature of a route: the name, the declaring file when the name is a
 * documented symbol, and the exact source text (`roleGuard('admin')`).
 */
export interface ExportRouteRef {
    /** Callee or identifier name; `''` for an inline function or a dynamic value. */
    name: string;
    file?: string;
    source: string;
    /** Set for a call expression. */
    call?: true;
}

/** What a route renders (`component` / `loadComponent`) or loads (`loadChildren`). */
export interface ExportRouteTarget {
    kind: 'symbol' | 'routes' | 'external' | 'unresolved';
    /** Exported name; a default-exported declaration by its own name, else `default`. */
    name: string;
    /** Declaring file when the target is a documented symbol. */
    file?: string;
    /** Module specifier of a lazy import. */
    specifier?: string;
    lazy?: true;
    source: string;
}

/** One route. Empty lists and absent values are never written. */
export interface ExportRoute {
    /** The path text; `null` for a matcher route or a runtime-built child list. */
    path: string | null;
    /** Set when `path` is source text the type checker cannot evaluate. */
    pathDynamic?: true;
    /** Parent full path + own path; dynamic segments as `{source}`; the root is `/`. */
    fullPath: string;
    pathMatch?: 'full' | 'prefix';
    outlet?: string;
    matcher?: ExportRouteRef;
    component?: ExportRouteTarget;
    loadChildren?: ExportRouteTarget;
    /** The call that builds this node's routes at runtime. */
    builtBy?: ExportRouteRef;
    /** A string, or a redirect function / dynamic value. */
    redirectTo?: string | ExportRouteRef;
    /** A string, or a title resolver / dynamic value. */
    title?: string | ExportRouteRef;
    canActivate?: ExportRouteRef[];
    canActivateChild?: ExportRouteRef[];
    canDeactivate?: ExportRouteRef[];
    canMatch?: ExportRouteRef[];
    canLoad?: ExportRouteRef[];
    resolve?: Record<string, ExportRouteRef>;
    providers?: ExportRouteRef[];
    /** Source text of the `data` value. */
    data?: string;
    /** Source text of the `runGuardsAndResolvers` value. */
    runGuardsAndResolvers?: string;
    /** Declaring file, relative to the working directory. */
    file: string;
    line: number;
    /** Inline children, spreads followed, plus an expanded `loadChildren` route array. */
    children?: ExportRoute[];
}

/**
 * A router (`provideRouter` reached from `bootstrapApplication`) or an
 * exported route array that no router mounts (`unmounted`).
 */
export interface ExportRouteRoot {
    kind: 'router' | 'unmounted';
    bootstraps?: { file: string; line: number; component?: string }[];
    /** Name of the application config variable holding the `provideRouter` call. */
    config?: string;
    /** `provideRouter(routes, ...features)`. */
    features?: ExportRouteRef[];
    /** Name of the route array variable (the routes argument, or the unmounted array). */
    array?: string;
    routes: ExportRoute[];
}

/**
 * Schema version of the `documentation.json` produced by `--exportFormat json`.
 *
 * Bump this constant when the shape of `ExportData` (or any nested `Export*`
 * interface) changes in a way that breaks downstream consumers
 * (`compodocx diff`, `--export llm-md`, future VS Code extension, etc.).
 *
 * Pre-v0.3.0 outputs have no `schemaVersion` field at all and are treated as
 * "version 0" by consumers. The drift-detection spec
 * (`test/src/utils/export-json-schema-drift.spec.ts`) fails the build if any
 * other place in `src/` writes a numeric literal as the schema version
 * instead of importing this constant.
 */
export const EXPORT_SCHEMA_VERSION = 6 as const;

export type ExportSchemaVersion = typeof EXPORT_SCHEMA_VERSION;

/**
 * Header fields on `ExportData` that change on every run even when the source
 * code is unchanged. Byte-equal comparators (notably the upcoming sprint-3
 * API Diff) must strip these before diffing - otherwise every comparison
 * reports churn.
 *
 * Exported as a runtime array so consumers can iterate it without mirroring
 * the list on their side.
 */
export const VOLATILE_EXPORT_FIELDS = ['generatedAt', 'compodocxVersion'] as const;

export type VolatileExportField = (typeof VOLATILE_EXPORT_FIELDS)[number];

export interface ExportArg {
    name: string;
    type?: string;
    optional?: boolean;
    dotDotDotToken?: boolean;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    defaultValue?: string;
}

export interface ExportProperty {
    name: string;
    type?: string;
    defaultValue?: string;
    optional?: boolean;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    rawdescription?: string;
    line?: number;
    modifierKind?: number[];
    decorators?: ReadonlyArray<unknown>;
    kind?: string;
    signalDeps?: string[];
    jsdoctags?: JsdocTagInterface[];
    /** Signal primitive of the initializer (`input-signal`, `output-signal`, `model`, `computed`, ...). */
    signalKind?: string;
    /** Signal inputs, outputs and models: whether the member is `.required`. */
    required?: boolean;
    /** Public name from the `alias` option of a signal input, output or model. */
    alias?: string;
}

export interface ExportMethod {
    name: string;
    args?: ExportArg[];
    returnType?: string;
    typeParameters?: string[];
    optional?: boolean;
    line?: number;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    rawdescription?: string;
    modifierKind?: number[];
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportAccessor {
    name?: string;
    getSignature?: unknown;
    setSignature?: unknown;
}

export interface ExportSlot {
    name: string;
    description?: string;
}

export interface ExportHostBinding {
    name: string;
    args?: ExportArg[];
    argsType?: string;
    line?: number;
}

export interface ExportHostListener {
    name: string;
    args?: ExportArg[];
    argsDecorator?: string[];
    line?: number;
}

export interface ExportIndexSignature {
    id?: string;
    description?: string;
    args?: ExportArg[];
    returnType?: string;
}

/** A top-level declaration of the same run; `file` is relative to the working directory. */
export interface ExportSymbolRef {
    name: string;
    file: string;
}

export interface ExportDiFacts {
    role?: 'provider' | 'feature';
    /** Feature type a provider accepts or a feature function returns. */
    featureType?: ExportSymbolRef;
    providesTokens?: ExportSymbolRef[];
    readsTokens?: ExportSymbolRef[];
    usesInjectionContext?: 'direct' | 'call';
    /** Returns a value read from a token its library configures through a provider with features. */
    configAccessor?: true;
}

export type ExportTokenShape =
    | 'interface'
    | 'signal'
    | 'function'
    | 'primitive'
    | 'union'
    | 'other';

export interface ExportTokenFacts {
    shape: ExportTokenShape;
    providedBy?: ExportSymbolRef[];
    injectedBy?: ExportSymbolRef[];
}

/**
 * Facts from the project-wide semantic analysis, on every symbol entry.
 * Absent fields mean "no fact": empty lists and `false` are never written.
 */
export interface ExportSemanticFacts {
    /** Import path of the nearest barrel that exports the symbol. */
    entryPoint?: string;
    /** Import paths of every barrel that exports the symbol, sorted. */
    exportedBy?: string[];
    /** Exported from its file, inside an entry point, but in no barrel. */
    notExported?: true;
    usedBy?: ExportSymbolRef[];
    di?: ExportDiFacts;
    token?: ExportTokenFacts;
    /** The feature the symbol belongs to; `key` `''` is the entry point's root feature. */
    feature?: ExportFeatureRef;
    /** Values on the declared classification axes, by axis name. */
    axes?: Record<string, string>;
    /** Components: full paths of the routes rendering it. */
    routedAt?: string[];
    /** Route array variables: full paths of the places a router mounts it at. */
    mountedAt?: string[];
}

export interface ExportFeatureRef {
    entryPoint?: string;
    key: string;
}

/** A feature: entry point plus a key below it, with the features it builds on. */
export interface ExportFeature {
    /** `${entryPoint ?? ''}#${key}`. */
    id: string;
    entryPoint?: string;
    key: string;
    label: string;
    detector: 'config' | 'tag' | 'cohesion' | 'entry-point' | 'folder';
    /** README of the feature, relative to the working directory. */
    readme?: string;
    /** Ids of features in other entry points this one uses. */
    buildsOn: string[];
    /** Ids of features in other entry points that use this one. */
    extendedBy: string[];
}

export interface ExportSemanticSummary {
    entryPoints: number;
    providers: number;
    features: number;
    injectionContext: { direct: number; viaCall: number; unresolved: number };
    notExported: number;
}

export interface ExportSemantic {
    entryPoints: {
        importPath: string;
        file: string;
        source: 'ng-package' | 'tsconfig-paths';
    }[];
    summary: ExportSemanticSummary;
    features?: ExportFeature[];
    /** The declared classification axes with their counts; only when axes are declared. */
    axes?: ExportAxis[];
}

/** A declared classification axis: every declared value with its symbol count. */
export interface ExportAxis {
    name: string;
    label: string;
    values: { value: string; count: number }[];
    classified: number;
    /** Symbols of the axis' kinds without a value. */
    unclassified: number;
}

export interface ExportEntityCommon extends ExportSemanticFacts {
    id?: string;
    name: string;
    file?: string;
    type?: string;
    description?: string;
    rawdescription?: string;
    sourceCode?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    extends?: string | string[];
    /** External documentation links injected by JSDoc tags. */
    storybookUrl?: string;
    figmaUrl?: string;
    stackblitzUrl?: string;
    githubUrl?: string;
    docsUrl?: string;
    /** Symbols named by `@relatedTo`. */
    relatedTo?: string[];
}

export interface ExportComponent extends ExportEntityCommon {
    selector?: string;
    standalone?: boolean;
    signal?: boolean;
    zoneless?: boolean;
    changeDetection?: string;
    encapsulation?: string[];
    preserveWhitespaces?: boolean;
    template?: string;
    templateUrl?: string[];
    styleUrls?: string[];
    styles?: string[];
    styleUrlsData?: string;
    stylesData?: string;
    assetsDirs?: string[];
    exportAs?: string;
    inputs?: string[];
    outputs?: string[];
    imports?: ReadonlyArray<unknown>;
    /** A provider written as a call (`provideFoo(withBar())`) also carries `call`. */
    providers?: ProviderEntry[];
    viewProviders?: ProviderEntry[];
    hostBindings?: ExportHostBinding[];
    hostListeners?: ExportHostListener[];
    hostStructured?: ReadonlyArray<unknown>;
    hostDirectives?: HostDirectiveEntry[];
    inputsClass?: ExportProperty[];
    outputsClass?: ExportProperty[];
    propertiesClass?: ExportProperty[];
    methodsClass?: ExportMethod[];
    accessors?: Record<string, ExportAccessor>;
    slots?: ExportSlot[];
    themeTokens?: ThemeToken[];
    /** Keys into the top-level `styleSources` map, in collection order. */
    themeStyleSources?: string[];
    themeOverview?: string;
    jsdoctags?: JsdocTagInterface[];
    route?: string;
    group?: string;
    order?: number;
    since?: string;
    beta?: boolean;
    breaking?: boolean;
}

export interface ExportDirective extends ExportEntityCommon {
    /** Tokens of the style files that theme the directive (`@themes`). */
    themeTokens?: ThemeToken[];
    /** Keys into the top-level `styleSources` map, in collection order. */
    themeStyleSources?: string[];
    themeOverview?: string;
    selector?: string;
    standalone?: boolean;
    signal?: boolean;
    zoneless?: boolean;
    inputsClass?: ExportProperty[];
    outputsClass?: ExportProperty[];
    propertiesClass?: ExportProperty[];
    methodsClass?: ExportMethod[];
    hostBindings?: ExportHostBinding[];
    hostListeners?: ExportHostListener[];
    hostStructured?: ReadonlyArray<unknown>;
    hostDirectives?: HostDirectiveEntry[];
    providers?: ProviderEntry[];
    jsdoctags?: JsdocTagInterface[];
    group?: string;
    since?: string;
    beta?: boolean;
    breaking?: boolean;
}

export interface ExportInjectable extends ExportEntityCommon {
    properties?: ExportProperty[];
    methods?: ExportMethod[];
    accessors?: Record<string, ExportAccessor>;
    constructorObj?: unknown;
    isToken?: boolean;
    /** `InjectionToken` or `HttpContextToken`; absent means `InjectionToken`. */
    tokenClass?: string;
    tokenType?: string;
    providedIn?: string;
    /** Source text of the `factory` option of an `InjectionToken` or a `@Service`; absent without one. */
    factory?: string;
    jsdoctags?: JsdocTagInterface[];
}

/** A class decorated with Angular's `@Service` (Angular 22). */
export interface ExportService extends ExportInjectable {
    /** `autoProvided` when written as a boolean literal. */
    autoProvided?: boolean;
}

export interface ExportInterceptor extends ExportEntityCommon {
    properties?: ExportProperty[];
    methods?: ExportMethod[];
    accessors?: Record<string, ExportAccessor>;
    constructorObj?: unknown;
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportGuard extends ExportEntityCommon {
    properties?: ExportProperty[];
    methods?: ExportMethod[];
    accessors?: Record<string, ExportAccessor>;
    constructorObj?: unknown;
    jsdoctags?: JsdocTagInterface[];
    implements?: string[];
    indexSignatures?: ExportIndexSignature[];
    inputsClass?: ExportProperty[];
    outputsClass?: ExportProperty[];
    hostBindings?: ExportHostBinding[];
    hostListeners?: ExportHostListener[];
}

export interface ExportPipe extends ExportEntityCommon {
    standalone?: boolean;
    pure?: string;
    ngname?: string;
    methods?: ExportMethod[];
    properties?: ExportProperty[];
    readme?: string;
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportClass extends ExportEntityCommon {
    properties?: ExportProperty[];
    methods?: ExportMethod[];
    accessors?: Record<string, ExportAccessor>;
    constructorObj?: unknown;
    indexSignatures?: ExportIndexSignature[];
    inputsClass?: ExportProperty[];
    outputsClass?: ExportProperty[];
    hostBindings?: ExportHostBinding[];
    hostListeners?: ExportHostListener[];
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportInterface extends ExportEntityCommon {
    properties?: ExportProperty[];
    methods?: ExportMethod[];
    indexSignatures?: ExportIndexSignature[];
    kind?: number;
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportFunction extends ExportSemanticFacts {
    name: string;
    file?: string;
    ctype?: string;
    subtype?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    returnType?: string;
    args?: ExportArg[];
    jsdoctags?: JsdocTagInterface[];
}

export interface ExportEnumMember {
    name: string;
    value?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
}

export interface ExportEnumeration extends ExportSemanticFacts {
    name: string;
    file?: string;
    ctype?: string;
    subtype?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    childs?: ExportEnumMember[];
}

export interface ExportTypeAlias extends ExportSemanticFacts {
    name: string;
    file?: string;
    ctype?: string;
    subtype?: string;
    rawtype?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    description?: string;
    kind?: number;
}

export interface ExportVariable extends ExportSemanticFacts {
    name: string;
    file?: string;
    ctype?: string;
    subtype?: string;
    deprecated?: boolean;
    deprecationMessage?: string;
    type?: string;
    defaultValue?: string;
    description?: string;
}

/**
 * Items grouped by source folder. The engine emits these alongside the flat
 * `variables` / `functions` / `typealiases` / `enumerations` arrays.
 */
export interface ExportMiscellaneousGroup<T> {
    file: string;
    items: T[];
}

export interface ExportMiscellaneous {
    variables?: ExportVariable[];
    functions?: ExportFunction[];
    typealiases?: ExportTypeAlias[];
    enumerations?: ExportEnumeration[];
    groupedVariables?: ExportMiscellaneousGroup<ExportVariable>[];
    groupedFunctions?: ExportMiscellaneousGroup<ExportFunction>[];
    groupedEnumerations?: ExportMiscellaneousGroup<ExportEnumeration>[];
    groupedTypeAliases?: ExportMiscellaneousGroup<ExportTypeAlias>[];
}

export interface ExportCoverageFile {
    filePath: string;
    type: string;
    linktype?: string;
    linksubtype?: string;
    name: string;
    coveragePercent: number;
    coverageCount: string;
    status: 'good' | 'low' | 'medium' | 'lowmedium' | 'verylow' | 'minimum-perfile-fail' | string;
}

export interface ExportCoverage {
    count?: number;
    status?: string;
    files?: ExportCoverageFile[];
}

/**
 * Top-level shape of `documentation.json`. This is the contract downstream
 * consumers (`compodocx diff`, `--export llm-md`, future VS Code extension)
 * import from `@cngxjs/compodocx`.
 *
 * Stability rules:
 *
 * 1. Adding a new optional field is a non-breaking change and does **not**
 *    require bumping `EXPORT_SCHEMA_VERSION`.
 * 2. Renaming a field, removing a field, narrowing an existing field's type,
 *    or changing the meaning of a field **is** a breaking change. Bump
 *    `EXPORT_SCHEMA_VERSION` and add a `### Changed` / `### Removed` note in
 *    `MIGRATION.md`.
 * 3. Pre-v0.3.0 outputs have no `schemaVersion` field. Consumers should treat
 *    a missing `schemaVersion` as version 0.
 *
 * Volatile header fields: `generatedAt` and `compodocxVersion` change on
 * every run even when the source is unchanged. Byte-equal comparators must
 * strip them - see `VOLATILE_EXPORT_FIELDS` for the canonical list.
 */
export interface ExportData {
    schemaVersion: ExportSchemaVersion;
    /**
     * ISO 8601 timestamp of when this snapshot was generated.
     * Volatile - listed in `VOLATILE_EXPORT_FIELDS`; strip before byte-equal diffs.
     */
    generatedAt: string;
    /**
     * Version of `@cngxjs/compodocx` that produced this snapshot.
     * Volatile - listed in `VOLATILE_EXPORT_FIELDS`; strip before byte-equal diffs.
     */
    compodocxVersion: string;
    pipes?: ExportPipe[];
    interfaces?: ExportInterface[];
    injectables?: ExportInjectable[];
    /** Classes decorated with Angular's `@Service`; written only when there are any. */
    services?: ExportService[];
    guards?: ExportGuard[];
    interceptors?: ExportInterceptor[];
    classes?: ExportClass[];
    directives?: ExportDirective[];
    /** Written only when the route model has routes and routes are not disabled. */
    routes?: ExportRouteRoot[];
    coverage?: ExportCoverage;
    miscellaneous?: ExportMiscellaneous;
    components?: ExportComponent[];
    /** InjectionToken / HttpContextToken declarations (v0.6.0+). */
    tokens?: ExportInjectable[];
    /**
     * Style sources of the documented components, keyed by project-relative
     * file path, or `<component file>#inline-<n>` for inline styles. Each
     * component lists its keys in `themeStyleSources`.
     */
    styleSources?: Record<string, ExportStyleSource>;
    /**
     * Free-standing style files matched by `styleFiles` that have documented
     * content. Their sources are in `styleSources`, keyed by file.
     */
    styleFiles?: ExportStyleFile[];
    /**
     * Entry points and counts of the semantic analysis. Absent when the
     * analysis did not run (no tsconfig, or the tsconfig could not be read).
     */
    semantic?: ExportSemantic;
    /** Pages from `--includes`, in sidebar order; written only when there are any. */
    additionalPages?: ExportAdditionalPage[];
}

/** A page from `--includes` (`summary.json`). */
export interface ExportAdditionalPage {
    /** Slug path below the includes folder, forward slashes ("guides/getting-started"). */
    slug: string;
    /** Page title (the heading text). */
    title: string;
    /** Sidebar label; written only when it differs from the title. */
    label?: string;
    /** Source file relative to the includes folder, forward slashes. */
    file: string;
    /** Raw Markdown as written, not the rendered HTML. */
    markdown: string;
    /** The page carries the `@aiGenerated` marker (its detail text stays in `markdown`). */
    aiGenerated?: true;
    children?: ExportAdditionalPage[];
}

/** A free-standing style file with documented content. */
export interface ExportStyleFile {
    /** Relative to the working directory, forward slashes. */
    file: string;
    language: 'css' | 'scss';
    overview?: string;
    tokens: ThemeToken[];
    mixins?: StyleMixin[];
    /** Components and directives the file themes (`@themes`). */
    themes?: ExportSymbolRef[];
    relatedTo?: string[];
    feature?: ExportFeatureRef;
}

export interface ExportStyleSource {
    content: string;
    language: string;
}
