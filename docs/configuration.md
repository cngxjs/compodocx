# Compodocx Configuration Reference

Compodocx generates static HTML documentation for Angular projects by analyzing TypeScript source code. Every aspect of the output can be configured through three methods:

1. **CLI flags** -- pass options directly when running `compodocx` or `compodoc`
2. **Config file** -- `.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml` (also `.yml`, `.js`, `.cjs`, `.mjs`, `.ts` and `compodocx.config.*`); the same `.compodocrc` / `compodoc.config.*` names are still found
3. **package.json** -- under a `compodocx` or `compodoc` property

Options are resolved in this order: CLI flags override config file values, which override defaults. The config file is looked up in the folder compodocx runs in (not in parent folders) unless explicitly specified with `-c`. The `compodocx` names are searched first: when a folder holds both a `.compodocxrc.json` and a `.compodocrc.json`, the `.compodocxrc.json` is used, and a `compodocx` key in `package.json` also wins over a `.compodocrc.json`.

## Quick Start

```bash
# Minimal: generate docs from a tsconfig
compodocx -p src/tsconfig.json

# Generate, serve, and watch for changes
compodocx -p src/tsconfig.json -s -w

# Custom output folder and title
compodocx -p src/tsconfig.json -d ./docs -n "My Project"

# Minimal mode (no search, no graphs, no coverage, no routes)
compodocx -p src/tsconfig.json --minimal
```

Example `.compodocxrc.json`:

```json
{
    "$schema": "./node_modules/@cngxjs/compodocx/src/config/schema.json",
    "tsconfig": "src/tsconfig.json",
    "output": "./documentation",
    "name": "My Angular Project",
    "theme": "ocean",
    "disablePrivate": true,
    "language": "de-DE"
}
```

The package ships the JSON schema of the config file at `./node_modules/@cngxjs/compodocx/src/config/schema.json`; point `$schema` at it for completion and validation in the editor.

---

## General

These options control the basic identity and language of the generated documentation.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| name | `-n, --name` | string | `'Application documentation'` | Title shown in the sidebar header and browser tab. Also used in the `<title>` element of every generated page |
| language | `--language` | string | `'en-US'` | UI language for all labels, headings, and navigation. Available: bg-BG, de-DE, en-US, es-ES, fr-FR, hu-HU, it-IT, ja-JP, ka-GE, ko-KR, nl-NL, pl-PL, pt-BR, ru-RU, sk-SK, zh-CN, zh-TW |
| config | `-c, --config` | string | -- | Explicit path to a config file. If omitted, compodocx searches the working folder for `.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml` (and the other `compodocx` names), a `compodocx` key in `package.json`, then the same `compodoc` names |
| tsconfig | `-p, --tsconfig` | string | -- | Path to the project's `tsconfig.json`. This is required -- compodocx uses the TypeScript compiler to analyze the source |
| include | _config-only_ | string[] | `[]` | Extra globs of source files to document, relative to the tsconfig folder. Added to the tsconfig `include` list |
| exclude | _config-only_ | string[] | `['**/.git', '**/node_modules', '**/*.d.ts', '**/*.spec.ts']` | Globs of source files to skip, relative to the tsconfig folder. Replaces the default list (repeat its entries to keep them) and is combined with the tsconfig `exclude` list |

## Output

