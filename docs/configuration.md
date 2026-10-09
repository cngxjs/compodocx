# Compodocx Configuration Reference

Compodocx generates static HTML documentation for Angular projects by analyzing TypeScript source code. Every aspect of the output can be configured through three methods:

1. **CLI flags** -- pass options directly when running `compodocx` or `compodoc`
2. **Config file** -- `.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml` (also supports legacy `.compodocrc` variants)
3. **package.json** -- under a `compodocx` or `compodoc` property

Options are resolved in this order: CLI flags override config file values, which override defaults. The config file is auto-discovered in the project root unless explicitly specified with `-c`.

## Quick Start

```bash
# Minimal: generate docs from a tsconfig
compodocx -p src/tsconfig.json

# Generate, serve, and watch for changes
compodocx -p src/tsconfig.json -s -w

# Custom output folder and title
compodocx -p src/tsconfig.json -d ./docs -n "My Project"

# Minimal mode (no search, no graphs, no coverage)
compodocx -p src/tsconfig.json --minimal
```

Example `.compodocxrc.json`:

```json
{
    "tsconfig": "src/tsconfig.json",
    "output": "./documentation",
    "name": "My Angular Project",
    "theme": "ocean",
    "disablePrivate": true,
    "language": "de-DE"
}
```

---

## General

These options control the basic identity and language of the generated documentation.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| name | `-n, --name` | string | `'Application documentation'` | Title shown in the sidebar header and browser tab. Also used in the `<title>` element of every generated page |
| language | `--language` | string | `'en-US'` | UI language for all labels, headings, and navigation. Available: bg-BG, de-DE, en-US, es-ES, fr-FR, hu-HU, it-IT, ja-JP, ka-GE, ko-KR, nl-NL, pl-PL, pt-BR, ru-RU, sk-SK, zh-CN, zh-TW |
| config | `-c, --config` | string | -- | Explicit path to a config file. If omitted, compodocx searches for `.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml`, or a `compodocx`/`compodoc` key in `package.json` |
| tsconfig | `-p, --tsconfig` | string | -- | Path to the project's `tsconfig.json`. This is required -- compodocx uses the TypeScript compiler to analyze the source |

## Output

Controls where and how the documentation is generated.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| output | `-d, --output` | string | `'./documentation/'` | Directory for the generated static site. Created if it doesn't exist. Contents are overwritten on each run |
| exportFormat | `-e, --exportFormat` | string | `'html'` | Output format. `html` generates a full static site. `json` exports the parsed data model as JSON files (useful for custom tooling) |
| base | -- | string | `'/'` | Base URL path prepended to all generated links. Set this when hosting docs in a subdirectory (e.g. `'/my-project/'`) |
| multiVersion | `--multiVersion` / `--no-multiVersion` | boolean | `true` | When `true` (default), HTML output is written to `<output>/<versionLabel>/` and a `versions.json` manifest is maintained next to it; the topbar version switcher reads the manifest at runtime. Pass `--no-multiVersion` to restore the previous flat layout. Non-HTML exports (`json`, `llm-md`) ignore this flag. |
| versionLabel | `--versionLabel <label>` | string | (auto) | Override the version-subfolder name. Defaults to the nearest `package.json` `version`, prefixed with `v` (`1.2.3` → `v1.2.3`). Use `main`, `next`, `unreleased` for non-package builds. Hard error (exit 2) if no label can be resolved while `multiVersion` is on. |
| versionsRoot | `--versionsRoot <path>` | string | the `-d` folder | Where `versions.json` is read from / written to. Override when CI builds each version separately and stitches the deploys together later. |
| maxVersionsShown | `--maxVersionsShown <n>` | number | `10` | Cap on how many entries the switcher dropdown shows. `0` is unlimited. The manifest is always written in full — this is presentation-only. Range 0–1000. |

### Semantic fields in the JSON export

With `-e json`, every symbol entry (components, directives, classes, injectables, tokens, interfaces, pipes, guards, interceptors and the miscellaneous functions, variables, type aliases and enumerations) can carry facts from a project-wide analysis of the `-p` tsconfig (its `extends`, `paths` and `baseUrl` included). All fields are optional; an empty list or a `false` flag is never written, so a symbol without facts looks exactly as before. The HTML output builds on the same facts: the Dependency Injection chapter and the feature type pages, the "Used by" lists, the Provider, Feature and Injection context badges, and the symbols that reach no entry point, which get no page.

