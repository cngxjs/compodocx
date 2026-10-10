export const COMPODOC_DEFAULTS = {
    title: 'Application documentation',
    additionalEntryName: 'Additional documentation',
    additionalEntryPath: 'additional-documentation',
    folder: './documentation/',
    hostname: '127.0.0.1',
    port: 8080,
    theme: 'default',
    exportFormat: 'html',
    exportFormatsSupported: ['html', 'json', 'llm-md'],
    /** Default JSON indent for `--exportFormat json`. 0 = single-line; range 0–8. */
    jsonIndent: 0,
    /**
     * Multi-version output is the default. Output goes to
     * `<output>/<versionLabel>/`, `<output-parent>/versions.json` accumulates
     * known versions, and the topbar switcher widget is rendered. Opt out
     * with `--no-multiVersion` to restore the previous flat layout.
     */
    multiVersion: true,
    /**
     * Cap on how many versions the switcher dropdown shows. The manifest
     * is always written in full; this is a presentation-only slice. `0`
     * means unlimited. Range 0..1000.
     */
    maxVersionsShown: 10,
    base: '/',
    defaultCoverageThreshold: 70,
    defaultCoverageMinimumPerFile: 0,
    coverageTestThresholdFail: true,
    toggleMenuItems: ['all'],
    navTabConfig: [],
    disableSearch: false,
    disableSourceCode: false,
    disableDomTree: false,
    disableTemplateTab: false,
    disableStyleTab: false,
    disableGraph: false,
    disableCoverage: false,
    disablePrivate: false,
    disableProtected: false,
    disableInternal: false,
    disableLifeCycleHooks: false,
    disableConstructors: false,
    disableRoutesGraph: false,
    disableDependencies: false,
    disableDependenciesTab: false,
    disablePlaygroundTab: false,
    strictPlaygrounds: false,
    disableProperties: false,
    disableFilePath: false,
    disableOverview: false,
    showEffects: false,
    hideGenerator: false,
    hideDarkModeToggle: false,
    minimal: false,
    silent: false,
    serve: false,
    watch: false,
    PAGE_TYPES: {
        ROOT: 'root',
        INTERNAL: 'internal'
    },
    coverageTestShowOnlyFailed: false,
    language: 'en-US',
    maxSearchResults: 15
};
