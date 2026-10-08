import type { Command } from 'commander';

import pkg from '../../../package.json';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';

const splitCommaList = (val: string): string[] => val.split(',');

/**
 * Register every commander option against the given program in source order.
 * Returns the same program for chaining. Caller is responsible for invoking
 * `.parse(...)` — this function does not touch `process.argv`.
 */
export function defineFlags(program: Command): Command {
    return program
        .version(pkg.version)
        .usage('<src> [options]')
        .option(
            '-c, --config [config]',
            'A configuration file : .compodocxrc, .compodocxrc.json, .compodocxrc.yaml (also supports .compodocrc variants), or compodocx/compodoc property in package.json'
        )
        .option('-p, --tsconfig [config]', 'A tsconfig.json file')
        .option(
            '-d, --output [folder]',
            'Where to store the generated documentation',
            COMPODOC_DEFAULTS.folder
        )
        .option('-y, --extTheme [file]', 'External styling theme file')
        .option('-n, --name [name]', 'Title documentation', COMPODOC_DEFAULTS.title)
        .option(
            '-a, --assetsFolder [folder]',
            'External assets folder to copy in generated documentation folder'
        )
        .option('-o, --open [value]', 'Open the generated documentation')
        .option(
            '-t, --silent',
            "In silent mode, log messages aren't logged in the console",
            COMPODOC_DEFAULTS.silent
        )
        .option(
            '-s, --serve',
            'Serve generated documentation (default http://localhost:8080/)',
            COMPODOC_DEFAULTS.serve
        )
        .option('--host [host]', 'Change default host address')
        .option('-r, --port [port]', 'Change default serving port', String(COMPODOC_DEFAULTS.port))
        .option(
            '-w, --watch',
            'Watch source files after serve and force documentation rebuild',
            COMPODOC_DEFAULTS.watch
        )
        .option(
            '-e, --exportFormat [format]',
            'Export in specified format (json, html, llm-md)',
            COMPODOC_DEFAULTS.exportFormat
        )
        .option(
            '--jsonIndent <spaces>',
            'JSON indent for the documentation.json export (0-8, default: 0)',
            String(COMPODOC_DEFAULTS.jsonIndent)
        )
        .option(
            '--multiVersion',
            'Write output to <output>/<versionLabel>/ and maintain a versions.json manifest (default: on)',
            COMPODOC_DEFAULTS.multiVersion
        )
        .option(
            '--no-multiVersion',
            'Restore the previous flat output layout (no version subfolder, no versions.json, no switcher)'
        )
        .option(
            '--versionLabel [label]',
            "Override the version-subfolder name. Defaults to the project's package.json version, prefixed with 'v'."
        )
        .option(
            '--versionsRoot [path]',
            'Folder where versions.json is read/written. Defaults to the parent of the output folder.'
        )
        .option(
            '--maxVersionsShown <n>',
            'Cap on the number of versions shown in the switcher dropdown (0 = unlimited, range 0-1000, default: 10)',
            String(COMPODOC_DEFAULTS.maxVersionsShown)
        )
        .option('--files [files]', 'Files provided by external tool, used for coverage test')
        .option(
            '--language [language]',
            'Language used for the generated documentation (bg-BG, de-DE, en-US, es-ES, fr-FR, hu-HU, it-IT, ja-JP, ka-GE, ko-KR, nl-NL, pl-PL, pt-BR, ru-RU, sk-SK, zh-CN, zh-TW)',
            COMPODOC_DEFAULTS.language
        )
        .option(
            '--theme [theme]',
            'Choose a built-in theme or path to a custom CSS file (built-in: default, ocean, ember, midnight, neon, brutalist, nord, rose-pine)'
        )
        .option(
            '--shikiTheme [theme]',
            "Shiki syntax highlighting theme pair (e.g. 'github-light:github-dark' or 'nord')"
        )
        .option(
            '--hideGenerator',
            'Do not print the compodocx link at the bottom of the page',
            COMPODOC_DEFAULTS.hideGenerator
        )
        .option(
            '--hideDarkModeToggle',
            'Do not show dark mode toggle button at the top right position of the page',
            COMPODOC_DEFAULTS.hideDarkModeToggle
        )
        .option(
            '--toggleMenuItems <items>',
            "Close by default items in the menu values : ['all'] or one of these ['components','directives','entities','classes','injectables','tokens','guards','interfaces','interceptors','pipes','utilities','additionalPages','features'] (features applies under menuLayout: 'feature')",
            splitCommaList,
            COMPODOC_DEFAULTS.toggleMenuItems
        )
        .option(
            '--navTabConfig <tab configs>',
            `List navigation tab objects in the desired order with two string properties ("id" and "label"). \
Double-quotes must be escaped with '\\'. \
Available tab IDs are "info", "readme", "source", "templateData", "styleData", "tree", and "example". \
Note: Certain tabs will only be shown if applicable to a given dependency`,
            splitCommaList,
            JSON.stringify(COMPODOC_DEFAULTS.navTabConfig)
        )
        .option(
            '--templates [folder]',
            'Path to directory of JavaScript template overrides (see docs/custom-templates.md)'
        )
        .option('--includes [path]', 'Path of external markdown files to include')
        .option(
            '--includesName [name]',
            'Name of item menu of externals markdown files',
            COMPODOC_DEFAULTS.additionalEntryName
        )
        .option(
            '--coverageTest [threshold]',
            'Test command of documentation coverage with a threshold (default 70)'
        )
        .option(
            '--coverageMinimumPerFile [minimum]',
            'Test command of documentation coverage per file with a minimum (default 0)'
        )
        .option(
            '--coverageTestThresholdFail [true|false]',
            'Test command of documentation coverage (global or per file) will fail with error or just warn user (true: error, false: warn)',
            COMPODOC_DEFAULTS.coverageTestThresholdFail
        )
        .option('--coverageTestShowOnlyFailed', 'Display only failed files for a coverage test')
        .option(
            '--unitTestCoverage [json-summary]',
            'To include unit test coverage, specify istanbul JSON coverage summary file'
        )
        .option(
            '--disableSourceCode',
            'Do not add source code tab and links to source code',
            COMPODOC_DEFAULTS.disableSourceCode
        )
        .option('--disableDomTree', 'Do not add dom tree tab', COMPODOC_DEFAULTS.disableDomTree)
        .option(
            '--disableTemplateTab',
            'Do not add template tab',
            COMPODOC_DEFAULTS.disableTemplateTab
        )
        .option('--disableStyleTab', 'Do not add style tab', COMPODOC_DEFAULTS.disableStyleTab)
        .option('--disableGraph', 'Do not add the dependency graph', COMPODOC_DEFAULTS.disableGraph)
        .option(
            '--disableCoverage',
            'Do not add the documentation coverage report',
            COMPODOC_DEFAULTS.disableCoverage
        )
        .option(
            '--disablePrivate',
            'Do not show private in generated documentation',
            COMPODOC_DEFAULTS.disablePrivate
        )
        .option(
            '--disableProtected',
            'Do not show protected in generated documentation',
            COMPODOC_DEFAULTS.disableProtected
        )
        .option(
            '--disableInternal',
            'Do not show @internal in generated documentation',
            COMPODOC_DEFAULTS.disableInternal
        )
        .option(
            '--disableLifeCycleHooks',
            'Do not show Angular lifecycle hooks in generated documentation',
            COMPODOC_DEFAULTS.disableLifeCycleHooks
        )
        .option(
            '--disableConstructors',
            'Do not show constructors in generated documentation',
            COMPODOC_DEFAULTS.disableConstructors
        )
        .option(
            '--disableRoutesGraph',
            'Do not add the routes graph',
            COMPODOC_DEFAULTS.disableRoutesGraph
        )
        .option('--disableSearch', 'Do not add the search input', COMPODOC_DEFAULTS.disableSearch)
        .option(
            '--disableDependencies',
            'Do not add the dependencies list',
            COMPODOC_DEFAULTS.disableDependencies
        )
        .option(
            '--disableDependenciesTab',
            'Do not add the per-component Dependencies tab (standalone import graph)',
            COMPODOC_DEFAULTS.disableDependenciesTab
        )
        .option(
            '--disablePlaygroundTab',
            'Do not add the Playground tab even when @playground blocks are present',
            COMPODOC_DEFAULTS.disablePlaygroundTab
        )
        .option(
            '--strictPlaygrounds',
            'Fail the build when a non-vendored @playground imports a subpath or symbol absent from the pinned dependency version (default: warn only)',
            COMPODOC_DEFAULTS.strictPlaygrounds
        )
        .option(
            '--disableProperties',
            'Do not add the properties list',
            COMPODOC_DEFAULTS.disableProperties
        )
        .option('--disableFilePath', 'Do not add the file path', COMPODOC_DEFAULTS.disableFilePath)
        .option(
            '--disableOverview',
            'Do not add the overview page',
            COMPODOC_DEFAULTS.disableOverview
        )
        .option(
            '--showEffects',
            'Show Angular effect() entries in a dedicated Effects block',
            COMPODOC_DEFAULTS.showEffects
        )
        .option(
            '--minimal',
            'Minimal mode with only documentation. No search, no graph, no coverage.',
            COMPODOC_DEFAULTS.minimal
        )
        .option('--customFavicon [path]', 'Use a custom favicon')
        .option('--customLogo [path]', 'Use a custom logo')
        .option('--gaID [id]', 'Google Analytics tracking ID')
        .option(
            '--publicApiOnly [path]',
            'Document only symbols exported from index.d.ts files in the specified dist folder'
        )
        .option(
            '--maxSearchResults [maxSearchResults]',
            'Max search results on the results page. To show all results, set to 0',
            String(COMPODOC_DEFAULTS.maxSearchResults)
        )
        .option('--stackblitz', 'Enable StackBlitz integration for examples')
        .option('--stackblitzTemplate [template]', 'StackBlitz project template ID for examples')
        .option(
            '--groupBy [strategy]',
            'Sidebar grouping strategy: folder, category, none (default: auto-detect)'
        )
        .option('--groupDepth [depth]', 'Max folder depth for group names', '2')
        .allowExcessArguments();
}