| Field | Type | Meaning |
|-|-|-|
| `entryPoint` | string | Import path of the nearest entry point that exports the symbol |
| `exportedBy` | string[] | Import paths of every entry point that exports the symbol, sorted |
| `notExported` | `true` | Exported from its file, inside an entry point, but reachable from no entry point. Symbols tagged `@internal` are never flagged |
| `usedBy` | `{ name, file }[]` | Top-level declarations of the same project that reference the symbol |
| `di.role` | `'provider'` \| `'feature'` | Provider: annotated return type `Provider`, `EnvironmentProviders`, an array or a union of them. Feature: returns the type a provider accepts as its rest parameter (`...features: T[]`), matched by name |
| `di.featureType` | `{ name, file }` | The feature type of a provider or feature function; providers sharing it belong together |
| `di.providesTokens` | `{ name, file }[]` | Tokens in `provide:` entries of a provider, plus those of providers it calls |
| `di.readsTokens` | `{ name, file }[]` | Tokens read with `inject()`, directly or through one called helper |
| `di.usesInjectionContext` | `'direct'` \| `'call'` | Calls `inject()` or an Angular API that needs an injection context (`effect`, `toSignal`, `takeUntilDestroyed`, ... without an injector), directly or through exactly one called function, method or constructor |
| `token.shape` | string | Type argument of an `InjectionToken`/`HttpContextToken`: `interface`, `signal`, `function`, `primitive`, `union` or `other` |
| `token.providedBy` / `token.injectedBy` | `{ name, file }[]` | Providers that provide the token / symbols that read it |

Entry points are the `ng-package.json` entry files below the workspace, plus tsconfig `paths` targets without a wildcard that re-export from other files (`export ... from`). The top-level `semantic` object lists them (`importPath`, `file`, `source`) with the counts of the analysis, which the build log also prints as one `Semantic analysis:` line. Every `file` is relative to the working directory. `schemaVersion` stays `3`.