Controls where and how the documentation is generated.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| output | `-d, --output` | string | `'./documentation/'` | Directory for the generated static site. Created if it doesn't exist. Contents are overwritten on each run |
| exportFormat | `-e, --exportFormat` | string | `'html'` | Output format. `html` generates a full static site. `json` writes the parsed data model to `<output>/documentation.json` (useful for custom tooling, see [Semantic fields in the JSON export](#semantic-fields-in-the-json-export), [`compodocx diff`](#compodocx-diff) and the JSON Schema and schema history in [json-export.md](json-export.md)). `llm-md` writes one Markdown file for language models: to stdout when no output folder is given (no `-d`, no `output` key), to `<output>/llm-context.md` when one is |
| jsonIndent | `--jsonIndent` | number | `0` | Indent of `documentation.json` with `exportFormat` `json`: `0` writes one line, `1` to `8` pretty-prints with that many spaces. Any other value stops the build with an error |
| multiVersion | `--multiVersion` / `--no-multiVersion` | boolean | `true` | When `true` (default), HTML output is written to `<output>/<versionLabel>/` and a `versions.json` manifest is maintained next to it; the topbar version switcher reads the manifest at runtime. Pass `--no-multiVersion` to restore the previous flat layout. Non-HTML exports (`json`, `llm-md`) ignore this flag. |
| versionLabel | `--versionLabel <label>` | string | (auto) | Override the version-subfolder name. Defaults to the nearest `package.json` `version`, prefixed with `v` (`1.2.3` → `v1.2.3`). Use `main`, `next`, `unreleased` for non-package builds. Hard error (exit 2) if no label can be resolved while `multiVersion` is on. |
| versionsRoot | `--versionsRoot <path>` | string | the `-d` folder | Where `versions.json` is read from / written to. Override when CI builds each version separately and stitches the deploys together later. |
| maxVersionsShown | `--maxVersionsShown <n>` | number | `10` | Cap on how many entries the switcher dropdown shows. `0` is unlimited. The manifest is always written in full - this is presentation-only. Range 0–1000. |

### Semantic fields in the JSON export

With `-e json`, every symbol entry (components, directives, classes, injectables, services, tokens, interfaces, pipes, guards, interceptors and the miscellaneous functions, variables, type aliases and enumerations) can carry facts from a project-wide analysis of the `-p` tsconfig (its `extends`, `paths` and `baseUrl` included). All fields are optional; an empty list or a `false` flag is never written, so a symbol without facts looks exactly as before. Only declarations their file exports are documented at all (`export` on the declaration, `export { name }` or `export default name`); file-local helpers get no entry, page or coverage row. A file without any import or export keeps all of its declarations. The HTML output builds on the same facts: the Dependency Injection chapter and the feature type pages, the "Used by" lists, the Provider, Feature and Injection context badges, and the symbols that reach no entry point, which get no page.

| Field | Type | Meaning |
|-|-|-|
| `entryPoint` | string | Import path of the nearest entry point that exports the symbol |
| `exportedBy` | string[] | Import paths of every entry point that exports the symbol, sorted |
| `notExported` | `true` | Exported from its file, inside an entry point, but reachable from no entry point. Symbols tagged `@internal` are never flagged. Such an entry has no `entryPoint`, `exportedBy` or `feature` |
| `usedBy` | `{ name, file }[]` | Top-level declarations of the same project that reference the symbol |
| `di.role` | `'provider'` \| `'feature'` | Provider: annotated return type `Provider`, `EnvironmentProviders`, an array or a union of them. Feature: returns the type a provider accepts as its rest parameter (`...features: T[]`), matched by name. Set only for functions their file exports; a function without any DI fact has no `di` field |
| `di.featureType` | `{ name, file }` | The feature type of a provider or feature function; providers sharing it belong together |
| `di.providesTokens` | `{ name, file }[]` | Tokens in `provide:` entries and classes listed directly, plus those of the providers and helper functions called there (one level). Set on provider functions and on components and directives, from the `providers` and `viewProviders` of their `@Component` / `@Directive`. `deps` and `useValue` arrays do not count |
| `di.readsTokens` | `{ name, file }[]` | Tokens read with `inject()`, directly or through one called helper |
| `di.usesInjectionContext` | `'direct'` \| `'call'` | Calls `inject()` or an Angular API that needs an injection context (`effect`, `toSignal`, `takeUntilDestroyed`, ... without an injector), directly or through exactly one called function, method or constructor |
| `di.configAccessor` | `true` | Function that returns a value read from a token its library configures through a provider with features |
| `token.shape` | string | Type argument of an `InjectionToken`/`HttpContextToken`: `interface`, `signal`, `function`, `primitive`, `union` or `other` |
| `token.providedBy` / `token.injectedBy` | `{ name, file }[]` | Providers, components and directives that provide the token / symbols that read it |
| `routedAt` | string[] | Components: full paths of the routes rendering the component |
| `mountedAt` | string[] | Route array variables: full paths of the places a router mounts the array at |
| `axes` | `Record<string, string>` | Values on the declared classification axes, by axis name. `semantic.axes` lists each axis with `label`, `values` (`{ value, count }`), `classified` and `unclassified` |

Entries with `notExported` stay in the JSON export; the HTML output gives them no page and the llm-md export leaves them out. They belong to no feature and no entry point. To read only the public API of a library, keep the entries whose `entryPoint` is set (in an application without entry points no entry has one).

Entry points are the `ng-package.json` entry files below the workspace, plus tsconfig `paths` targets without a wildcard that re-export from other files (`export ... from`). The top-level `semantic` object lists them (`importPath`, `file`, `source`) with the counts of the analysis, which the build log also prints as one `Semantic analysis:` line. Every `file` is relative to the working directory. `schemaVersion` is `6`.

Classes decorated with Angular's `@Service` (Angular 22, recognised by the import from `@angular/core`; a project decorator that is also called `Service` keeps its class a plain class) are written to the optional top-level `services` list, with the `@Injectable` fields plus `autoProvided` (when written as `true` or `false`) and `factory` (source text). The list is written only when there are services. `compodocx diff` reports them as `service-added`, `service-removed` and `service-changed`; the llm-md export lists them in the "Services / Injectables" section.

Two more optional fields come from the source: `tokens[].factory` holds the source of the `factory` option of `new InjectionToken(...)`, and a `providers` / `viewProviders` entry written as a call (`provideFoo(withMode('wide'))`) carries `call: { callee, args }`, where `args` lists the names of arguments that are calls themselves. `name` and `type` of such an entry are unchanged. Function guards and functional resolvers stay under `miscellaneous` with their `functionalKind`, although the HTML shows them as guards and resolvers.

Pages from [`includes`](#additional-content) are written to the optional top-level `additionalPages` list, in sidebar order, only when there are pages. Each entry has `slug` (the slug path below the includes folder, for example `guides/getting-started`), `title`, `label` (only when the sidebar label differs from the title), `file` (relative to the includes folder), `markdown` (the file as written, not the rendered HTML; relative links stay as they are), `aiGenerated` (only when the page has the `@aiGenerated` marker) and `children`. Page URLs and aliases are not part of the export. The llm-md export adds one section named after `includesName` (after "Routes", before "Design tokens") with every page in tree order under a `###` heading, its own headings moved down to start at `####` (fenced code untouched). Pages are included in full, so the file grows by about the size of the Markdown files.

## Serving

Compodocx includes a built-in dev server for previewing documentation locally.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| serve | `-s, --serve` | boolean | `false` | Start a local HTTP server after generation. Serves the output directory |
| port | `-r, --port` | number | `8080` | Port for the dev server |
| host | `--host` | string | `'127.0.0.1'` | Host address. Set to `0.0.0.0` to expose on the network |
| watch | `-w, --watch` | boolean | `false` | Watch the documented project's source files and rebuild documentation on changes. Requires `--serve`. This watches the *target project*, not compodocx's own source -- for compodocx development, use `npm run dev` instead |
| open | `-o, --open` | boolean | `false` | Automatically open the documentation in the default browser after serving |

## Theming

Compodocx ships with multiple built-in themes and supports custom CSS. All themes support light and dark mode.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| theme | `--theme` | string | `'default'` | Built-in theme name or path to a custom CSS file. Built-in themes: `default`, `ocean`, `ember`, `midnight`, `neon`, `brutalist`, `nord`, `rose-pine`, `gitbook`. A custom CSS file is loaded *instead of* the built-in theme, on top of the base styles; it can set `--color-cdx-accent` (active sidebar page and its rail, default orange) and `--color-cdx-focus-ring` (keyboard focus, default blue) in `:root` and `.dark`, and should when its sidebar is much darker or lighter than the default one, so the active page keeps a 4.5:1 contrast. Upstream compodoc theme names warn and map to a built-in theme (`material`, `original`, `readthedocs` to `default`; `postmark` to `nord`; `stripe` to `ocean`; `vagrant` to `midnight`; `laravel` to `ember`) |
| extTheme | `-y, --extTheme` | string | -- | **Deprecated** -- use `--theme` instead. When set and no `--theme` is provided, treated as a custom theme path. Does not load an additional stylesheet |
| shikiTheme | `--shikiTheme` | string | `'github-light:github-dark'` | Shiki syntax highlighting theme pair for code blocks. Format: `'light-theme:dark-theme'` or a single theme name used for both modes. Uses [Shiki's bundled themes](https://shiki.style/themes). Applies to both the Source Viewer and inline code snippets |
| customFavicon | `--customFavicon` | string | -- | Path to a custom favicon file (`.svg`, `.ico` or `.png`). Copied to `images/favicon.<ext>` and linked in every page's `<head>` instead of the bundled icon |
| customLogo | `--customLogo` | string | -- | Path to a custom logo image displayed in the sidebar header. Copied to `images/` under its own file name. Its size follows its aspect ratio: a wide logo fills the header width up to the height in `--cdx-sidebar-logo-max-height` (default `40px`), an icon is `--cdx-sidebar-logo-icon-size` high (default `28px`); a theme or custom CSS file can set both tokens in `:root`. See `logoLayout` |
| customLogoDark | `--customLogoDark` | string | -- | Path to a logo shown instead of `customLogo` while the dark mode is on (the toggle, or the system setting before the reader chose). Needs `customLogo` and a different file name, otherwise it warns and is ignored. Copied to `images/` under its own file name |
| logoLayout | `--logoLayout` | `'auto' \| 'icon' \| 'wordmark'` | `'auto'` | How the sidebar shows `customLogo`. `'wordmark'`: the logo alone, the project name as its alt text. `'icon'`: the logo next to the project name. `'auto'` reads the aspect ratio of an SVG (`viewBox`, else `width` and `height`) or PNG: 2:1 and wider is a wordmark, narrower an icon; other formats and unreadable files are a wordmark. Another value warns and keeps `'auto'` |
| hideGenerator | `--hideGenerator` | boolean | `false` | Remove the "Built with compodocx" link in the page footer |
| hideDarkModeToggle | `--hideDarkModeToggle` | boolean | `false` | Remove the light/dark mode toggle button from the top-right header area |

The [dependency graph](#dependency-graph) colours each node kind with its own token, so a theme can recolour one kind without touching the entity badges:

| Token | Default |
|-|-|
| `--color-cdx-graph-kind-component` | `--color-cdx-entity-component` |
| `--color-cdx-graph-kind-directive` | `--color-cdx-entity-directive` |
| `--color-cdx-graph-kind-pipe` | `--color-cdx-entity-pipe` |
| `--color-cdx-graph-kind-service` | `--color-cdx-entity-service` (also the colour of the impact wave) |
| `--color-cdx-graph-kind-token` | `--color-cdx-entity-token`; slate `#94a3b8` in dark mode |
| `--color-cdx-graph-kind-provider` | `--color-cdx-entity-function` |
| `--color-cdx-graph-kind-external` | `--color-cdx-text-muted` |

Set them in `:root` and `.dark`. The relation strokes reuse three of them: composes the directive colour, injects the service colour, provides the provider colour; uses in template is drawn in the muted text colour. The glyphs keep kinds apart where two kinds share a colour.

## Visibility Filters

These flags control which class members and entity details appear in the documentation. They filter at the member level -- the entity page still exists, but specific sections are hidden.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| disablePrivate | `--disablePrivate` | boolean | `false` | Hide `private` members from all entity pages. Affects properties, methods, and accessors marked `private` |
| disableProtected | `--disableProtected` | boolean | `false` | Hide `protected` members from all entity pages |
| disableInternal | `--disableInternal` | boolean | `false` | Hide members marked with the `@internal` JSDoc tag. Useful for public-facing documentation |
| disableLifeCycleHooks | `--disableLifeCycleHooks` | boolean | `false` | Hide Angular lifecycle hooks (`ngOnInit`, `ngOnDestroy`, etc.) from method listings |
| disableConstructors | `--disableConstructors` | boolean | `false` | Hide the constructor section from entity pages |
| disableProperties | `--disableProperties` | boolean | `false` | Hide the entire properties section (inputs, outputs, and regular properties) |
| disableDependencies | `--disableDependencies` | boolean | `false` | Hide the dependencies section on the Info tab. This section shows the `inject()` calls of the class |
| disableFilePath | `--disableFilePath` | boolean | `false` | Hide the source file path shown in the entity hero area |
| showEffects | `--showEffects` | boolean | `false` | Show Angular `effect()` entries in a dedicated "Effects" block on the API tab. When disabled (default), effects appear as regular properties. Opt-in because effects are implementation details in most projects |
| publicApiOnly | `--publicApiOnly` | string | -- | Restrict documentation to the public API. The public names come from `*.api.md` reports (API Extractor) below the tsconfig folder, or, without one, from the `index.d.ts` files in the given dist folder, or, without those, from the declaration files that `exports[*].types` of each `package.json` in it names (Angular Package Format, `types/<pkg>.d.ts`); such names are matched to the source entry point with the same import path, and an import path without one is named in a warning. Each name is followed through re-exports, `export *`, aliases and nested barrels to the symbol it declares; an alias in a `*.api.md` report is not followed. Useful for library authors who want to document only the public API |

## Feature Toggles

These flags disable entire features, tabs, or pages. Unlike visibility filters which hide individual members, these remove whole sections of the documentation.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| disableSourceCode | `--disableSourceCode` | boolean | `false` | Remove the Source tab from all entity pages and hide all "Defined in" source links. No source code is included in the output |
| disableDomTree | `--disableDomTree` | boolean | `false` | Remove the DOM Tree tab from component pages |
| disableTemplateTab | `--disableTemplateTab` | boolean | `false` | Remove the Template tab from component pages |
| disableStyleTab | `--disableStyleTab` | boolean | `false` | Remove the Style tab from component pages |
| disableGraph | `--disableGraph` | boolean | `false` | Remove the dependency graph from the overview page; `js/graph.js` is not written. The per-component Dependencies tab is controlled by `disableDependenciesTab`. See [Dependency graph](#dependency-graph) |
| disableDependenciesTab | `--disableDependenciesTab` | boolean | `false` | Remove the per-component Dependencies tab that shows the component's neighbourhood in the dependency graph. The overview graph and other graphs are not affected |
| disablePlaygroundTab | `--disablePlaygroundTab` | boolean | `false` | Remove the per-component Playground tab even when `@playground` JSDoc blocks are present in the source |
| disableRoutes | `--disableRoutes` | boolean | `false` | Do not read routes: no routes page, no menu entry, no Routed at / Mounted at links, no route entries in the command palette and no `routes` in the exports. See [Routes](#routes). The removed `--disableRoutesGraph` / `disableRoutesGraph` are ignored with a warning |
| disableSearch | `--disableSearch` | boolean | `false` | Remove the Pagefind search functionality. Disables the command palette (Ctrl+K), the search input, and skips Pagefind index generation at build time |
| disableCoverage | `--disableCoverage` | boolean | `false` | Remove the documentation coverage report page. Coverage measures how many public members have JSDoc descriptions |
| disableOverview | `--disableOverview` | boolean | `false` | Remove the overview/dashboard page that shows project-level statistics and the main dependency graph |
| disableMarkdownPages | `--disableMarkdownPages <pages>` | string[] | `[]` | Root Markdown files of the working directory not to build as pages: `changelog` (CHANGELOG.md), `contributing` (CONTRIBUTING.md), `license` (LICENSE.md or LICENSE), `todo` (TODO.md). A listed file gets no page, no sidebar link and no search entry. Comma-separated on the CLI (`--disableMarkdownPages changelog,license`); the flag replaces the config value. An unknown entry is ignored with a warning; the README stays the index page |
| minimal | `--minimal` | boolean | `false` | Shorthand that disables search, all graphs, routes and the coverage report in one flag. Equivalent to `--disableSearch --disableGraph --disableRoutes --disableCoverage` |

## Dependency graph

The overview page draws the project as one graph: every component, directive, pipe, service (`@Injectable` and Angular 22 `@Service`), injection token and provider function that an entry point exports, plus the external imports components use in their templates. Interfaces, classes, type aliases and variables are not part of it.

| Relation | Read from | Drawn as |
|-|-|-|
| Uses in template | a component's `imports` | solid line |
| Composes | `hostDirectives` of a component or directive | double line |
| Injects | `inject()` of a token or service (one call level deep) | dashed line |
| Provides | a provider function's provided tokens | dotted line |

A short bright head at the target end shows the direction. Directives and pipes a template uses without importing them are not known to compodocx and draw no edge.

- **Islands.** Symbols sit in a rounded island per feature (see [Features](#features)), labelled with the feature name. Edges inside an island are drawn clearly, edges between islands stay faint until one end is hovered.
- **Kinds.** Every kind is a circle that the fill tells apart (component filled, directive a ring, pipe a half-filled ring, service a ring with a core, token a small dot, provider a ring with an inner ring, external a dashed ring), so kinds stay distinct without colour. Filter chips above the graph show and hide each kind and give its count; tokens, providers and external imports start off. A change lays the graph out again from the current positions, so the nodes glide to their new places.
- **Layout.** The layout is computed during the build with a fixed seed, so it is the same on every build, and written for the default chips to `js/graph.js` in the version root. The overview loads that script when the graph scrolls into view; it works from `file://` too.
- **Build-up.** On first view the islands fade in, then the symbols appear level by level, primitives first: a symbol sits one level above the highest level of what it uses, a cycle shares one level. The Replay button plays it again.
- **Hover and click.** Hovering a symbol highlights its neighbourhood and sends particles along its relations in import direction. Clicking it shows everything that uses it, directly or through others, hop by hop; a badge names the symbol, links to its page and counts the symbols that use it, how many directly and across how many features. Click it again or the background to clear. A modifier or middle click on a symbol opens its page like any link.
- **Labels** keep their size at every zoom level and never overlap each other or a node; more appear when zooming in.
- **Motion.** Under `prefers-reduced-motion` the graph shows its final state at once, without build-up, particles or pulses.
- **Screen readers** get a list of the relations grouped by feature (symbol: what it uses, composes, injects and provides).

The **Dependencies** tab of a component page shows the component's direct neighbourhood from the same graph: every relation in both directions and of every kind, what uses the component on the left and what it uses on the right. A click on a neighbour opens its page; external imports link to their page on angular.dev. The tab appears whenever the component has a relation.

The colours of the node kinds come from theme tokens, see [Theming](#theming).

## Navigation

Controls sidebar behavior and entity page tab configuration.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| toggleMenuItems | `--toggleMenuItems` | string[] | `['all']` | Sidebar chapters that start open. The default `['all']` keeps every chapter collapsed, and `'all'` anywhere in the list does the same. Otherwise list the chapters to open, comma-separated on the CLI: `components`, `directives`, `entities`, `classes`, `injectables`, `services` (classes with Angular's `@Service`), `dependency-injection`, `guards`, `interfaces`, `interceptors`, `pipes`, `resolvers`, `utilities`, `styles` (the Style files chapter under `menuLayout: 'type'`), `additionalPages`, and `features` (the Features chapter under `menuLayout: 'feature'`; References is a single top-level link with no collapsible tree, so it is not a valid key). Unlisted chapters start collapsed. `modules`, `miscellaneous` and `tokens` are ignored with a warning. `collapsedAll: true` overrides this list |
| navTabConfig | `--navTabConfig` | object[] | `[]` | Customize the order and labels of entity page tabs. Array of `{ id, label }` objects. Available tab IDs: `info` (overview/metadata), `readme` (component README), `api` (member surface), `source` (source code), `templateData` (component template), `styleData` (component styles), `theming` (theme tokens), `tree` (DOM tree), `example` (examples), `playground` (`@playground` blocks). Tabs not listed are hidden. If empty (default), all applicable tabs are shown in their default order |
| exampleUrlBase | `--exampleUrlBase <url>` | string | `''` | Base URL for relative `<example-url>` tags in class JSDoc (the Example tab shows each one in an iframe). A relative tag is appended to the base with one slash between them, so `<example-url>/#/forms/select</example-url>` with base `https://example.github.io/demo` gives `https://example.github.io/demo/#/forms/select`; absolute URLs (`https:`, `//host`) stay as written. The resolved URL is also written to `exampleUrls` in the JSON export. Without a base, relative tags stay as written, load relative to the page (which fails when the site is opened from disk) and are listed in one build warning |

## Coverage

Compodocx tracks documentation coverage -- the percentage of public members that have JSDoc descriptions. These options configure thresholds and reporting.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| coverageTest | `--coverageTest` | number | off | Global documentation coverage threshold as a percentage; setting it turns the coverage test on. A number (or numeric string) is the threshold; `true` or the flag without a value uses `70`. Used in CI to enforce minimum documentation |
| coverageMinimumPerFile | `--coverageMinimumPerFile` | number | off | Per-file minimum coverage percentage; setting it turns the per-file test on. Each file must meet this threshold individually. `true` or the flag without a value uses `0` |
| coverageTestThresholdFail | `--coverageTestThresholdFail` | boolean | `true` | When `true`, a coverage threshold breach exits with a non-zero code (fails CI). When `false`, only a warning is printed. The config value applies when the key is set (`true`/`false` or `'true'`/`'false'`); the flag overrides it only when given on the command line |
| coverageTestShowOnlyFailed | `--coverageTestShowOnlyFailed` | boolean | `false` | In coverage output, show only files that fall below the threshold |
| files | `--files` | string | -- | Run only the per-file coverage test on the given source files and generate no documentation; needs `--coverageMinimumPerFile`. Repeat the flag for several files (`--files src/a.ts --files src/b.ts`), for example in a pre-commit hook. The `files` config key instead adds source files to the documented set |
| unitTestCoverage | `--unitTestCoverage` | string | -- | Path to an Istanbul JSON coverage summary file (`coverage-summary.json`). When provided, unit test coverage data is integrated into the documentation coverage report, showing both documentation and test coverage side by side |

## Additional Content

Include external documentation, static assets, or supply custom templates.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| includes | `--includes` | string | -- | Path to a folder of external markdown files, absolute or relative to the working directory (also in a config file). A folder that does not exist is reported with a warning. Each `.md` file becomes a page in the documentation, accessible via a dedicated sidebar section. Supports nested folders for sub-navigation |
| includesName | `--includesName` | string | `'Additional documentation'` | Sidebar label for the external markdown pages section |
| includesLabels | `--includesLabels` | string | -- | Path to a JSON file keyed by page slug, each entry with an optional `label` (sidebar text) and `title` (page title). Read only when `includes` is set. See [Additional pages](additional-pages.md) |
| aiGeneratedNote | _config-only_ | string | `''` (i18n default) | Sentence shown next to the "AI generated" chip of a page or symbol marked `@aiGenerated` (Markdown pages with `<!-- @aiGenerated [value] -->` as their first line, symbols with the JSDoc tag). `{value}` is replaced by the marker value, or by nothing for a bare marker. Empty uses the translated default, "Drafted with AI assistance." or, with a value, "Drafted with AI assistance (value)." |
| assetsFolder | `-a, --assetsFolder` | string | -- | Path to a folder of static assets (images, files) copied into the output directory. Referenced from markdown or custom templates via relative paths |
| templates | `--templates` | string | -- | Path to a directory containing JS template overrides. Each file exports a function `(data, helpers) => string` that replaces the corresponding built-in template. See [Custom Templates](custom-templates.md) for the full API. Handlebars `.hbs` files in `partials/` are skipped with one warning. The removed `--templatePlayground` / `templatePlayground` are ignored with a warning |

## Sidebar Grouping

Controls how symbols are organized in the sidebar. Both layouts group symbols by feature; see [Features](#features) below. `groupBy`, `groupDepth` and `featureLibraryScope` are no longer read: a config file that sets them logs a warning, and the `--groupBy` / `--groupDepth` flags are dropped with a warning.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| menuLayout | _config-only_ | `'feature' \| 'type'` | `'feature'` | Whole-sidebar layout. `'feature'` shows one **Features** chapter: the entry points as a tree of their import path segments (`forms` > `select`), each feature below its entry point and its members below it: the primary members (components, directives, pipes, injectables, classes, guards, interceptors, resolvers, entities) and style files at the top, the other roles in collapsed nodes (see `menuFeatureSections`; the whole surface flat for a feature without a primary member), plus a top-level link to the **`references.html`** portal, which lists every documented symbol grouped by entry point and feature and filters by kind, stability, feature and free text. Each feature label links its feature page. `'type'` keeps one chapter per kind (Components / Directives / Injectables / ...), each grouped by feature. The Utilities and Dependency Injection chapters are shown under `'type'` only; under `'feature'` their landing pages are linked from the portal header. `toggleMenuItems` accepts `features` |
| featuresName | _config-only_ | string | `''` (i18n default) | Override the **Features** chapter heading under `menuLayout: 'feature'`. Empty falls back to the translated `features` i18n key. Use this to keep non-English builds aligned without adding locale entries |
| referencesName | _config-only_ | string | `''` (i18n default) | Exposed on `data.referencesName` for `menu.js` / `api-reference.js` custom-template overrides that want a non-i18n label. The built-in sidebar link reads the localised `reference` key and the portal heading reads `api-reference`; neither consumes `referencesName` directly today |
| menuFeatureSections | _config-only_ | `Record<role, 'own' \| 'more' \| 'top' \| 'hidden'>` | `{ configuration: 'own', utilities: 'more', constants: 'more', types: 'more' }` | Where each member role of a feature shows in the sidebar under `menuLayout: 'feature'`, for features with a primary member. Roles: `configuration` (tokens, providers, feature functions and feature types; the members of a provider cluster fold into one entry for their feature type), `utilities` (functions), `constants` (constants), `types` (interfaces, type aliases, enums). Values: `own` (a collapsed node of its own), `more` (a labelled group inside one collapsed **More** node), `top` (flat next to the primary members), `hidden` (not in the sidebar; still on the feature page, in the API reference and in search). Missing roles keep their default; an unknown role or value is ignored with a warning |
| collapsedAll | _config-only_ | boolean | `false` | Force every sidebar chapter AND every nested group to start collapsed on first load. Overrides `toggleMenuItems` (which only controls top-level chapters) and the default expansion of the first two group levels. Useful for large codebases where the default produces a wall of expanded links. Works under both `menuLayout` modes |
| features | _config-only_ | `Record<string, string>` | `{}` | Feature keys by file glob. Keys are globs over file paths relative to the working directory (`**` any path, `*` and `?` inside one segment), values a feature key: one segment of lower-case letters, digits and dashes, relative to the file's entry point (or the app). The first matching glob in object order wins. It never moves a symbol into another entry point. Invalid keys are ignored with a warning |
| featureContainers | _config-only_ | string[] | `['features', 'pages', 'domains']` | App folders whose sub-folders are the features: `src/app/features/admin` gives the feature `admin` |
| featureUtilityFolders | _config-only_ | string[] | `['internal', 'i18n', 'utils', 'testing', '__test-helpers', 'examples']` | Folders below an entry point that belong to its root feature instead of forming a feature of their own |
| featureRoleFolders | _config-only_ | string[] | `['config', 'di', 'providers', 'services', 'components', 'directives', 'pipes', 'models', 'types', 'interfaces', 'tokens', 'routes', 'guards', 'interceptors', 'resolvers', 'state', 'store']` | Folders named after a role. A file in one joins the feature its file name starts with (`di/toast.providers.ts` joins `toast` of the same entry point or app), otherwise the root feature; such a folder never becomes a feature of its own. `[]` turns the rule off |
| classificationAxes | _config-only_ | `Record<string, { values, label?, paths?, default?, kinds? }>` | `{}` | Classification axes, each a badge and a search filter on symbol pages. See [Classification axes](#classification-axes) |
| styleFiles | _config-only_ | string[] | `[]` | Globs of free-standing `.css` / `.scss` files to document, relative to the config file's folder (the `-p` tsconfig folder without a config file). Braces work (`*.{css,scss}`). `node_modules`, `dist`, `.git` and the output folder are never matched; matches of another file type warn once and are ignored; a file a component already reads through `styleUrl` / `styleUrls` stays on that component's Theming tab. A value that is not a list of non-empty strings warns and is ignored. Style files join features like symbols. See [Style files](#style-files) |

## Features

Every documented symbol belongs to a feature: an entry point, then a feature key below it. Features never span entry points. Per symbol, the first rule that applies decides:

1. **Config.** The first glob of `features` that matches the symbol's file.
2. **Tag.** An `@feature <key>` tag on the symbol.
3. **Imports (libraries).** Inside an entry point (an `ng-package.json` entry file or a barrel-shaped tsconfig `paths` target), the first folder below the entry root (leading `src/` and `lib/` skipped) is a candidate feature. Files at the entry root and the `featureUtilityFolders` belong to the root feature. A file in one of the `featureRoleFolders` (`di/`, `routes/`, `components/`, ...) joins the feature its file name starts with (`di/toast.providers.ts` joins `toast`), otherwise the root feature, so a library sorted by role still groups by feature. When the entry point has at least four such folders and one of them (not a utility folder) is imported by at least half of the others, the whole entry point is one feature. Otherwise two folders join when they import each other or when imports between them come from at least two file pairs, imports into such a widely used folder not counted. Each group of joined folders is one feature, named after its alphabetically first folder. Nested entry points are never folders of their parent.
4. **Entry point.** Anything else inside an entry point is its root feature.
5. **Folder (apps, and library files outside every entry point).** The first folder below `src/app` (or `app`, or the common folder of the documented files); for a folder named in `featureContainers`, the folder below it; for a folder named in `featureRoleFolders`, the feature its file name starts with, else the app's root feature. Files directly in the app folder form the app's root feature, named after the nearest `package.json` `name`, else `app`.

The build log prints one line, `Features: <n> in <e> entry points (config <a>, tag <b>, cohesion <c>, entry point <d>, folder <e>), <l> family links`, and every feature page shows its detector. A feature that uses the components, directives, pipes, classes or services of a feature in another entry point "builds on" it (the target is used by at most a quarter of all features); two features of one name in different entry points are linked when one uses the other. A shared name alone never links.

Every feature gets a page, `index.html` in the feature's folder `<entry point>/<feature>/` (the entry point's import path without a scope shared by all entry points; an app feature at `<feature>/`), and the pages of its symbols live in the same folder: the import path, the `README.md` of the feature folder (for a root feature, the entry file's folder, then the `ng-package.json` folder) with relative links to other features' READMEs or folders pointing at their pages, the features of an entry point, the members by role (components and directives, pipes, services, configuration, utilities, constants, types, classes), links to the members' Theming tabs, and the features it builds on or that extend it. Symbol pages show entry point and feature in their breadcrumb.

`@category` and `@docsKind` are no longer read. A build that still finds them logs one warning with every location; `compodocx migrate jsdoc <dir>` removes them (`--dry-run` to preview, `--json` for a report).

## Classification axes

An axis classifies symbols by a property of your own choosing, such as stability, atomic-design level or platform. Axes are off until the config file declares one:

```json
{
    "classificationAxes": {
        "stability": {
            "label": "Stability",
            "values": ["stable", "experimental"],
            "paths": { "projects/*/src/labs/**": "experimental" },
            "default": "stable"
        },
        "level": {
            "label": "Level",
            "values": ["atom", "molecule", "organism"],
            "kinds": ["component", "directive"]
        }
    }
}
```

| Key | Meaning |
|-|-|
| axis name | One segment of lower-case letters, digits and dashes |
| `values` | Required. The allowed values, each one word |
| `label` | Heading of the badge and the search facet; default the axis name |
| `paths` | File globs relative to the working directory (same syntax as `features`) mapped to a value; the first match in object order wins |
| `default` | Value for symbols without a tag or a matching path |
| `kinds` | Symbol kinds the axis applies to: `component`, `directive`, `pipe`, `injectable`, `class`, `interface`, `token`, `guard`, `interceptor`, `resolver`, `entity`, `function`, `variable`, `typealias`, `enumeration`. Default: all |

A symbol gets its value per axis from an `@axis <name> <value>` tag on its declaration, else from the first matching `paths` glob, else from `default`. A symbol of a kind the axis does not apply to has no value. Invalid config parts warn once each and are dropped. Tag problems (an undeclared axis or value, a kind the axis does not apply to, a missing value, a second tag for the same axis) are logged once per problem with up to three locations; the symbol then falls back to its path rule or default. When axes are declared, the build log prints one line such as `Axes: stability 40/40 classified, level 12/18 classified (6 unclassified)`; `@axis` tags without declared axes log one notice and are ignored.

Each value shows as a `<label>: <value>` chip in the symbol page hero and as an `axis-<name>` search filter, so the search palette offers one facet per axis. Axes never change URLs, features, the sidebar or the menu. The JSON export carries the values per symbol (`axes`) and the declared axes with their counts (`semantic.axes`); llm-md prints an `Axes:` line per classified symbol.

## Routes

compodocx reads the routes of the documented files through the project analysis (the `-p` tsconfig) and shows them on `routes.html`, which is generated only when there are routes.

- **Routers.** Every `bootstrapApplication(<component>, <config>)` call starts one: the config may be an object, a named config (also from another file) or `mergeApplicationConfig(a, b, ...)`. Each `provideRouter(<routes>, ...<features>)` in its `providers` (array elements, spreads and named provider arrays are followed) is one router; two bootstraps of the same config share it. A `provideRouter` call no bootstrap reaches (a test config) is not a router.
- **Route arrays.** A variable or `export default` typed `Routes`, `Route[]` or `Array<Route>` (annotation, `satisfies` or `as`) imported from `@angular/router`, including aliased and namespace imports. Untyped arrays count when a router reaches them as its routes argument, a spread, `children` or a `loadChildren` target.
- **Lazy routes.** `loadChildren` and `loadComponent` in the forms `() => import('./x').then(m => m.X)`, `.then(({ X }) => X)`, `async () => (await import('./x')).X` and `() => import('./x')` (default export). A `loadChildren` route array is expanded below its route; a `loadComponent` target links to the component. A package specifier is shown as external; a computed specifier or a loader built by a call is kept as source text.
- **Values.** Paths, redirects, titles and outlets the type checker can evaluate (string literals, consts, enum members, templates of those) are shown as text; anything else as its source in braces, for example `/{PATHS.home}`. Guards, resolvers, providers and router features keep their source, with the callee linked when it is documented. `data` is kept as source text.
- **Unmounted routes.** An exported route array that no router mounts (a library shipping feature routes) gets a section of its own. Unexported ones are left out.
- **Not read.** `RouterModule.forRoot` / `forChild`, string `loadChildren`, routes built at runtime by a function (shown as one node with the call), `Router.navigate` calls and `routerLink`.

The build log prints `Routes: <n> in <r> routers, <u> unmounted (<l> lazy, <d> dynamic values)`; what was skipped is logged at debug level. Component pages list the routes they are rendered at, route array variables the places they are mounted at, and feature pages the routes of their members. `--disableRoutes` turns all of it off.

## Analytics

Integrate Google Analytics 4 (gtag.js) tracking into the generated documentation. Both SPA-style navigation and full page loads are tracked.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| gaID | `--gaID` | string | -- | Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`). When set, the gtag.js script is injected into every page. The removed `--gaSite` / `gaSite` (Universal Analytics) are ignored with a warning |

## Playground (`@playground`)

The modern path for runnable component demos. Add `@playground <title>` JSDoc blocks to a component class and compodocx assembles a fresh, complete StackBlitz Angular project per block at build time. The SDK is lazy-loaded on first click; static doc pages stay light.

Three authoring modes, dispatched by the trailing token on the tag line:

| Mode | Tag form | Source of truth |
|-|-|-|
| Inline | `@playground <title>` + fenced HTML/TS code block | the JSDoc comment |
| HTML file | `@playground <title> ./path/to/file.html` | external `.html` file |
| TS component | `@playground <title> ./path/to/file.component.ts` | a real `@Component` class with optional `templateUrl`/`styleUrl`/`styleUrls` and any number of relative imports |

All three modes share the same scaffold (an Angular CLI standalone project on a WebContainer template). Its Angular version follows your project: the `@angular/core` range from your `package.json` (`dependencies`, then `peerDependencies`), `^21.0.0` when none is declared. Material widgets are auto-detected: when the demo references known Material selectors or attribute directives, `@angular/material` and `@angular/cdk` are force-pinned and the prebuilt theme is wired up automatically. Bare-specifier imports in any walked source are auto-forwarded with the version your `package.json` declares.

In TS-component mode, `templateUrl` / `styleUrl` / `styleUrls` are resolved from a **string or a plain template literal** (`templateUrl: \`./x.component.html\``). A value the resolver can't statically resolve - an interpolated literal (`` `./x.${variant}.html` ``) or a computed identifier (`styleUrls: STYLES`) - **fails that playground with a clear error** naming the decorator, rather than silently shipping it without its template/styles. Use a literal path, or inline the `template` / `styles` in the demo component.

### Material app shell (fonts + body classes)

The Roboto / Material-Icons font `<link>`s and the `mat-typography mat-app-background` body classes (the "Material app shell", matching Angular Material's `ng add`) are normally emitted only when the Material auto-detect fires. That misses libraries that are merely *themed to look like* Material via a Sass theme bridge - their templates contain no `<mat-*>` element, so without the shell Roboto never loads and the app background is missing.

The shell is now decoupled from Material module wiring and is emitted when **any** of these hold:

- the real `<mat-*>` auto-detect fired (unchanged - this also adds `@angular/material`/`@angular/cdk` and the prebuilt theme);
- `playgroundMaterialShell: true` is set in the config (forces the shell on every playground);
- a bundled playground file contains a Sass `@use` of a Material theme bridge, i.e. it matches `@use '…material…theme'` (e.g. `@use '@cngx/themes/material/azure-theme';`).

In the flag and heuristic cases, **only** the shell is injected - `@angular/material`/`@angular/cdk` are **not** added to dependencies and no Material modules are added to `AppComponent.imports`. That wiring stays gated behind the real `<mat-*>` auto-detect.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| disablePlaygroundTab | `--disablePlaygroundTab` | boolean | `false` | Hide the per-component Playground tab even when `@playground` blocks are parsed. Independent of `--disableDependenciesTab`. No effect on components without `@playground` blocks (the tab is already absent). |
| strictPlaygrounds | `--strictPlaygrounds` | boolean | `false` | **Fail** the build when a non-vendored `@playground` imports a subpath or named symbol absent from the version of the package pinned in `node_modules`. Default (off) only **warns**. See [Pre-publish breakage guard](#pre-publish-breakage-guard-strictplaygrounds). |
| playgroundDependencies | -- (config-only) | object | `{}` | Extra packages to inject into every StackBlitz manifest's `dependencies`, with the version specifier YOU choose. Wins over the consumer-`package.json` auto-forward AND any auto-detected version (e.g. Material). Use for libraries the consumer ships but doesn't `npm install` directly (peer-only CSS themes), or to pin a per-build version. The value is forwarded into the generated `package.json` **unchanged** - see [Non-registry dependency sources](#non-registry-dependency-sources) for the accepted forms. |
| playgroundMaterialShell | -- (config-only) | boolean | `false` | Force the Material app shell (Roboto + Material-Icons font links and the `mat-typography mat-app-background` body classes) into every `@playground` `index.html`, independent of Material auto-detect. For libraries themed to look like Material via a Sass theme bridge. Does **not** add `@angular/material`/`@angular/cdk` or Material module imports. See [Material app shell](#material-app-shell-fonts--body-classes). |
| playgroundDepDepth | -- (config-only) | number | `3` | Max import depth followed when walking a `@playground`'s dependency graph. Raise for deeply-nested examples. Range 1–100. |
| playgroundFileCountCap | -- (config-only) | number | `25` | Hard ceiling on the number of source files in one `@playground` manifest. Exceeding it fails **that** playground with a message naming the component and the walked files (other playgrounds still build). Raise for large multi-file examples. Range 1–1000. |
| playgroundFileCap | -- (config-only) | number | `8000` | Per-file character cap before a bundled `@playground` source is truncated with a footer. Raise when a legitimately large source is being cut off. Range 500–1,000,000. |
| playgroundHead | -- (config-only) | string[] | `[]` | Arbitrary `<head>` entries injected into every `@playground` `index.html` (after the Material shell links, when present). For custom fonts, meta tags, CSP, or preloads. Each entry is emitted verbatim; blank entries are dropped. See [Custom `<head>` and global styles](#custom-head-and-global-styles). |
| playgroundGlobalStyles | -- (config-only) | string | `''` | Global styles appended to every `@playground` global stylesheet, after the default body reset. For fonts, resets, or any global rules the examples depend on. Leading statement at-rules (`@import` / `@charset` / `@layer name;` / `@use` / `@forward`) are hoisted above the reset so they stay valid. If the value carries a Sass prelude (`@use` / `@forward`) the sheet is emitted as `src/styles.scss` (and wired into `angular.json`) so the Angular builder compiles it with Sass - e.g. applying a global Material theme bridge; otherwise it is `src/styles.css`. |
| playgroundVendor | -- (config-only) | string[] | `[]` | Package names and/or globs (`"@cngx/*"`) to vendor into `@playground` projects from the locally built `dist/` instead of the npm registry. When a playground imports a matching package, a slimmed, entry-point-pruned slice of its built directory (plus the transitive closure of other matching packages) is embedded in the manifest and wired as a `file:` dependency - so the playground runs against the working tree, not the last published release. See [Vendoring the local build](#vendoring-the-local-build-playgroundvendor). |
| playgroundVendorRoot | -- (config-only) | string | `dist` | Base directory the `playgroundVendor` closure is read from. Each matched package is located by its `package.json` `name`, anywhere under this root - the directory name need not match the package name. |
| playgroundVendorCap | -- (config-only) | number | `1500000` | Backstop byte cap on a single playground's slimmed-and-pruned vendored closure. Defaults to ~1.5 MB, set under StackBlitz's ~2 MB project-POST limit so an oversized closure fails the build instead of producing a manifest that 413s on launch. Range 50 000–2 000 000. Raising it past the StackBlitz limit re-opens the 413 it prevents. |
| playgroundVendorIncludeSourcemaps | -- (config-only) | boolean | `false` | Keep `*.map` sourcemaps in vendored packages. Off by default - sourcemaps are a large slice of FESM byte size and the WebContainer build never reads them. |

```jsonc
// compodocx.config.json
{
    "tsconfig": "projects/ui-kit/tsconfig.lib.json",
    "output": "docs/",
    "publicApiOnly": "dist/ui-kit",
    "playgroundDependencies": {
        "@my-org/ui-kit": "^1.0.0",
        "@my-org/themes": "next"
    }
}
```

#### Custom `<head>` and global styles

The Material shell covers the common case (Roboto + Material-Icons). For anything else a playground needs in the page shell, `playgroundHead` and `playgroundGlobalStyles` let you contribute to the generated `index.html` `<head>` and `src/styles.css` directly - these extend the **same** shell writer the Material option uses, so they compose with it rather than replacing the scaffold.

```jsonc
// compodocx.config.json
{
    "playgroundHead": [
        "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">",
        "<link href=\"https://fonts.googleapis.com/css2?family=Inter&display=swap\" rel=\"stylesheet\">",
        "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'\">"
    ],
    "playgroundGlobalStyles": ":root { --brand: #0066ff; }\nbody { font-family: Inter, sans-serif; }"
}
```

`playgroundHead` entries land inside `<head>` (after the Material shell links if those are emitted); `playgroundGlobalStyles` is appended after the default body reset in the generated global stylesheet, so the reset still applies. Statement at-rules (`@import` / `@charset` / `@layer name;` / `@use` / `@forward`) are automatically hoisted above the reset. A value containing a Sass prelude (`@use` / `@forward`) is written to `src/styles.scss` and wired into `angular.json` so Sass compiles it (use this for a global Material theme bridge, e.g. `@use '@cngx/themes/material/azure-theme';`); a plain-CSS value stays `src/styles.css`. Both settings are global (every playground in the build); per-block customization is available through a custom `block-playground` template override.

#### Providers and routing: `@playgroundConfig`

A playground that needs `provideRouter`, HTTP interceptors, or any application providers ships an `app.config.ts`. Annotate the documented component with a component-level `@playgroundConfig` JSDoc tag pointing at a relative `.ts` file:

```ts
/**
 * @playgroundConfig ./playground/app.config.ts
 *
 * @playground Routed demo ./playground/router-demo.component.ts
 */
@Component({ selector: 'app-nav', /* … */ })
export class NavComponent {}
```

The referenced file is shipped as the project's `src/app/app.config.ts` (its transitive relative imports are bundled too), and the generated `src/main.ts` wires `bootstrapApplication(AppComponent, appConfig)`. The file **must export `appConfig`**. One `@playgroundConfig` per component applies to all of that component's `@playground` blocks (inline and file-ref alike).

This replaces the older, undocumented trick of adding `export { appConfig } from './app.config'` to the example component purely so the file got bundled - that still works for back-compat, but `@playgroundConfig` is the supported, explicit way.

#### Non-registry dependency sources

`playgroundDependencies` values (and any version specifier the consumer's own `package.json` declares for an auto-forwarded library) are written into the generated playground `package.json` verbatim - compodocx never rewrites them to a semver range against `latest`. So any specifier npm itself understands works, letting a playground pin an unpublished build instead of waiting for a registry release:

| Form | Example |
|-|-|
| Exact version / prerelease | `"0.1.0-rc.2"` |
| dist-tag | `"next"` |
| Tarball URL | `"https://example.com/pkg/ui-1.2.3.tgz"` |
| Git ref | `"git+https://github.com/my-org/ui.git#feature/tabs"` |

StackBlitz's WebContainer runs a real `npm install`, so it resolves each of these the same way a local install would. When the package you want to pin lives in your **own** workspace and is built but not yet published, vendoring (below) skips the registry entirely.

#### Vendoring the local build (`playgroundVendor`)

A registry dependency always resolves to the last **published** version, so a playground that imports a symbol which only exists in your working tree fails to compile in the sandbox, and an unreleased bugfix shows stale. `playgroundVendor` fixes this by embedding the locally built `dist/` into the payload - the same mechanism compodocx already uses to inline your example sources, one level deeper.

```jsonc
// compodocx.config.json
{
    "tsconfig": "projects/ui/tsconfig.lib.json",
    "output": "docs/",
    "playgroundVendor": ["@cngx/*"],   // names and/or globs
    "playgroundVendorRoot": "dist"      // default; where the built libs live
}
```

How it works, per playground:

- **Closure, not just the direct import.** Starting from the packages the example imports, compodocx walks the matching (`playgroundVendor`) dependency graph and vendors the **full closure**. Vendoring `@cngx/ui` but pulling its `@cngx/common`/`@cngx/core` deps from npm would reintroduce the skew, so the whole closure is embedded. Peer deps that do **not** match a pattern (`@angular/*`, `rxjs`, `tslib`, …) stay registry dependencies. SCSS-only dependencies count too: a `@use '@cngx/themes/material/x-theme'` in a component's styles seeds the closure exactly like a TS import would, so a theme bridge is never left to resolve stale from the registry.
- **Slimmed, not verbatim.** Each package ships only what the WebContainer build reads: `fesm2022/*.mjs`, typings (`*.d.ts`), and every `package.json` (root + secondary entry points, with the `exports` map intact). Sourcemaps (`*.map`) and legacy/duplicate bundle directories (`esm2022/`, `fesm2020/`, …) are dropped - together usually the majority of dist bytes. Set `playgroundVendorIncludeSourcemaps: true` to keep the maps.
- **Pruned to the imported entry points.** Vendoring all of `@cngx/common` when the playground imports only `@cngx/common/tabs` is the main payload lever, so for each closure package only the entry points actually reached ship: the ones imported (from TS or SCSS), plus any sibling/cross-package entry point a kept FESM chunk or its typings references, followed transitively. Unreached entry points are dropped. Pruning is conservative - a package whose entry-point structure can't be read with confidence (no `exports` map), or for which an imported subpath maps to no known entry point, is shipped whole rather than risk a broken build.
- **Wired as `file:` deps.** Each vendored package is placed under `vendor/<pkg>/` and declared as `"<pkg>": "file:vendor/<pkg>"` in the generated `package.json`. A root `file:` entry is authoritative: it overrides any registry version and any transitive semver range, so no closure package is pulled from npm.

**Prerequisite:** the libraries must be **built before** compodocx runs (`dist/` present). A typical `docs:full` script already builds the libs first. If `playgroundVendor` names a package whose build output is missing, the docs build **fails** with a clear message (`playgroundVendor: "@cngx/ui" not found under dist - run the library build`) rather than silently falling back to a stale registry version. A glob that matches nothing only warns.

**Size - the StackBlitz POST limit is the real constraint.** `@stackblitz/sdk`'s `openProject` submits the whole project as a single form POST; StackBlitz's edge rejects bodies past roughly **2 MB** with `413 Request Entity Too Large`. The slimming and entry-point pruning above exist to keep the vendored payload comfortably under that. `playgroundVendorCap` (default ~1.5 MB, under the POST limit to leave room for the scaffold files and form-encoding overhead) is a **backstop**: a closure that still exceeds it fails the build naming the packages and measured bytes - and, when the payload is also over the StackBlitz limit, says so explicitly - never a silent truncation or a manifest that 413s on click.

#### Pre-publish breakage guard (`--strictPlaygrounds`)

For playgrounds whose imports are served from the **registry** (i.e. not vendored), compodocx checks each bare import against the version of the package actually installed in your `node_modules` - the version StackBlitz would resolve. When the example imports an entry point or a named symbol that the pinned version does not have (`import { CngxTabNav } from '@cngx/ui/tabs'` while the published `@cngx/ui` predates `tabs`), the playground compiles locally but fails in the sandbox. The guard surfaces that at docs-build time:

- **Default:** a per-playground **warning** naming the specifier/symbol and the pinned version.
- **`--strictPlaygrounds`:** the same finding **fails** the build.

Two checks run, both biased toward **no false positives**: a *subpath* check against the pinned package's `exports` map, and a *symbol* check that scans the entry-point `.d.ts`. Anything the static check can't determine - a legacy package without an `exports` map, or typings that re-export via wildcard (`export * from …`) - is left unreported. Vendored packages (`playgroundVendor`) and framework peers (`@angular/*`, `rxjs`, …) are exempt: the former ship the local build, the latter are pinned by the manifest itself.

The static guard is fast but conservative. For full certainty that every playground actually compiles, use the `playground:validate` command below, which performs a real build.

#### `compodocx playground:validate <docsDir>`

A standalone command that **compiles every `@playground`** in a generated documentation folder and reports a per-playground pass/fail summary - the strongest guard, catching breakage the static `--strictPlaygrounds` check can't. It reads the manifests back out of the produced HTML, materializes each StackBlitz project to a temp directory, and runs `npm install` + `npm run build` (`ng build`) against the resolved (and vendored) dependencies.

```bash
# Generate docs, then validate every playground compiles
compodocx -p tsconfig.json -d documentation
compodocx playground:validate documentation
```

| Flag | Description |
|-|-|
| `--filter <text>` | Only validate playgrounds whose title / id / source page matches |
| `--keep` | Keep the temporary project directories for inspection |
| `--installCmd <cmd>` | Override the install command (default `npm install --no-audit --no-fund`) |
| `--buildCmd <cmd>` | Override the build command (default `npm run build`) |

Exit codes: `0` all passed (or none found), `1` at least one failed, `2` fatal (bad args / unreadable docs dir). The command is opt-in and **decoupled from the docs build** - it never slows normal generation. Because it runs a real `npm install` per project, it needs network access and is much slower than the build itself; run it as a CI step after the docs are produced rather than on every local build.

For the complete authoring guide (folder layout, library-author workflow, troubleshooting), see [the Playground guide on compodocx.dev](https://compodocx.dev/guides/playground/).

## Legacy `@stackblitz <url>` integration

Predates `@playground`. The `@stackblitz <url>` JSDoc tag adds a single "Open in StackBlitz" link in the entity hero, pointing at a pre-existing StackBlitz project the author maintains externally. No build-time assembly, no manifest. Use `@playground` for new projects - `@stackblitz` is kept for migration compatibility.

## Search

Compodocx uses [Pagefind](https://pagefind.app/) for client-side search. The search index is generated at build time by scanning the output HTML. Users access it via the command palette (Ctrl+K / Cmd+K).

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| maxSearchResults | `--maxSearchResults` | number | `15` | Maximum number of results shown in the search command palette, an integer from `0` to `10000`. Set to `0` to show all results (may be slow for large projects). Also read from the config file; the flag wins when both are set. Any other value stops the build with an error |
| searchFacetLimit | `--searchFacetLimit` | number | `8` | Filter chips each facet of the search command palette (Kind, Library, Feature, WCAG, axes) shows before a "+N more" toggle that expands the rest, an integer from `0` to `1000`. Chips are ordered by count; an active filter stays visible past the limit. Set to `0` to show every chip. Also read from the config file; the flag wins when both are set. Any other value stops the build with an error |

Above the results the palette shows a filter chip for every value of each facet: Kind, Library, Feature, WCAG and one per declared classification axis. Without a query the chips count the whole index, so the API can be browsed by clicking a chip; with a query they count the matches. Chips within a facet combine with OR, facets with AND, and the active filters are kept in the URL (`?q=&kind=&feature=`). A facet with more values than `searchFacetLimit` shows the most frequent ones and a "+N more" chip.

## Logging

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| silent | `-t, --silent` | boolean | `false` | Suppress all console output during generation. Useful in CI pipelines where only the exit code matters |

## Sub-commands

Three commands share the `compodocx` binary. Each has its own flags and `--help`.

### `compodocx diff`

Compares two `documentation.json` exports (`--exportFormat json`) and reports the components, directives, pipes, injectables, services, guards, interceptors, classes and interfaces that were added, removed or changed, sorted into breaking, additive and docs-only changes.

```bash
compodocx -p tsconfig.json -e json -d snapshots/old   # on the old commit
compodocx -p tsconfig.json -e json -d snapshots/new   # on the new commit
compodocx diff --old snapshots/old/documentation.json --new snapshots/new/documentation.json
```

| Flag | Description |
|-|-|
| `--old <file>` | The older export (required) |
| `--new <file>` | The newer export (required) |
| `--json` | Write a machine-readable JSON report to stdout |
| `--md` | Write a Markdown table to stdout, for changelogs |
| `--no-warnings` | Console output only: leave out non-breaking changes (breaking changes are still shown) |

Exit codes: `0` no breaking and no additive change, `1` additive changes only, `2` at least one breaking change or a fatal error (unreadable file, missing flag, an export whose `schemaVersion` is not the one this compodocx writes). Both exports must have the current schema; re-export older ones. Routes, `styleFiles` and `additionalPages` are not compared.

### `compodocx migrate jsdoc <dir>`

Removes the `@category` and `@docsKind` tags, which compodocx no longer reads, from the `.ts` files below `<dir>`. `--dry-run` lists them without writing, `--json` prints a machine-readable report.

### `compodocx playground:validate <docsDir>`

Builds every `@playground` of a generated documentation folder; see [`compodocx playground:validate <docsDir>`](#compodocx-playgroundvalidate-docsdir) in the Playground section.

---

## Entity Page Structure

Each documented entity (component, directive, service, class, etc.) gets a detail page with two main tabs:

**Info tab** -- Overview information: import statement, deprecation banner, description, JSDoc examples, decorator metadata, host bindings, providers, dependencies (`inject()` calls), and relationship graph.

**API tab** -- Member surface: index grid, inputs, outputs, derived state (computed/linkedSignal), properties, methods, accessors, index signatures, host bindings, host listeners.

Additional tabs (Source, Template, Style, DOM Tree, README, Example) appear based on the entity type and available data. Tab visibility and order can be controlled via `navTabConfig`.

The Info, API and Theming tabs accept config-file-only string arrays that opt regions in or out:

| Option | Type | Default | Description |
|-|-|-|-|
| infoTabSections | string[] | `[]` | Override the section list for the Info tab. Empty means all defaults render. Available IDs: `import`, `deprecated`, `description`, `examples`, `metadata`, `extends`, `host`, `dependencies`, `providers`, `viewProviders`, `relationships` |
| apiTabSections | string[] | `[]` | Override the section list for the API tab. Empty means all defaults render. Available IDs: `index`, `inputs`, `outputs`, `derivedState`, `effects`, `properties`, `methods`, `accessors`, `indexSignatures`, `hostBindings`, `hostListeners` |
| themingTabSections | string[] | `[]` | Override the section list for the Theming tab. Empty means all defaults render. Available IDs: `overview`, `index`, `tokens`, `mixins`, `source` (the default order) |

These are config-file only (no CLI flag). An explicit non-empty list replaces the default in full -- list every region you want, in the order you want them.

## Theming Tab

Components grow a **Theming** tab when the parser finds documented theme tokens or mixins inside their `styleUrls` or inline `styles[]`, or when a style file listed in [`styleFiles`](#style-files) themes them with `@themes`; directives get the tab from `@themes` files. Tokens are described with a small inline-doc convention -- no separate manifest, no companion files. The same convention works for SCSS variables, CSS custom properties, and `@property` at-rules.

> Authoring a stylesheet from scratch or retrofitting an existing one? See [the theming tokens authoring guide](theming-tokens-authoring-guide.md) for copy-paste recipes, `@themes`, `@relatedTo`, documented mixins, anti-patterns, and a verification loop.

### SCSS variables -- SassDoc `///` blocks

```scss
/// Padding inside the alert container.
/// @type Length
/// @default 12px 16px
/// @group container
$alert-padding: 12px 16px !default;
```

The `///` block must sit immediately above the `$variable: value [!default];` declaration. Any non-comment line in between cancels the association. Private variables (`$_x`, `$-x`) are not listed, as Sass keeps them out of the module.

### CSS custom properties -- JSDoc `/** */` blocks

```css
/**
 * Background color of the alert container.
 * @type <color>
 * @default #f8fafc
 * @group container
 */
:host {
    --cngx-alert-bg: #f8fafc;
}
```

The doc block can sit directly above the property OR above a wrapping selector that contains the property as its first declaration. Single-asterisk `/* */` blocks are ignored -- only `/**` opens a doc comment.

### Native `@property` at-rules -- runtime-typed tokens

```css
/**
 * Inner gap between icon, body, and dismiss button.
 * @group container
 */
@property --cngx-alert-gap {
    syntax: '<length>';
    inherits: true;
    initial-value: 12px;
}
```

`@property` is the recommended pattern when you can target browsers that support it. The browser-native `syntax` populates the **Type** column and `initial-value` populates the **Default** column -- explicit `@type` / `@default` tags still win when both are set.

### Tag set

| Tag | Value | Effect |
|-|-|-|
| `@overview` | markdown body, may span multiple lines | File-level intro paragraph rendered above the index. Multiple `@overview` blocks across resolved style files are concatenated in source order |
| `@type` | CSS type expression (`<length>`, `<color>`, `Number`, ...) | Renders in the Type cell next to the token name |
| `@default` | string | Renders in the Default cell. Falls back to the literal declaration value when omitted |
| `@group` | identifier | Groups tokens under a sub-heading on the Theming tab. Missing group means the token sits in the flat default bucket |
| `@example` | fenced code block, multi-line, repeatable | Rendered as a Shiki-highlighted snippet below the description |
| `@since` | version string | Adds a "since" pill next to the token name |
| `@deprecated` | optional reason | Strikes through the token name and renders the reason as muted prose |
| `@see` | URL or token name (`--other-token`, `$other-var`), repeatable | Cross-link footer. Token references resolve to in-page anchors |
| `@relatedTo` | `Name[, Name]` | On a token: a "Related" row linking the named symbols (unresolved names render as code). At file level: a Related section on the style page |
| `@cssprop` (alias `@cssproperty`) | `{<syntax>} [--name=default] - description`, repeatable | Documents a property the component reads but never sets (a hook), in the form of the custom-elements-manifest. The block never attaches to the next declaration. Shown with a "Hook" badge; JSON `kind` is `css-hook`. Also read inside an `@overview` block |
| `@themes` | `Name[, Name...]`, file level, repeatable | Links a [style file](#style-files) to the components and directives it themes, resolved like `{@link}` names. Written in the `@overview` block or in a block of its own (a block carrying `@themes` never documents the declaration after it) |
| `@internal` | none | Hides what the block documents (token, `@property`, hook, mixin or function) from the docs, see [Hiding tokens from the docs](theming-tokens-authoring-guide.md#hiding-tokens-from-the-docs). In an `@overview` block it hides the `@cssprop` lines only. The block is never reported as unattached |

Documented SCSS mixins and functions: a `///` block directly above `@mixin name(...)` or `@function name(...)` with `@param` (SassDoc `@param {Type} $name [default] - text` or plain `@param $name text`), `@content`, `@return`, `@example`, `@since`, `@deprecated`, `@see` and `@relatedTo`. Parameters come from the signature, so a parameter without a `@param` line is still listed. Private names (`_x`, `-x`) and undocumented mixins are not shown. They render in the **Mixins** section of the Theming tab and on the style page.

Unknown tags are dropped, not added to the description. Tags inside an `@overview` block other than `@themes`, `@relatedTo` and `@cssprop` count as unknown. The build logs them once per run and exits with code 0:

```text
Style comments: 2 unknown tags ignored (@todo x1, @note x1)
  src/theming/button.css:14 @todo
  src/theming/button.css:31 @note
```

Two more groups appear in the same place when they apply: `Style comments: <n> doc blocks not attached` (a block with token tags that documents nothing, with `file:line` of its first line) and `Style comments: <n> hook tokens also declared in their sheets, declaration kept` (a `@cssprop` for a property the same sheet declares). A name documented in several sheets of one component is listed once, the `@property` winning over a plain declaration.

### Hidden tokens

Custom properties whose name starts with `--_` are hidden from the docs: they have no row on the Theming tab, the style page or `design-tokens.html`, and no entry in `documentation.json` or `llm-context.md`. This applies to `@property` rules and declarations, documented or not. A `@cssprop` hook stays, because naming a property in that tag is an explicit choice to document it. CSS has no private custom properties; `--_` is a naming convention for helpers that only the stylesheet itself reads, and the property still works in the browser.

| Option | Type | Default | Description |
|-|-|-|-|
| themingPrivatePrefix | string \| false | `'--_'` | Prefix of the custom properties hidden from the docs. Must start with `--` and name at least one more character, for example `'--private-'`. `false` lists every property. Any other value logs a warning and the default stays. Config file only |

```json
{
    "themingPrivatePrefix": false
}
```

A style file whose tokens are all hidden, and that has no overview and no documented mixin, gets no page of its own. To hide a single token whatever its name, add `@internal` to its doc block (see [Hiding tokens from the docs](theming-tokens-authoring-guide.md#hiding-tokens-from-the-docs)).

### Source resolution

For each component, compodocx reads the `@Component` decorator's `styleUrls` relative to the component file and parses each entry. Inline `styles[]` strings are parsed identically. SCSS files have their top-level `@import` and `@use` rules followed **one level deep**, so you can keep tokens in a partial like `_tokens.scss` and re-export from the component stylesheet. Deeper transitive resolution is intentionally out of scope.

Components without documented tokens or mixins get no Theming tab. Directives get one only from style files that name them in `@themes`. Other entity kinds (services, classes, ...) never produce a Theming tab.

### Style files

`styleFiles` (config-only, see [Sidebar Grouping](#sidebar-grouping)) lists free-standing `.css` / `.scss` files: theme bridges, directive assets, global token sheets.

```json
{ "styleFiles": ["projects/*/theming/**/*.css", "projects/themes/**/*.{css,scss}"] }
```

A matched file is documented when it has an `@overview`, at least one documented token (a description, `@type` or `@group`; an undocumented `@property` alone does not count) or a documented SCSS mixin or function. Files without documented content get no page and no export entry. The build log prints:

```text
Style files: 12 (5 pages, 6 linked to 8 symbols, 1 without documented content)
1 style files have no documented tokens, mixins or overview: projects/themes/legacy.css
```

The second line names the first five files, then `...`.

- **Linking.** `@themes Name[, Name...]` (comma or space separated, several lines add up) links the file to the components and directives it themes. Its tokens, overview (under a sub-heading with the file name) and source join each target's Theming tab, which names the linked files ("Style files: x.css", linked to the file's page when it has one). A name that is not found, is another kind or names several components or directives logs one warning per file, for example `Style file <file>: @themes X not found; @themes Y is not a component or directive`. There is no matching by selector, token name or file name.
- **Pages.** A file that themes no symbol, themes two or more, or has documented mixins gets a page, `<file name>.html` in its feature folder (`stylesheets/` without project analysis facts): file name, CSS/SCSS badge, entry point and feature breadcrumb, import line, then Overview, Theming (the symbols it themes), Tokens, Mixins and Source (when `source` is in `themingTabSections` and `disableSourceCode` is off). A file that themes exactly one symbol and has no mixins shows on that symbol's tab only. The import line comes from the nearest `package.json` `exports` entry that maps the file exactly or through one `*` pattern (`@use '<name>/<subpath>';` for SCSS, `@import '<name>/<subpath>';` for CSS) and is left out otherwise.
- **Features and navigation.** Style files are placed into features like symbols (they never move a symbol); a folder holding only style files can become a feature of its own. The feature layout lists style pages after a feature's primary members, the type layout has a **Style files** chapter (`toggleMenuItems` key `styles`), `references.html` lists them under their feature, and search shows them as kind "Style". Feature pages list their style pages (first sentence of the overview, token and mixin counts) and their components and directives with a Theming tab.
- **Design tokens page.** `design-tokens.html` collects the documented tokens of every style file that themes no symbol, grouped by `@group` (the default group first, then by name), with name, type, default, description and the defining file. Token anchors are `token-<name>` and group anchors `group-<slug>`; a name defined again in a later file gets `-2` and one warning. The page is generated only when such tokens exist and is linked from the Features chapter, the Style files chapter, `references.html` and the feature pages that feed it.
- **Exports.** The JSON export lists documented files under the optional top-level `styleFiles` (`file`, `language`, `overview`, `tokens`, `mixins`, `themes`, `relatedTo`, `feature`), their sources join `styleSources`, and themed directives carry `themeTokens`, `themeOverview` and `themeStyleSources`. A token's `kind` is `css-custom-property`, `scss-variable`, `css-at-property` or `css-hook` (a property the component reads, written with `@cssprop`); a name documented in several sheets of one component appears once. `compodocx diff` does not compare `styleFiles`. The llm-md export adds a "Design tokens" section.

## JSDoc Tags

Compodocx recognizes these custom JSDoc tags on any entity or member:

| Tag | Effect |
|-|-|
| `@since <version>` | Adds a version badge to the entity hero |
| `@beta` | Adds a "Beta" badge |
| `@aiGenerated [value]` | Adds an "AI generated" chip and, below the hero badges, a sentence with the value (for example a model name or a date); the text is set with `aiGeneratedNote`. The JSON export carries `aiGenerated` |
| `@breaking <version>` | Adds a "Breaking" badge with version |
| `@internal` | Hides the member when `--disableInternal` is set |
| `@feature <key>` | Puts the symbol into the feature `<key>` of its entry point (or app), above the detected feature; the `features` config wins over the tag. One segment of lower-case letters, digits and dashes |
| `@axis <name> <value>` | Sets the symbol's value on the classification axis `<name>`, above its path rule and default. Only read for axes declared in `classificationAxes`; see [Classification axes](#classification-axes) |
| `@wcag <level>` | Renders a colored WCAG-conformance chip in the entity hero. Accepts `A`, `AA`, or `AAA` (case-insensitive); other values log a build-time warning and fall back to no chip. Also surfaces as a `data-pagefind-filter="wcag:<level>"` span so the search-palette WCAG facet can narrow to a specific level |
| `@a11y <markdown>` | Free-form accessibility note. Parsed and stored on `IDep.a11yNote` so it lives in the JSON / LLM-md exports and stays queryable, but intentionally not rendered on entity pages - the `@wcag` hero chip is the user-visible accessibility-conformance signal |
| `@storybook <url>` | Adds a Storybook link in the entity hero |
| `@figma <url>` | Adds a Figma link in the entity hero |
| `@stackblitz <url>` | Adds a StackBlitz link in the entity hero |
| `@github <url>` | Adds a GitHub link in the entity hero |
| `@docs <url>` | Adds a documentation link in the entity hero |
| `@example` | Code examples rendered in the Info tab with syntax highlighting |
| `@playground <title> [<path>]` | Runnable demo on the component's Playground tab. Title required. Optional trailing `./*.html` or `./*.ts` path triggers file-ref mode (see Playground section). |
| `@slot <name> <description>` | Adds a row to the component's Slots section in the Info tab |
| `@overview` (in CSS / SCSS) | Prose intro at the top of the Theming tab |
| `@group <name>` (on a CSS / SCSS token) | Groups the token under this heading on the Theming tab |
| `@themes <Name>` (in a CSS / SCSS style file) | Links the file to the components and directives it themes, see [Style files](#style-files) |
| `@relatedTo <Name>` (in CSS / SCSS) | Related-symbol links on a token, mixin or style page |