Two more optional fields come from the source: `tokens[].factory` holds the source of the `factory` option of `new InjectionToken(...)`, and a `providers` / `viewProviders` entry written as a call (`provideFoo(withMode('wide'))`) carries `call: { callee, args }`, where `args` lists the names of arguments that are calls themselves. `name` and `type` of such an entry are unchanged. Function guards and functional resolvers stay under `miscellaneous` with their `functionalKind`, although the HTML shows them as guards and resolvers.

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
| theme | `--theme` | string | `'default'` | Built-in theme name or path to a custom CSS file. Built-in themes: `default`, `ocean`, `ember`, `midnight`, `neon`, `brutalist`, `nord`, `rose-pine`. A custom CSS file is loaded *instead of* the built-in theme |
| extTheme | `-y, --extTheme` | string | -- | **Deprecated** -- use `--theme` instead. When set and no `--theme` is provided, treated as a custom theme path. Does not load an additional stylesheet |
| shikiTheme | `--shikiTheme` | string | `'github-light:github-dark'` | Shiki syntax highlighting theme pair for code blocks. Format: `'light-theme:dark-theme'` or a single theme name used for both modes. Uses [Shiki's bundled themes](https://shiki.style/themes). Applies to both the Source Viewer and inline code snippets |
| customFavicon | `--customFavicon` | string | -- | Path to a custom favicon file. Copied into the output and referenced in the HTML `<head>` |
| customLogo | `--customLogo` | string | -- | Path to a custom logo image displayed in the sidebar header |
| hideGenerator | `--hideGenerator` | boolean | `false` | Remove the "Built with compodocx" link in the page footer |
| hideDarkModeToggle | `--hideDarkModeToggle` | boolean | `false` | Remove the light/dark mode toggle button from the top-right header area |

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
| disableDependencies | `--disableDependencies` | boolean | `false` | Hide the dependencies section on the Info tab. This section shows `inject()` calls and constructor-injected services |
| disableFilePath | `--disableFilePath` | boolean | `false` | Hide the source file path shown in the entity hero area |
| showEffects | `--showEffects` | boolean | `false` | Show Angular `effect()` entries in a dedicated "Effects" block on the API tab. When disabled (default), effects appear as regular properties. Opt-in because effects are implementation details in most projects |
| publicApiOnly | `--publicApiOnly` | string | -- | Restrict documentation to symbols exported from `index.d.ts` files in the given dist folder. Only these symbols (and their dependencies) are documented. Useful for library authors who want to document only the public API |

## Feature Toggles

These flags disable entire features, tabs, or pages. Unlike visibility filters which hide individual members, these remove whole sections of the documentation.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| disableSourceCode | `--disableSourceCode` | boolean | `false` | Remove the Source tab from all entity pages and hide all "Defined in" source links. No source code is included in the output |
| disableDomTree | `--disableDomTree` | boolean | `false` | Remove the DOM Tree tab from component pages |
| disableTemplateTab | `--disableTemplateTab` | boolean | `false` | Remove the Template tab from component pages |
| disableStyleTab | `--disableStyleTab` | boolean | `false` | Remove the Style tab from component pages |
| disableGraph | `--disableGraph` | boolean | `false` | Remove all dependency graphs -- both the overview page graph and per-component dependency tabs |
| disableDependenciesTab | `--disableDependenciesTab` | boolean | `false` | Remove the per-component Dependencies tab that shows the standalone import graph. The overview graph and other graphs are not affected |
| disablePlaygroundTab | `--disablePlaygroundTab` | boolean | `false` | Remove the per-component Playground tab even when `@playground` JSDoc blocks are present in the source |
| disableRoutesGraph | `--disableRoutesGraph` | boolean | `false` | Remove the routes graph page. The page visualizes the Angular router configuration as a tree |
| disableSearch | `--disableSearch` | boolean | `false` | Remove the Pagefind search functionality. Disables the command palette (Ctrl+K), the search input, and skips Pagefind index generation at build time |
| disableCoverage | `--disableCoverage` | boolean | `false` | Remove the documentation coverage report page. Coverage measures how many public members have JSDoc descriptions |
| disableOverview | `--disableOverview` | boolean | `false` | Remove the overview/dashboard page that shows project-level statistics and the main dependency graph |
| minimal | `--minimal` | boolean | `false` | Shorthand that disables search, all graphs, and the coverage report in one flag. Equivalent to `--disableSearch --disableGraph --disableCoverage` |

## Navigation

Controls sidebar behavior and entity page tab configuration.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| toggleMenuItems | `--toggleMenuItems` | string[] | `['all']` | Sidebar sections that start collapsed. Pass `'all'` to collapse everything, or a comma-separated list of specific sections: `components`, `directives`, `entities`, `classes`, `injectables`, `dependency-injection`, `guards`, `interfaces`, `interceptors`, `pipes`, `resolvers`, `utilities`, `additionalPages`, and `features` (the Features chapter under `menuLayout: 'feature'`; References is a single top-level link with no collapsible tree, so it is not a valid key). `miscellaneous` and `tokens` are ignored with a warning |
| navTabConfig | `--navTabConfig` | object[] | `[]` | Customize the order and labels of entity page tabs. Array of `{ id, label }` objects. Available tab IDs: `info` (overview/metadata), `readme` (component README), `source` (source code), `templateData` (component template), `styleData` (component styles), `tree` (DOM tree), `example` (live examples). Tabs not listed are hidden. If empty (default), all applicable tabs are shown in their default order |

## Coverage

Compodocx tracks documentation coverage -- the percentage of public members that have JSDoc descriptions. These options configure thresholds and reporting.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| coverageTest | `--coverageTest` | number | `70` | Global documentation coverage threshold as a percentage. Used in CI to enforce minimum documentation |
| coverageMinimumPerFile | `--coverageMinimumPerFile` | number | `0` | Per-file minimum coverage percentage. Each file must meet this threshold individually |
| coverageTestThresholdFail | `--coverageTestThresholdFail` | boolean | `true` | When `true`, a coverage threshold breach exits with a non-zero code (fails CI). When `false`, only a warning is printed |
| coverageTestShowOnlyFailed | `--coverageTestShowOnlyFailed` | boolean | `false` | In coverage output, show only files that fall below the threshold |
| unitTestCoverage | `--unitTestCoverage` | string | -- | Path to an Istanbul JSON coverage summary file (`coverage-summary.json`). When provided, unit test coverage data is integrated into the documentation coverage report, showing both documentation and test coverage side by side |

## Additional Content

Include external documentation, static assets, or supply custom templates.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| includes | `--includes` | string | -- | Path to a folder of external markdown files. Each `.md` file becomes a page in the documentation, accessible via a dedicated sidebar section. Supports nested folders for sub-navigation |
| includesName | `--includesName` | string | `'Additional documentation'` | Sidebar label for the external markdown pages section |
| assetsFolder | `-a, --assetsFolder` | string | -- | Path to a folder of static assets (images, files) copied into the output directory. Referenced from markdown or custom templates via relative paths |
| templates | `--templates` | string | -- | Path to a directory containing JS template overrides. Each file exports a function `(data, helpers) => string` that replaces the corresponding built-in template. See [Custom Templates](custom-templates.md) for the full API |

## Sidebar Grouping

Controls how entities are organized in the sidebar. By default, compodocx auto-detects the best strategy based on the project structure.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| groupBy | `--groupBy` | string | `'folder'` | Sidebar grouping strategy. `folder` groups entities by their directory path (e.g. `users/components`). `category` groups by the `@category` JSDoc tag. `none` shows a flat alphabetical list. Defaults to `folder` when omitted |
| groupDepth | `--groupDepth` | string | `'2'` | Maximum folder depth for group names when using `folder` grouping. A depth of `2` turns `src/app/users/components/user-card.component.ts` into the group `users/components`. Increase for deeply nested projects |
| menuLayout | _config-only_ | `'type' \ | 'feature'` | `'type'` | Whole-sidebar layout. `'type'` keeps the default per-kind chapters (Components / Directives / Injectables / ...). `'feature'` replaces them with a curated **Features** chapter plus a single top-level link to the **`references.html`** API portal. **Features** lists the consumer-organism kinds (components, directives, pipes, injectables, tokens, classes, guards, interceptors, entities) bucketed by folder / `@category`, plus any reference-kind symbol opted in via `@docsKind primary`. The **Reference** link opens a single-page exhaustive catalogue of every public symbol regardless of kind, filterable by kind / stability / bucket / free-text (URL state persisted). `@category` overrides folder keys. Modules / Routes / Additional Pages stay top-level in both modes; The Utilities and Dependency Injection chapters are not shown under `'feature'`: every such symbol surfaces on the portal, whose header links the `utilities.html` and `dependency-injection.html` landing pages, and a bucket lists a feature type page once instead of each of its providers and feature functions. Folder depth is controlled by `groupDepth` (use `>= 2` in multi-project workspaces). `toggleMenuItems` accepts the single new key `features`; the Reference link is a flat anchor with no collapsible tree to toggle. Under `'feature'`, every bucket also gets an auto-generated landing page at `categories/<bucket-id>.html` (v0.6.0+) - leaf and intermediate folders alike - linked from the sidebar bucket label; the chevron toggles expand on the Features chapter only |
| featureLibraryScope | _config-only_ | `'primary' \| 'auto' \| 'all'` | `'auto'` | Under `menuLayout: 'feature'`, controls which folder / `@category` buckets get a node in the **Features** chapter and what each node lists. `'primary'` = only buckets that ship a class-like kind (component / directive / pipe / injectable / token / class / guard / interceptor / entity) or a `@docsKind primary`-promoted symbol, listing just those items (the pre-v0.7.3 behaviour). `'auto'` (default) = a bucket with no class-like symbol falls back to listing its full reference surface (functions / interfaces / type aliases / variables / enumerations), so a modern-Angular library that ships only `provideX` / `withX` helpers, functional composables, or adapter types becomes a first-class library node - while buckets that DO ship a class-like kind stay curated (their reference symbols remain on the `references.html` portal only). `'all'` = every bucket lists its complete surface under Features. The exhaustive `references.html` portal is unaffected in every mode. No effect under `menuLayout: 'type'` |
| featuresName | _config-only_ | string | `''` (i18n default) | Override the **Features** chapter heading under `menuLayout: 'feature'`. Empty falls back to the translated `features` i18n key. Use this to keep non-English builds aligned without adding locale entries |
| referencesName | _config-only_ | string | `''` (i18n default) | Exposed on `data.referencesName` for `menu.js` / `api-reference.js` custom-template overrides that want a non-i18n label. The built-in sidebar link reads the localised `reference` key and the portal heading reads `api-reference`; neither consumes `referencesName` directly today |
| collapsedAll | _config-only_ | boolean | `false` | Force every sidebar chapter AND every nested folder group to start collapsed on first load. Overrides `toggleMenuItems` (which only controls top-level chapters) and the `groupDepth`-driven nested-group expansion. Useful for large codebases where the default produces a wall of expanded links. Works under both `menuLayout` modes |

## Analytics

Integrate Google Analytics 4 (gtag.js) tracking into the generated documentation. Both SPA-style navigation and full page loads are tracked.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| gaID | `--gaID` | string | -- | Google Analytics 4 measurement ID (e.g. `G-XXXXXXXXXX`). When set, the gtag.js script is injected into every page |

## Playground (`@playground`)

The modern path for runnable component demos. Add `@playground <title>` JSDoc blocks to a component class and compodocx assembles a fresh, complete StackBlitz Angular project per block at build time. The SDK is lazy-loaded on first click; static doc pages stay light.

Three authoring modes, dispatched by the trailing token on the tag line:

| Mode | Tag form | Source of truth |
|-|-|-|
| Inline | `@playground <title>` + fenced HTML/TS code block | the JSDoc comment |
| HTML file | `@playground <title> ./path/to/file.html` | external `.html` file |
| TS component | `@playground <title> ./path/to/file.component.ts` | a real `@Component` class with optional `templateUrl`/`styleUrl`/`styleUrls` and any number of relative imports |

All three modes share the same scaffold (Angular CLI 21 standalone project, WebContainer template). Material widgets are auto-detected: when the demo references known Material selectors or attribute directives, `@angular/material` and `@angular/cdk` are force-pinned and the prebuilt theme is wired up automatically. Bare-specifier imports in any walked source are auto-forwarded with the version your `package.json` declares.

In TS-component mode, `templateUrl` / `styleUrl` / `styleUrls` are resolved from a **string or a plain template literal** (`templateUrl: \`./x.component.html\``). A value the resolver can't statically resolve — an interpolated literal (`` `./x.${variant}.html` ``) or a computed identifier (`styleUrls: STYLES`) — **fails that playground with a clear error** naming the decorator, rather than silently shipping it without its template/styles. Use a literal path, or inline the `template` / `styles` in the demo component.

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
| playgroundDependencies | -- (config-only) | object | `{}` | Extra packages to inject into every StackBlitz manifest's `dependencies`, with the version specifier YOU choose. Wins over the consumer-`package.json` auto-forward AND any auto-detected version (e.g. Material). Use for libraries the consumer ships but doesn't `npm install` directly (peer-only CSS themes), or to pin a per-build version. The value is forwarded into the generated `package.json` **unchanged** — see [Non-registry dependency sources](#non-registry-dependency-sources) for the accepted forms. |
| playgroundMaterialShell | -- (config-only) | boolean | `false` | Force the Material app shell (Roboto + Material-Icons font links and the `mat-typography mat-app-background` body classes) into every `@playground` `index.html`, independent of Material auto-detect. For libraries themed to look like Material via a Sass theme bridge. Does **not** add `@angular/material`/`@angular/cdk` or Material module imports. See [Material app shell](#material-app-shell-fonts--body-classes). |
| playgroundDepDepth | -- (config-only) | number | `3` | Max import depth followed when walking a `@playground`'s dependency graph. Raise for deeply-nested examples. Range 1–100. |
| playgroundFileCountCap | -- (config-only) | number | `25` | Hard ceiling on the number of source files in one `@playground` manifest. Exceeding it fails **that** playground with a message naming the component and the walked files (other playgrounds still build). Raise for large multi-file examples. Range 1–1000. |
| playgroundFileCap | -- (config-only) | number | `8000` | Per-file character cap before a bundled `@playground` source is truncated with a footer. Raise when a legitimately large source is being cut off. Range 500–1,000,000. |
| playgroundHead | -- (config-only) | string[] | `[]` | Arbitrary `<head>` entries injected into every `@playground` `index.html` (after the Material shell links, when present). For custom fonts, meta tags, CSP, or preloads. Each entry is emitted verbatim; blank entries are dropped. See [Custom `<head>` and global styles](#custom-head-and-global-styles). |
| playgroundGlobalStyles | -- (config-only) | string | `''` | Global styles appended to every `@playground` global stylesheet, after the default body reset. For fonts, resets, or any global rules the examples depend on. Leading statement at-rules (`@import` / `@charset` / `@layer name;` / `@use` / `@forward`) are hoisted above the reset so they stay valid. If the value carries a Sass prelude (`@use` / `@forward`) the sheet is emitted as `src/styles.scss` (and wired into `angular.json`) so the Angular builder compiles it with Sass — e.g. applying a global Material theme bridge; otherwise it is `src/styles.css`. |
| playgroundVendor | -- (config-only) | string[] | `[]` | Package names and/or globs (`"@cngx/*"`) to vendor into `@playground` projects from the locally built `dist/` instead of the npm registry. When a playground imports a matching package, a slimmed, entry-point-pruned slice of its built directory (plus the transitive closure of other matching packages) is embedded in the manifest and wired as a `file:` dependency — so the playground runs against the working tree, not the last published release. See [Vendoring the local build](#vendoring-the-local-build-playgroundvendor). |
| playgroundVendorRoot | -- (config-only) | string | `dist` | Base directory the `playgroundVendor` closure is read from. Each matched package is located by its `package.json` `name`, anywhere under this root — the directory name need not match the package name. |
| playgroundVendorCap | -- (config-only) | number | `1500000` | Backstop byte cap on a single playground's slimmed-and-pruned vendored closure. Defaults to ~1.5 MB, set under StackBlitz's ~2 MB project-POST limit so an oversized closure fails the build instead of producing a manifest that 413s on launch. Range 50 000–2 000 000. Raising it past the StackBlitz limit re-opens the 413 it prevents. |
| playgroundVendorIncludeSourcemaps | -- (config-only) | boolean | `false` | Keep `*.map` sourcemaps in vendored packages. Off by default — sourcemaps are a large slice of FESM byte size and the WebContainer build never reads them. |

```jsonc
// compodocx.config.json
{
    "tsconfig": "projects/ui-kit/tsconfig.lib.json",
    "output": "docs/",
    "publicApiOnly": true,
    "playgroundDependencies": {
        "@my-org/ui-kit": "^1.0.0",
        "@my-org/themes": "next"
    }
}
```

#### Custom `<head>` and global styles

The Material shell covers the common case (Roboto + Material-Icons). For anything else a playground needs in the page shell, `playgroundHead` and `playgroundGlobalStyles` let you contribute to the generated `index.html` `<head>` and `src/styles.css` directly — these extend the **same** shell writer the Material option uses, so they compose with it rather than replacing the scaffold.

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

This replaces the older, undocumented trick of adding `export { appConfig } from './app.config'` to the example component purely so the file got bundled — that still works for back-compat, but `@playgroundConfig` is the supported, explicit way.

#### Non-registry dependency sources

`playgroundDependencies` values (and any version specifier the consumer's own `package.json` declares for an auto-forwarded library) are written into the generated playground `package.json` verbatim — compodocx never rewrites them to a semver range against `latest`. So any specifier npm itself understands works, letting a playground pin an unpublished build instead of waiting for a registry release:

| Form | Example |
|-|-|
| Exact version / prerelease | `"0.1.0-rc.2"` |
| dist-tag | `"next"` |
| Tarball URL | `"https://example.com/pkg/ui-1.2.3.tgz"` |
| Git ref | `"git+https://github.com/my-org/ui.git#feature/tabs"` |

StackBlitz's WebContainer runs a real `npm install`, so it resolves each of these the same way a local install would. When the package you want to pin lives in your **own** workspace and is built but not yet published, vendoring (below) skips the registry entirely.

#### Vendoring the local build (`playgroundVendor`)

A registry dependency always resolves to the last **published** version, so a playground that imports a symbol which only exists in your working tree fails to compile in the sandbox, and an unreleased bugfix shows stale. `playgroundVendor` fixes this by embedding the locally built `dist/` into the payload — the same mechanism compodocx already uses to inline your example sources, one level deeper.

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
- **Slimmed, not verbatim.** Each package ships only what the WebContainer build reads: `fesm2022/*.mjs`, typings (`*.d.ts`), and every `package.json` (root + secondary entry points, with the `exports` map intact). Sourcemaps (`*.map`) and legacy/duplicate bundle directories (`esm2022/`, `fesm2020/`, …) are dropped — together usually the majority of dist bytes. Set `playgroundVendorIncludeSourcemaps: true` to keep the maps.
- **Pruned to the imported entry points.** Vendoring all of `@cngx/common` when the playground imports only `@cngx/common/tabs` is the main payload lever, so for each closure package only the entry points actually reached ship: the ones imported (from TS or SCSS), plus any sibling/cross-package entry point a kept FESM chunk or its typings references, followed transitively. Unreached entry points are dropped. Pruning is conservative — a package whose entry-point structure can't be read with confidence (no `exports` map), or for which an imported subpath maps to no known entry point, is shipped whole rather than risk a broken build.
- **Wired as `file:` deps.** Each vendored package is placed under `vendor/<pkg>/` and declared as `"<pkg>": "file:vendor/<pkg>"` in the generated `package.json`. A root `file:` entry is authoritative: it overrides any registry version and any transitive semver range, so no closure package is pulled from npm.

**Prerequisite:** the libraries must be **built before** compodocx runs (`dist/` present). A typical `docs:full` script already builds the libs first. If `playgroundVendor` names a package whose build output is missing, the docs build **fails** with a clear message (`playgroundVendor: "@cngx/ui" not found under dist — run the library build`) rather than silently falling back to a stale registry version. A glob that matches nothing only warns.

**Size — the StackBlitz POST limit is the real constraint.** `@stackblitz/sdk`'s `openProject` submits the whole project as a single form POST; StackBlitz's edge rejects bodies past roughly **2 MB** with `413 Request Entity Too Large`. The slimming and entry-point pruning above exist to keep the vendored payload comfortably under that. `playgroundVendorCap` (default ~1.5 MB, under the POST limit to leave room for the scaffold files and form-encoding overhead) is a **backstop**: a closure that still exceeds it fails the build naming the packages and measured bytes — and, when the payload is also over the StackBlitz limit, says so explicitly — never a silent truncation or a manifest that 413s on click.

#### Pre-publish breakage guard (`--strictPlaygrounds`)

For playgrounds whose imports are served from the **registry** (i.e. not vendored), compodocx checks each bare import against the version of the package actually installed in your `node_modules` — the version StackBlitz would resolve. When the example imports an entry point or a named symbol that the pinned version does not have (`import { CngxTabNav } from '@cngx/ui/tabs'` while the published `@cngx/ui` predates `tabs`), the playground compiles locally but fails in the sandbox. The guard surfaces that at docs-build time:

- **Default:** a per-playground **warning** naming the specifier/symbol and the pinned version.
- **`--strictPlaygrounds`:** the same finding **fails** the build.

Two checks run, both biased toward **no false positives**: a *subpath* check against the pinned package's `exports` map, and a *symbol* check that scans the entry-point `.d.ts`. Anything the static check can't determine — a legacy package without an `exports` map, or typings that re-export via wildcard (`export * from …`) — is left unreported. Vendored packages (`playgroundVendor`) and framework peers (`@angular/*`, `rxjs`, …) are exempt: the former ship the local build, the latter are pinned by the manifest itself.

The static guard is fast but conservative. For full certainty that every playground actually compiles, use the `playground:validate` command below, which performs a real build.

#### `compodocx playground:validate <docsDir>`

A standalone command that **compiles every `@playground`** in a generated documentation folder and reports a per-playground pass/fail summary — the strongest guard, catching breakage the static `--strictPlaygrounds` check can't. It reads the manifests back out of the produced HTML, materializes each StackBlitz project to a temp directory, and runs `npm install` + `npm run build` (`ng build`) against the resolved (and vendored) dependencies.

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

Exit codes: `0` all passed (or none found), `1` at least one failed, `2` fatal (bad args / unreadable docs dir). The command is opt-in and **decoupled from the docs build** — it never slows normal generation. Because it runs a real `npm install` per project, it needs network access and is much slower than the build itself; run it as a CI step after the docs are produced rather than on every local build.

For the complete authoring guide (folder layout, library-author workflow, troubleshooting), see [the Playground guide on compodocx.dev](https://compodocx.dev/guides/playground/).

## Legacy `@stackblitz <url>` integration

Predates `@playground`. The `@stackblitz <url>` JSDoc tag adds a single "Open in StackBlitz" link in the entity hero, pointing at a pre-existing StackBlitz project the author maintains externally. No build-time assembly, no manifest. Use `@playground` for new projects — `@stackblitz` is kept for migration compatibility.

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| stackblitz | `--stackblitz` | boolean | `false` | Enable legacy StackBlitz integration. Adds "Open in StackBlitz" buttons to `@example` code blocks (when paired with `stackblitzTemplate`) |
| stackblitzTemplate | `--stackblitzTemplate` | string | -- | StackBlitz project template ID. Example code is injected into this template when the user clicks "Open in StackBlitz" |

## Search

Compodocx uses [Pagefind](https://pagefind.app/) for client-side search. The search index is generated at build time by scanning the output HTML. Users access it via the command palette (Ctrl+K / Cmd+K).

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| maxSearchResults | `--maxSearchResults` | number | `15` | Maximum number of results shown in the search command palette. Set to `0` to show all results (may be slow for large projects) |

## Logging

| Option | CLI | Type | Default | Description |
|-|-|-|-|-|
| silent | `-t, --silent` | boolean | `false` | Suppress all console output during generation. Useful in CI pipelines where only the exit code matters |

---

## Entity Page Structure

Each documented entity (component, directive, service, class, etc.) gets a detail page with two main tabs:

**Info tab** -- Overview information: import statement, deprecation banner, description, JSDoc examples, decorator metadata, host bindings, providers, dependencies (inject/constructor DI), and relationship graph.

**API tab** -- Member surface: index grid, inputs, outputs, derived state (computed/linkedSignal), properties, methods, accessors, index signatures, host bindings, host listeners.

Additional tabs (Source, Template, Style, DOM Tree, README, Example) appear based on the entity type and available data. Tab visibility and order can be controlled via `navTabConfig`.

The Info, API and Theming tabs accept config-file-only string arrays that opt regions in or out:

| Option | Type | Default | Description |
|-|-|-|-|
| infoTabSections | string[] | `[]` | Override the section list for the Info tab. Empty means all defaults render. Available IDs: `import`, `deprecated`, `description`, `examples`, `metadata`, `extends`, `host`, `dependencies`, `providers`, `viewProviders`, `relationships` |
| apiTabSections | string[] | `[]` | Override the section list for the API tab. Empty means all defaults render. Available IDs: `index`, `inputs`, `outputs`, `derivedState`, `effects`, `properties`, `methods`, `accessors`, `indexSignatures`, `hostBindings`, `hostListeners` |
| themingTabSections | string[] | `[]` | Override the section list for the Theming tab. Empty means all defaults render. Available IDs: `overview`, `index`, `tokens`, `source` |

These are config-file only (no CLI flag). An explicit non-empty list replaces the default in full -- list every region you want, in the order you want them.

## Theming Tab

Components grow a **Theming** tab when the parser finds documented theme tokens inside their `styleUrls` or inline `styles[]`. Tokens are described with a small inline-doc convention -- no separate manifest, no companion files. The same convention works for SCSS variables, CSS custom properties, and `@property` at-rules.

> Authoring a stylesheet from scratch or retrofitting an existing one? See `docs/theming-tokens-authoring-guide.md` for copy-paste recipes, anti-patterns, and a verification loop.

### SCSS variables -- SassDoc `///` blocks

```scss
/// Padding inside the alert container.
/// @type Length
/// @default 12px 16px
/// @group container
$alert-padding: 12px 16px !default;
```

The `///` block must sit immediately above the `$variable: value [!default];` declaration. Any non-comment line in between cancels the association.

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

Unknown tags are preserved verbatim in the description -- the parser does not error on conventions you add yourself.

### Source resolution

For each component, compodocx reads the `@Component` decorator's `styleUrls` relative to the component file and parses each entry. Inline `styles[]` strings are parsed identically. SCSS files have their top-level `@import` and `@use` rules followed **one level deep**, so you can keep tokens in a partial like `_tokens.scss` and re-export from the component stylesheet. Deeper transitive resolution is intentionally out of scope.

Components without documented tokens get no Theming tab. Other entity kinds (services, directives, classes, ...) never carry styling output and never produce a Theming tab.

## JSDoc Tags

Compodocx recognizes these custom JSDoc tags on any entity or member:

| Tag | Effect |
|-|-|
| `@since <version>` | Adds a version badge to the entity hero |
| `@beta` | Adds a "Beta" badge |
| `@breaking <version>` | Adds a "Breaking" badge with version |
| `@internal` | Hides the member when `--disableInternal` is set |
| `@category <name>` | Groups the entity under this category when `--groupBy category`. Also overrides the folder-derived key under `menuLayout: 'feature'` |
| `@docsKind primary` | Under `menuLayout: 'feature'`, promotes a reference-kind symbol (function, interface, typealias, variable, enumeration) into the **Features** chapter. Use for bootstrap providers, feature-config helpers, state factories, and other consumer entry points that should live alongside the components they configure. Tag values other than `primary` (typos, the inverse direction) are silently ignored; the inverse override is intentionally unsupported. No effect under `menuLayout: 'type'` |
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
