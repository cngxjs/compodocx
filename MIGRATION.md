# Migrating from compodoc to compodocx

compodocx is the successor to compodoc for modern Angular, not a drop-in replacement. It documents Angular 21+ standalone code: standalone components, directives and pipes, `inject()`, signal inputs, outputs and models, the `host` metadata object, and functional guards, interceptors and resolvers.

What it does not document:

- NgModules (no Modules chapter, no module pages, no module graphs).
- Decorator members: `@Input`, `@Output`, `@HostBinding` and `@HostListener`.
- Constructor injection in components, directives, pipes and injectables.
- Class-based guards, interceptors and resolvers.

A run that finds such code reports it in one legacy notice (count and locations) and documents the rest. Page URLs and the JSON export schema differ from compodoc and from earlier compodocx releases, so bookmarks, deploy scripts and tools that read `documentation.json` need a look.

Switching is: change the package and the script, run it, then act on the warnings it prints. The rest of this document explains each warning and each change.

## Switching

```bash
npm uninstall @compodoc/compodoc
npm install --save-dev @cngxjs/compodocx
```

```diff
- "docs": "compodoc -p tsconfig.app.json -d docs"
+ "docs": "compodocx -p tsconfig.app.json -d docs"
```

As conveniences, the package also installs a `compodoc` binary, and a `.compodocrc*` file or a `compodoc` key in `package.json` is still found (the `compodocx` names win when both exist).

Then run the script once and read the log. What it can print:

| Warning | What to do |
|-|-|
| `Angular 21+ only: <n> legacy constructs are not documented` | Migrate the listed code to standalone APIs, or accept that it stays undocumented. See "Angular 21+ standalone code only" below |
| `<flag> is ignored: ...` / `<key> is ignored: ...` | Remove the flag or config key. See "CLI flag compatibility" and "Config file" below |
| `'<name>' theme has been removed; using '<replacement>'` | Pick one of the bundled themes. See "Themes" below |
| `Found <n> .hbs file(s) in ...` | Rewrite the Handlebars partials as JavaScript overrides. See "Custom templates: HBS → JS" below |
| `Custom template <file> is ignored (...)` | Rename or remove the override file. See "Override names" below |
| `<n> @category / @docsKind tags are ignored; ...` | Run `compodocx migrate jsdoc <dir>`. See "Features replace category buckets" below |
| `toggleMenuItems: "<value>" has no effect` | Remove `modules`, `miscellaneous` or `tokens`; use `utilities` and `dependency-injection` |

The exit code stays `0` for all of them.

The HTML now goes to `<output>/<version>/` with a `versions.json` next to it (see "Multi-version output is the default" below); pass `--no-multiVersion` to keep a flat folder.

## Migrating with `ng add`

Inside an Angular CLI workspace, `ng add @cngxjs/compodocx` does the `package.json` edit and seeds `tsconfig.doc.json` in one pass:

```bash
ng add @cngxjs/compodocx
```

What the schematic does on a project that previously used `@compodoc/compodoc`:

- Removes `@compodoc/compodoc` from `dependencies` and `devDependencies`.
- Renames any `compodoc:<suffix>` script to `compodocx:<suffix>`. If a `compodocx:<suffix>` already exists with a different value, the source script is renamed to `compodoc:<suffix>-legacy` instead - never overwritten.
- Rewrites the `compodoc` binary in any script value to `compodocx` (at the start of the script, after `&&`, `;`, `|` or `npx`, also as a path such as `node_modules/.bin/compodoc`).
- Adds the three default scripts: `compodocx:build`, `compodocx:build-and-serve`, `compodocx:serve`.
- Creates `tsconfig.doc.json` if it does not already exist.

Useful flags:

- `--skip-migration` - leave the legacy dependency and `compodoc:*` scripts in place.
- `--project <name>` - required when `angular.json` declares more than one project.
- `--script-prefix compodoc` - produce `compodoc:*` script names instead of the default. The scripts still call `compodocx`.

Re-running `ng add @cngxjs/compodocx` is idempotent (zero diff on the second pass). CI workflow files that invoke `compodoc -p ...` directly are not rewritten - update those manually, or rely on the `compodoc` bin alias the new package still ships. The schematic does not touch your sources, templates or config file: the warnings of the first run still apply.

## Changes in 0.12.0

No flag or config key was removed, and the JSON export schema stays 6. What to check when you upgrade from 0.11.0:

- **File-local declarations are no longer documented.** A function, variable, interface, type alias, enum or injection token that its file does not export has no page, no sidebar entry, no coverage row and no entry in `documentation.json` or `llm-context.md` any more. Links to such pages and tools that looked those entries up need a look; export the declaration if it belongs to the documented API. Coverage percentages change, because these declarations no longer count, so revisit `--coverageTest` and `--coverageMinimumPerFile` thresholds.
- **Example tabs and `exampleUrls` follow the class.** An `<example-url>` tag counts for the class whose JSDoc holds it. Before, every class of a file got every tag of that file; a class that relied on a tag in a neighbour's comment needs its own tag now.
- **`signal` on components and directives in `documentation.json` is deprecated.** It is still written and goes with schema 7; read `signalKind` on the members instead. Until then it is `true` when the entry has an `input()`, `output()` or `model()` member (it was `false` unless the class carried the undocumented `@signal` tag, which is deprecated too). The deprecated fields are listed in [`docs/json-export.md`](https://github.com/cngxjs/compodocx/blob/develop/docs/json-export.md#deprecated-fields).

## Changes in 0.11.0

No flag, config key or URL was removed, and the JSON export schema stays 6. What to check when you upgrade from 0.10:

- **Custom `overview` templates.** The graph data is `data.graph` (`{ model: { nodes, edges, features }, shown, version }`) instead of `data.dependencyGraph`, and the overview no longer inlines it: the page loads `js/graph.js` when the graph scrolls into view.
- **Scripts that read `window.DEPENDENCY_GRAPH`.** The global is gone; `js/graph.js` sets `window.__CDX_GRAPH__` with the laid-out project graph.
- **Custom CSS for the graphs.** Edges are drawn as `cdx-graph-edge--<relation>` paths with a short head at the target; the `dep-link` class and the `dep-arrow` marker are gone. Themes can colour the node kinds with the new `--color-cdx-graph-kind-<kind>` tokens (set them in `:root` and `.dark`).
- **Hosting.** Publish `js/graph.js` along with the pages (it is not written with `--disableGraph`).
- **A custom logo.** It is no longer fixed at 24px high: a wide logo fills the sidebar header up to `--cdx-sidebar-logo-max-height` (default `40px`), a square one sits next to the project name at `--cdx-sidebar-logo-icon-size` (default `28px`). Set `--cdx-sidebar-logo-max-height: 24px` in a custom theme for the old height of a wordmark, or `logoLayout: 'wordmark'` to keep a square logo without the name.

## Changes in 0.10.0

No flag, config key or URL was removed. What to check when you upgrade from 0.9:

- **Custom templates that call `helpers.extractJsdocCodeExamples`.** The helper is now `helpers.exampleComments(tags)` and returns the rendered HTML of each `@example` body (Shiki code blocks) instead of `<pre class="cdx-code-example">` wrappers. The `cdx-code-example` styles are gone.
- **Custom CSS for the sidebar.** The sidebar is drawn as a tree with new markup: nested additional pages are real nested lists, and the `for-chapter2` to `for-chapter5` classes are gone. Custom `menu` templates are not affected. Themes can set the new tokens `--color-cdx-accent`, `--color-cdx-accent-subtle` and `--color-cdx-focus-ring`.
- **Tools that read `documentation.json`.** The schema stays 6. `jsdoctags[].comment` of an `@example` without a code fence is now a code block (`<div class="cdx-code-snippet">...</div>`) instead of a paragraph, and `destrucuredGroupId` is the position of the parameter (`<file>:<line>:<column>`) instead of a random UUID, so the export is the same on every run. The optional top-level `additionalPages` list is new.
- **`summary.json` of additional pages.** Two pages with the same path, an invalid `slug` and an invalid alias now stop the build with the position in `summary.json`; give one of two clashing pages a `slug`. A sidebar group that gets a `slug` forgets its remembered open/closed state once.

## Breaking change in 0.9.0: page URLs grouped by entry point and feature

Pages no longer sit in one folder per kind. Each symbol page lives in the folder of its feature: the entry point's import path without a scope all entry points share, then the feature key. Apps use the feature folders below `src/app`.

| Before | Now |
|-|-|
| `components/SelectPanel.html` (any kind folder: `directives/`, `injectables/`, `classes/`, `interfaces/`, `functions/`, `variables/`, `typealiases/`, `enumerations/`, `tokens/`, `guards/`, `interceptors/`, `resolvers/`, `entities/`, `pipes/`) | `forms/select/SelectPanel.html` (library entry point `@acme/forms/select`), `admin/UserListComponent.html` (app feature `admin`) |
| `providers/<FeatureType>.html`, `providers/<name>.html` | the feature type's or the provider's page in its feature folder |
| `features/forms/select.html` | `forms/select/index.html` |
| `Todo-1.html`, `Todo-2.html` (same-name copies) | `Todo-2.html`, `Todo-3.html` in the same folder (the first copy by source path keeps `Todo.html`); a same-name symbol of another kind is `<name>-<kind>.html` |
| `functions/Unnamed function.html` | `Unnamed-function.html` (characters outside `A-Z a-z 0-9 . _ -` become `-`) |

Root pages (`index.html`, `overview.html`, `utilities.html`, `dependency-injection.html`, `references.html`, `coverage.html`, ...) and `additional-documentation/` keep their paths. A feature folder never takes the name of a root folder (`js`, `styles`, `images`, `assets`, `pagefind`, `additional-documentation`); such a feature gets `-2`. Without project analysis facts (a tsconfig the analysis cannot read) pages keep their kind folders.

Old URLs: every version's output holds `redirects.json`:

```json
{ "schemaVersion": 1, "redirects": { "components/SelectPanel.html": "forms/select/SelectPanel.html" } }
```

It covers the kind folders (with their old `-1`, `-2` names), `providers/`, `miscellaneous/` pages and collection anchors, `features/` and `categories/` pages. No stub pages are written; a web server can use the map for HTTP redirects. The version switcher follows the target version's map, and for a version built before the map existed it reads the current version's map backwards. `versions.json` is unchanged (schema 1). Links in README and additional-page markdown that still point at an old page are rewritten to its new place.

Custom templates: pages are no longer all one folder deep. Build links with `data.depth` (`helpers.relativeUrl(data.depth)`), and pass it to the type-link helpers: `helpers.linkTypeHtml(type, { depth: data.depth })`, `helpers.functionSignature(method, data.depth)`.

## Breaking change in 0.9.0: features replace category buckets

compodocx groups symbols by feature: an entry point (the import path), then a feature key below it, derived from the code. The sidebar, the breadcrumbs, `references.html` and search use it. `@category` and `@docsKind` are no longer read.

The feature layout is the default. To keep one chapter per kind:

```json
{ "menuLayout": "type" }
```

Tags:

- Run `compodocx migrate jsdoc <dir>` to remove `@category` and `@docsKind` from your sources (`--dry-run` lists them first). Until then every build logs one warning with their locations.
- To put a symbol into a different feature, use `@feature <key>` on the symbol or a `features` entry in the config file (`{ "features": { "projects/forms/select/src/**": "select" } }`). The key is relative to the symbol's entry point; it cannot move a symbol into another entry point.
- Topic groupings that `@category` expressed inside one feature have no grouping replacement. To keep such a classification visible, declare a classification axis (`classificationAxes`) and tag the symbols with `@axis <name> <value>`: it shows as a badge and a search filter, never as a sidebar group or a separate page. `compodocx migrate jsdoc` does not convert `@category` tags.

Configuration:

| Removed | Now |
|-|-|
| `groupBy`, `--groupBy` | Ignored with a warning; both layouts group by feature |
| `groupDepth`, `--groupDepth` | Ignored with a warning |
| `featureLibraryScope` | Ignored with a warning; a feature lists its primary members, or its whole surface when it has none |
| `menuLayout` default `'type'` | Default `'feature'` |

New: `features`, `featureContainers` (app folders whose sub-folders are features, default `features`, `pages`, `domains`), `featureUtilityFolders` (folders that belong to the entry point's root feature) and `featureRoleFolders` (folders such as `di/`, `routes/` or `components/` whose files join the feature their file name starts with). See "Features" in docs/configuration.md for the detection rules.

Pages: `categories/<bucket>.html` is gone. Every feature has a page, `index.html` in the feature's folder (see "page URLs grouped by entry point and feature" above); `redirects.json` maps the old `categories/` pages whose path matches a feature.

Template overrides: `bucket-landing` is removed (a file with that name is ignored with a warning). The new `feature` context targets feature pages (`data.feature`, see docs/custom-templates.md). `menu` and `api-reference` overrides read the feature model from `data.semantic.features`; `data.categorizedByFeature*` and the `data.categorized*` kind groups are gone. Entity heroes write `data-pagefind-meta="feature:<label>"` instead of `category:<bucket>`, and the command palette shows only the `feature` value next to a result; a custom template that still writes `category:` loses that label.

JSON export: `category` and `docsKind` are gone, symbol entries can carry `feature`; see "JSON export schema 6" below.

Search: the `bucket` and `tier` facets are replaced by `feature` and `entryPoint`.

## Breaking change in 0.9.0: dependency injection and utilities pages

The Miscellaneous chapter and the `miscellaneous/` output folder are gone. Functions, constants, type aliases and enumerations each get a page of their own, providers and feature functions move to a Dependency Injection chapter.

Where the pages went (every page lives in its feature folder, see "page URLs grouped by entry point and feature" above; `redirects.json` maps each old URL, and the version switcher follows it):

| Before | Now |
|-|-|
| `miscellaneous/functions.html#name`, `miscellaneous/functions/<name>.html` (and the same for variables, type aliases, enumerations) | the symbol's own page |
| page of a provider or feature function with a feature type | section `#<FeatureType>--<name>` on the page of the feature type |
| page of a provider without a feature type | its own page |
| `interfaces/<FeatureType>.html`, `typealiases/<FeatureType>.html` | the page of the feature type (its first section is the type definition) with its providers and feature functions |
| a `ResolveFn` constant, a guard or interceptor declared as a function | its own page, listed under Resolvers, Guards or Interceptors |

Landing pages: `utilities.html` and `dependency-injection.html`. Under `menuLayout: 'feature'` both are linked from the header of `references.html`, and a section there lists a feature type page once instead of each of its members.

Symbols that reach no entry point (`notExported` in the JSON export) get no page, no menu entry and no row in the documentation coverage report, so coverage is measured over the documented surface. Once the project has entry points this works like `--publicApiOnly` by default; the flag stays and still applies its own filter. The build log lists those symbols with file and line.

Anchors of members whose name starts with `#` (ES private fields) lose the `#`: `#clicked` is now `id="clicked"`. Other member anchors are unchanged.

Configuration:

- `toggleMenuItems` accepts `utilities` and `dependency-injection`. `miscellaneous` and `tokens` are accepted, have no effect and log a warning.
- The name-based Provider / Feature badges (`provideX`, `withX`, `injectX`, `createX`) are gone. Badges now come from the analysis: Provider, Feature and Injection context.

Template overrides:

| Removed | Use instead |
|-|-|
| `miscellaneous-functions`, `miscellaneous-variables`, `miscellaneous-typealiases`, `miscellaneous-enumerations` | `utilities` |
| `miscellaneous-function`, `miscellaneous-variable`, `miscellaneous-typealias`, `miscellaneous-enumeration` | `function`, `variable`, `typealias`, `enumeration` |

New page contexts: `utilities`, `dependency-injection`, `di-cluster` (the page of a feature type) and `resolver`. The `referenced-by` block now renders the "Used by" list; its props are unchanged.

JSON export: `referencedBy` is gone (use `usedBy`); see "JSON export schema 6" below. The llm-md export gains a "Public tokens" section and leaves out symbols that reach no entry point.

## Breaking change in 0.9.0: programmatic entry point

The package no longer exports the `Application` and `CliApplication` classes. The programmatic entry point is now `runCompodocx`:

```ts
import { runCompodocx } from '@cngxjs/compodocx';

const outcome = await runCompodocx({
    files: ['src/app/app.component.ts'],
    options: { tsconfig: 'tsconfig.json', output: 'docs/' }
});
// outcome.kind: 'generated' | 'serving' | 'halted'
```

- The command line interface is the supported entry point. `runCompodocx` is experimental and may change before 1.0.0.
- The caller passes the list of source files; file scanning, tsconfig resolution, version labels and `publicApiOnly` handling stay in the CLI.
- `runCompodocx` never exits the process. A stopped run (for example a failed coverage threshold) resolves to `{ kind: 'halted', exitCode }`.
- CLI flags, defaults, the config file and the generated output are unchanged.

## Breaking change in 0.9.0: Angular 21+ standalone code only

compodocx now documents Angular 21+ standalone code only. NgModule-based and decorator-based constructs are no longer extracted or rendered.

No longer documented:

- NgModules: the Modules chapter, `modules.html`, the per-module pages and the module dependency graphs (and the Graphviz dependency behind them). `ModuleWithProviders`, `bootstrapModule`, `entryComponents`, `RouterModule.forRoot/forChild` and string `loadChildren` are not read either. A class decorated with `@NgModule` is skipped.
- Decorator members: `@Input`, `@Output`, `@HostBinding` and `@HostListener`. A formerly decorated field shows up as a plain property. Use `input()`, `output()`, `model()` and the `host` metadata object.
- Constructor injection in `@Component`, `@Directive`, `@Pipe` and `@Injectable` classes: no parameter properties, no constructor entry. Use `inject()`. Parameterless constructors and plain classes keep their constructor documentation.
- Class guards, resolvers and interceptors (classes implementing `CanActivate`, `CanDeactivate`, `CanMatch`, `CanLoad`, `Resolve` or `HttpInterceptor`). They are documented as plain classes or injectables. Functional guards, resolvers and interceptors are unchanged.

What you see instead: a full run prints a warning with the number of legacy constructs it skipped and their locations, grouped by kind, for example:

```text
Angular 21+ only: 93 legacy constructs are not documented
  ng-module (9): src/app/app.module.ts:32 AppModule, ...
  input-decorator (28): src/app/app.component.ts:52 AppComponent.title, ...
```

The exit code is unchanged and the notice is not part of the JSON export.

Configuration and template changes:

- `disableMainGraph` is removed (there is no module graph any more). The flag and the config key are ignored with a warning.
- `toggleMenuItems: ['modules']` is accepted, has no effect and logs a warning. Remove the value.
- The `modules.js` and `module.js` template overrides are removed; a file with either name is ignored with a warning.
- The i18n keys of module pages are removed, see "Removed i18n keys" below.

JSON export: `modules` and `entryComponents` are gone; see "JSON export schema 6" below.

## Breaking change in 0.9.0: typed routes and `disableRoutes`

Routes are read through the project analysis: a router starts at `bootstrapApplication` and its `provideRouter` call, route arrays are recognised by their `@angular/router` type, and lazy `loadChildren` route arrays are expanded below their route. See "Routes" in docs/configuration.md for what is read.

- **Typed `routes` in the JSON export.** `routes` used to hold one tree object under a key typed as a list. It is now a typed list of router and unmounted roots, written only when the project has routes; components gain `routedAt` and route array variables `mountedAt`. See "JSON export schema 6" below. `compodocx diff` does not compare routes.
- **No routes graph.** The routes page is a server-rendered table per router; the d3 graph and `js/routes/routes_index.js` are gone. A custom `routes` page override receives `routing` (the route model), `symbols` and `depth` instead of `routes`. Rows carry the anchors `route-<root>-<index>...`, sections `route-<root>`.
- **No page without routes.** `routes.html` and its menu entry are generated only when the project has routes.
- **`disableRoutesGraph` -> `disableRoutes`.** Rename the key in your config file and the flag in your scripts. `--disableRoutesGraph` is dropped with a warning and the config key is ignored with a warning, so routes stay enabled until you switch.
- **New block override `block-routed-at`.** Renders "Routed at" on component pages and "Mounted at" on route array variables; receives `{ id, title, links }` with `links` as `{ label, href }[]`.
- **Route file variables.** Variables in files with a `Routes` array show their source as default value instead of a rewritten one, and an exported route array that the former parser could not read is now documented.

## Changes in 0.9.0: style files and design tokens

compodocx can document style files that no component reads (theme bridges, directive assets, global token sheets), give them pages and collect global tokens on a design tokens page. Nothing changes until you set `styleFiles`, except the two behaviour changes below.

Behaviour changes:

- **Unknown tags in style comments are dropped.** A tag the style parser does not read (for example `@todo` or `@internal` in a `///` or `/** */` block, or any tag other than `@themes` and `@relatedTo` inside an `@overview` block) used to be appended to the token description as plain text. It is now dropped and reported once per run; the exit code is unchanged:

    ```text
    Style comments: 2 unknown tags ignored (@todo x1, @note x1)
      src/theming/button.css:14 @todo
      src/theming/button.css:31 @note
    ```

    Move text you want to keep into the description (the lines above the first tag).
- **`themingTabSections` gains `mixins`.** The default list is now `overview`, `index`, `tokens`, `mixins`, `source`. A project that sets the list explicitly does not see documented mixins until it adds `mixins`.

Template overrides (all additive):

| Name | Kind | Receives |
|-|-|-|
| `style` | page | main data plus `style` (`file`, `name`, `language`, `importLine`, `overview`, `groups`, `mixins`, `themes`, `relatedTo`, `sources`), `styleEntry`, `depth` |
| `design-tokens` | page | main data plus `groups` (tokens by `@group`), `depth: 0` |
| `block-theming-mixin` | block | `{ mixin, depth, related }` |

`block-theming` also receives `mixins` and `linked`, and `block-theming-token` receives `related`, each only when non-empty. Existing overrides keep working. See docs/custom-templates.md.

JSON export: no breaking change of its own. Every new field is optional: top-level `styleFiles`, `themeTokens` / `themeOverview` / `themeStyleSources` on directives, `relatedTo` on tokens. A component's theme fields now include the files that theme it with `@themes`. `ExportComponent.themeOverview` is typed as `string` (it was declared `string[]` but always held one string). `compodocx diff` does not compare `styleFiles`.

To adopt:

1. List your free-standing style files in the config file: `{ "styleFiles": ["projects/*/theming/**/*.css", "projects/themes/**/*.{css,scss}"] }`. The globs are relative to the config file's folder.
2. Add `@themes AcmeCard` to a file that styles one component or directive, in its `@overview` block or a block of its own. A theme bridge for several targets lists them all (`@themes AcmeButton, AcmeCard`) and gets a page of its own.
3. Document global tokens (files that theme no symbol) with `@group` so the design tokens page groups them.
4. Check the build log: `Style files: ...` counts the matched files and names those without documented content, which get no page.

See docs/theming-tokens-authoring-guide.md for the tag set and examples.

## Changes in 0.9.0: shared sidebar and role groups

The sidebar menu and the command palette's entity index are no longer part of every page. Each site (each version folder in multi-version output) gets `js/menu.js` and `js/entities.js`, and every page loads them with a content hash in the query (`js/menu.js?v=1a2b3c4d`). Page URLs, anchors and search results do not change.

What to check:

- **`menu` template override.** It is rendered once per run, not once per page, and always receives the root data: `data.depth` is `0` and `data.context` is `'menu'`. An override that used the page's depth or context to build links or mark the current page must stop doing so. Write links as paths from the documentation root without a `./` or `../` prefix and give the anchor a `data-type` attribute; the client adds the prefix for the current page and marks the active link. See docs/custom-templates.md.
- **Scripts and styles that read the sidebar.** The menu markup is inserted into `#sidebar` by `js/menu.js`, a classic script right after the sidebar element, so it exists before `DOMContentLoaded`. A custom script that reads `#sidebar` content earlier in the page (an inline script above the sidebar), or a tool that scrapes the menu from the page HTML, finds only the sidebar header; read `js/menu.js` or wait for `DOMContentLoaded`. CSS selectors are unaffected: the DOM after load is the same as before.
- **No sidebar menu without JavaScript.** Pages still show the header and content; the menu needs JavaScript (its links needed it before on pages below the root).
- **Feature sidebar layout.** Under `menuLayout: 'feature'`, tokens move from a feature's top level into a collapsed Configuration node, and functions, constants, types and other classes of a feature with primary members now appear in a collapsed More node. To get close to the old list, set:

    ```json
    { "menuFeatureSections": { "configuration": "top", "utilities": "hidden", "constants": "hidden", "types": "hidden" } }
    ```

    `configuration: "top"` also lists providers and feature types at the top level, which the old list left out.

## Breaking change in 0.3.0: multi-version output is the default

Starting with `@cngxjs/compodocx@0.3.0`, `compodocx -d <output>` writes the generated HTML to `<output>/<versionLabel>/` instead of `<output>/`, and maintains a small `<output>/versions.json` manifest next to it.

For deploy scripts that upload `<output>/`:

- The HTML now lives one folder deeper. Update any path the script points at.
- A new `versions.json` file is emitted alongside the version subfolder.

Two ways to react:

```diff
# 1. Embrace the new layout (recommended)
- compodocx -p tsconfig.json -d docs
+ compodocx -p tsconfig.json -d docs           # writes docs/<version>/ + docs/versions.json
+ # update deploy to upload docs/ as the deploy root
```

```diff
# 2. Keep the previous flat layout
- compodocx -p tsconfig.json -d docs
+ compodocx -p tsconfig.json -d docs --no-multiVersion
```

Full pattern, deployment recipes, and version-switcher reference: [`docs/versioned-docs.md`](docs/versioned-docs.md).

## CLI flag compatibility

| Flag | Status | Notes |
|-|-|-|
| `-p`, `--tsconfig` | unchanged ||
| `-c`, `--config` | unchanged | Also finds the `compodocx` config names, see "Config file" below |
| `-d`, `--output` | unchanged | HTML goes to `<output>/<version>/` unless `--no-multiVersion` |
| `-s`, `--serve`, `-r`, `--port`, `--host`, `-w`, `--watch`, `-o`, `--open` | unchanged ||
| `-e`, `--exportFormat` | extended | `html` (default), `json` and `llm-md`. `llm-md` writes Markdown for language models: to stdout without an output folder, to `<output>/llm-context.md` when `-d` or the `output` key is set. The JSON shape changed, see "JSON export schema 6" below |
| `--jsonIndent` | new (default `0`) | Indent for `documentation.json`, `0` to `8`. Pass `--jsonIndent 2` for human-readable formatting |
| `--multiVersion` / `--no-multiVersion` | new (default `true`) | See "Multi-version output is the default" above |
| `--versionLabel`, `--versionsRoot`, `--maxVersionsShown` | new | Multi-version controls. See `docs/versioned-docs.md` |
| `-n`, `--name`, `-a`, `--assetsFolder`, `-t`, `--silent`, `--language` | unchanged ||
| `--theme` | new theme set | See "Themes" below |
| `-y`, `--extTheme` | deprecated | Used as the `--theme` path when `--theme` is not set; it does not load an additional stylesheet. Use `--theme <file.css>` |
| `--shikiTheme` | new | Syntax highlighting theme pair |
| `--templates` | breaking | Now expects JavaScript files (CommonJS modules), not Handlebars partials. See "Custom templates" below |
| `--includes`, `--includesName` | unchanged ||
| `--coverageTest`, `--coverageMinimumPerFile`, `--coverageTestThresholdFail`, `--coverageTestShowOnlyFailed`, `--unitTestCoverage`, `--files` | unchanged | In the config file a number is the threshold, `true` uses the default (`70` / `0`) and `coverageTestThresholdFail: false` only warns |
| `--disableSourceCode`, `--disableDomTree`, `--disableTemplateTab`, `--disableStyleTab`, `--disableGraph`, `--disableCoverage`, `--disablePrivate`, `--disableProtected`, `--disableInternal`, `--disableLifeCycleHooks`, `--disableConstructors`, `--disableFilePath`, `--disableSearch`, `--disableDependencies`, `--disableProperties`, `--disableOverview` | unchanged ||
| `--disableDependenciesTab` | new | Hides the per-component Dependencies tab (the component's neighbourhood in the project graph) independently from `--disableGraph` |
| `--disablePlaygroundTab`, `--strictPlaygrounds` | new | `@playground` controls |
| `--disableRoutes` | new | Turns route reading off: no routes page, menu entry, Routed at / Mounted at links or exported routes |
| `--minimal` | changed | Also sets `--disableRoutes` |
| `--customFavicon`, `--customLogo`, `--hideGenerator`, `--hideDarkModeToggle` | unchanged ||
| `--toggleMenuItems`, `--navTabConfig` | unchanged | `toggleMenuItems` values `modules`, `miscellaneous` and `tokens` are ignored with a warning; `navTabConfig` tab IDs are listed in docs/configuration.md |
| `--gaID` | replaces `--gaSite` | GA4 measurement IDs only (`G-XXXXXXXXXX`). SPA pageviews tracked automatically |
| `--showEffects` | new (default `false`) | Renders Angular `effect()` blocks in a dedicated section on the API tab |
| `--publicApiOnly <path>` | new | Restricts the documentation to the public API (`*.api.md` reports, or the `index.d.ts` files below `<path>`) |
| `--maxSearchResults` | needs a value | An integer from `0` to `10000` (`0` shows all results); a bare `--maxSearchResults` or any other value stops the build. The `maxSearchResults` config key is read; the flag wins when both are set |
| `--gaSite` | removed | Universal Analytics is end-of-life. The flag and the `gaSite` config key warn and are ignored |
| `--templatePlayground` | removed | The flag and the `templatePlayground` config key warn and are ignored. Convert Handlebars partials by hand ([cookbook](#hbs--js-cookbook)) |
| `--disableMainGraph` | removed | There is no module graph. The flag and the config key warn and are ignored |
| `--disableRoutesGraph` | removed | There is no routes graph. The flag and the config key warn and are ignored; use `--disableRoutes` to turn routes off |
| `--groupBy`, `--groupDepth` | removed | Both layouts group by feature. The flags and the config keys warn and are ignored |
| `--stackblitz`, `--stackblitzTemplate` | removed | They never had an effect. The flags and the config keys warn and are ignored; use `@playground` |

A removed flag never stops the build: it is dropped with one warning (together with its value), and the run goes on.

## Config file

compodocx looks for its config file in the folder it runs in. The `compodocx` names come first (a `compodocx` key in `package.json`, `.compodocxrc` with or without a `.json`, `.yaml`, `.yml`, `.js`, `.ts`, `.mjs` or `.cjs` extension, `compodocx.config.*`), then the same `compodoc` names (`compodoc` key, `.compodocrc*`, `compodoc.config.*`). `-c <file>` names the file explicitly.

Config keys use the names of the long CLI flags (`tsconfig`, `output`, `disablePrivate`, ...); the CLI flag wins when both are set. Keys of removed flags (`gaSite`, `templatePlayground`, `disableMainGraph`, `disableRoutesGraph`, `groupBy`, `groupDepth`, `stackblitz`, `stackblitzTemplate`) and the keys `featureLibraryScope` and `base` are ignored with a warning.

Some options are config-only (no CLI flag). The ones most projects meet first:

| Key | Default | Notes |
|-|-|-|
| `menuLayout` | `'feature'` | `'feature'` shows one Features chapter (entry points, their features and the primary members of each) plus a top-level link to the `references.html` portal. `'type'` keeps one chapter per kind, each grouped by feature |
| `collapsedAll` | `false` | Every chapter and every nested folder group starts collapsed on first load, whatever `toggleMenuItems` says |
| `featuresName` | `''` | Overrides the Features chapter heading; empty uses the translated `features` key |
| `referencesName` | `''` | Exposed on `data.referencesName` for `menu.js` / `api-reference.js` overrides. The built-in templates read the localised keys and do not use it |
| `include`, `exclude` | `[]`, `['**/.git', '**/node_modules', '**/*.d.ts', '**/*.spec.ts']` | Source globs relative to the tsconfig folder; `exclude` replaces the default list |
| `infoTabSections`, `apiTabSections` | `[]` (all) | Regions of the Info and API tabs |
| `themingTabSections` | `[]` (all) | Regions of the Theming tab: `overview`, `index`, `tokens`, `mixins`, `source`. An explicit list replaces the default in full |
| `playgroundDependencies` | `{}` | Extra packages forwarded to every `@playground` StackBlitz project |

The full list, including `styleFiles`, `features`, `classificationAxes`, `menuFeatureSections` and the other `playground*` keys, is in [docs/configuration.md](docs/configuration.md).

## JSON export schema 6

`documentation.json` (`--exportFormat json`) is written with `schemaVersion: 6`. compodoc wrote no `schemaVersion`; compodocx 0.3.0 to 0.5.x wrote `1` and 0.6.0 to 0.8.x wrote `2`. A reader built for schema 2 needs these changes:

Removed and reshaped fields:

- `modules` (top level) and `entryComponents` (components) are removed.
- `category` and `docsKind` are removed from every entry and member.
- `referencedBy` is removed from every entry. Use `usedBy`, which comes from the project analysis.
- `factoryKind` is removed from function entries. What a function does for dependency injection is in its semantic facts (`di.role`, `di.featureType`, `di.usesInjectionContext`).
- `routes` is a typed list of roots instead of one tree object, written only when the project has routes:

    ```ts
    interface ExportRouteRoot {
        kind: 'router' | 'unmounted';
        bootstraps?: { file: string; line: number; component?: string }[];
        config?: string;              // name of the config variable holding provideRouter
        features?: ExportRouteRef[];  // provideRouter(routes, ...features)
        array?: string;               // name of the route array variable
        routes: ExportRoute[];        // path, fullPath, component, loadChildren, redirectTo,
                                      // title, canActivate, ..., resolve, providers, data,
                                      // file, line, children
    }
    interface ExportRouteRef { name: string; file?: string; source: string; call?: true }
    ```

- Style sources are shared: the top-level `styleSources` map holds `{ content, language }` per key, and each component's `themeStyleSources` lists keys into it (the project-relative file path, or `<component file>#inline-<n>` for inline styles).
- `inputsClass`, `outputsClass`, `hostBindings` and `hostListeners` come from signal APIs and the `host` object only; `guards` and `interceptors` list functional ones only.
- `themeOverview` on components holds one string (it was typed `string[]`).

Changed values:

- Signal inputs and models: `defaultValue` is the initial value argument only, without the options object; a string `alias` option is written as the new `alias` field, and `type` is the first type argument. `output({ ... })` has no `defaultValue`.
- `providedIn` of services and injection tokens is written without quotes (`root`, not `'root'`).
- Generic type arguments are joined with `,` (`Record<string, number>`; it was `Record<string | number>`).
- `file` of theme tokens and theme style sources is relative to the working directory with forward slashes (it was an absolute path).
- Parameter types of top-level functions keep the declared type (array, union, function, literal and tuple types were written as `undefined`).

New optional fields (readers can ignore them): the semantic facts on every symbol entry (`entryPoint`, `exportedBy`, `notExported`, `usedBy`, `di`, `token`, `feature`, `axes`, `routedAt`, `mountedAt`, see "Semantic fields in the JSON export" in docs/configuration.md), the top-level `semantic` object, `services` (Angular 22 `@Service` classes), `styleFiles`, `tokens[].factory`, `tokenClass`, `call: { callee, args }` on `providers` / `viewProviders` entries written as a call, `themeTokens` / `themeOverview` / `themeStyleSources` on directives and `relatedTo` on tokens. Function guards and functional resolvers stay under `miscellaneous` with their `functionalKind`, although the HTML shows them as guards and resolvers.

The header fields are `schemaVersion`, `generatedAt` (ISO 8601) and `compodocxVersion`. The export is written on one line by default; pass `--jsonIndent 2` for indented output. The TypeScript types of the export are not part of the package; the shape is declared in [`src/app/interfaces/export-data.interface.ts`](https://github.com/cngxjs/compodocx/blob/develop/src/app/interfaces/export-data.interface.ts) in the repository.

`compodocx diff` reads schema 6 only: an older or newer export exits with code 2 and asks to re-export (or to upgrade compodocx). Re-export stored baselines after upgrading. `compodocx diff` does not compare `routes` or `styleFiles`.

Every schema version, the changes of values within schema 6 by release, and the compatibility policy for future changes are listed in [`docs/json-export.md`](https://github.com/cngxjs/compodocx/blob/develop/docs/json-export.md).

## Removed i18n keys

Custom locale overrides of these keys have no effect any more. Removed with the pages they labelled: `category`, `declarations`, `docskind-primary-title`, `empty-category-desc`, `empty-category-title`, `entrycomponents`, `module`, `modules`, `no-graph`, `no-svg`, `open-detail-page`.

Removed because no page looked them up: `all-categories`, `angular-adoption`, `browse`, `categories`, `empty-accessors`, `empty-classes-desc`, `empty-classes-title`, `empty-components-desc`, `empty-components-title`, `empty-constructor`, `empty-coverage-desc`, `empty-coverage-title`, `empty-directives-desc`, `empty-directives-title`, `empty-entity-action`, `empty-enum-values`, `empty-examples-desc`, `empty-examples-title`, `empty-guards-desc`, `empty-guards-title`, `empty-hostbindings`, `empty-hostlisteners`, `empty-index-signatures`, `empty-injectables-desc`, `empty-injectables-title`, `empty-inputs`, `empty-interceptors-desc`, `empty-interceptors-title`, `empty-interfaces-desc`, `empty-interfaces-title`, `empty-methods`, `empty-outputs`, `empty-pipes-desc`, `empty-pipes-title`, `empty-properties`, `empty-search-desc`, `hostdirectives`, `legend`, `miscellaneous`, `no`, `no-iframe`, `no-result-matching`, `project-health`, `project-overview`, `referenced-by`, `results-matching`, `schemas`, `search-placeholder`, `unamed-property`, `view-details`, `yes`.

## Themes

The bundled theme set is different.

| Old compodoc theme | Closest replacement |
|-|-|
| `gitbook` | `gitbook` (renders like `default`) |
| `material` | `default` |
| `original` | `default` |
| `postmark` | `nord` |
| `readthedocs` | `default` |
| `stripe` | `ocean` |
| `vagrant` | `midnight` |
| `laravel` | `ember` |

Eight bundled compodocx themes: `default`, `ocean`, `midnight`, `nord`, `rose-pine`, `ember`, `neon`, `brutalist`. `gitbook` is kept as a name and renders like `default`. The other old theme names still work: they warn and fall back to the replacement in the table.

Each theme is a single CSS file overriding the design tokens defined in `src/styles/compodocx.css`. Author your own by copying [`src/themes/theme-template.css`](https://github.com/cngxjs/compodocx/blob/develop/src/themes/theme-template.css) from the repository (it is not part of the npm package), setting tokens, and passing the path via `--theme`.

## Custom templates: HBS → JS

The biggest behavioral break. compodocx ships a JavaScript-based template override system that replaces compodoc's Handlebars partials.

### Layout

```text
my-templates/
└── partials/
    ├── overview.js
    ├── component.js
    ├── block-method.js
    └── menu.js
```

Pass that directory via `--templates ./my-templates`.

### Contract

```js
module.exports = function (data, helpers) {
    // data    - the full props the built-in template would receive
    // helpers - everything exported from src/templates/helpers/index.ts
    return "<html string here>";
};
```

The returned string is inserted raw - no escaping. `null` falls back to the built-in TSX rendering. Overrides are consulted before the built-in renderer. Files are loaded with `require()`; in a package with `"type": "module"` see "Loading" in docs/custom-templates.md.

### HBS → JS cookbook

```handlebars
{{! 1. Expression }}
{{name}}
```

```js
`${data.name}`;
```

```handlebars
{{! 2. Conditional }}
{{#if deprecated}}<span class="deprecated">{{deprecationMessage}}</span>{{/if}}
```

```js
data.deprecated ? `<span class="deprecated">${data.deprecationMessage}</span>` : "";
```

```handlebars
{{! 3. Iteration }}
{{#each methods}}
    <li>{{name}}</li>
{{/each}}
```

```js
data.methods.map((m) => `<li>${m.name}</li>`).join("");
```

```handlebars
{{! 4. Helper invocation }}
{{linkType returnType}}
```

```js
helpers.linkTypeHtml(data.returnType);
```

```handlebars
{{!-- 5. Partial / sub-template --}}
{{> block-method methods=instanceMethods}}
```

```js
const blockMethod = require("./block-method.js");
return blockMethod({ methods: data.instanceMethods, file: data.file }, helpers);
```

```handlebars
{{! 6. Triple-stash (unescaped) }}
{{{rawHtml}}}
```

```js
data.rawHtml;
```

### Reference templates

Two copy-paste-ready overrides under `test/fixtures/test-templates/partials/`:

- `component.js` - overrides the `component` page-level template, exercises `data.component.*` plus `helpers.parseDescription()`, `functionSignature()`, `extractJsdocParams()`, `linkTypeHtml()`.
- `block-method.js` - overrides the `block-method` block-level template, exercises iteration, `helpers.t()`, conditional rendering.

Both are wired into the `cli-templates` integration spec and stay working examples over time.

## Override names

Stable contract for `--templates`. Data shapes documented inline in the corresponding TSX source under `src/templates/` and in docs/custom-templates.md.

### Page-level

`overview`, `markdown`, `component`, `directive`, `injectable`, `service`, `interceptor`, `guard`, `resolver`, `pipe`, `class`, `interface`, `entity`, `token`, `function`, `variable`, `typealias`, `enumeration`, `utilities`, `dependency-injection`, `di-cluster`, `feature`, `style`, `design-tokens`, `api-reference`, `routes`, `app-config`, `additional-page`, `package-dependencies`, `package-properties`, `coverage-report`, `unit-test-report`, `menu`

Symbol pages live in the folder of their feature (`forms/select/SelectPanel.html`); the page object carries the symbol under the key of its kind (`data.component`, `data.function`, `data.resolver`, ...). `utilities`, `dependency-injection` and `api-reference` target the root pages `utilities.html`, `dependency-injection.html` and `references.html`. `di-cluster` targets the page of a feature type, `<FeatureType>.html` in its feature folder: `data.cluster = { featureType, providers, features, tokens }`, each list holding the same entity objects the symbol pages get. A provider without a feature type has no override of its own.

The `feature` context targets the page of a feature, `index.html` in the feature's folder (`forms/select/index.html`): `data.feature = { id, label, entryPoint, importPath, detector, segments, parent, readme, members, subFeatures, buildsOn, extendedBy }`, see docs/custom-templates.md.

### Block-level

`block-theming`, `block-theming-token`, `block-theming-mixin`, `block-routed-at`, `block-method`, `block-property`, `block-input`, `block-output`, `block-accessors`, `block-host-listeners`, `block-host-bindings`, `block-derived-state`, `block-constructor`, `block-index`, `block-index-signatures`, `block-playground`, `playground-content`, `referenced-by`, `related`, `version-switcher`

The `referenced-by` block renders the "Used by" chip list: the declarations that use the symbol, from the project analysis. Data: `{ entries: ReferencedByEntry[], depth: number }` with `ReferencedByEntry = { name, kind, hrefPrefix, pageName?, anchor? }` (`pageName` is the page's file name when it differs from `name`, as on a feature type page; `anchor` is the section on that page).

The `related` block renders the Related section of a symbol's `@relatedTo` tag. Data: `{ entityName, relatedTo, depth }`, `relatedTo` being the names as written (absent when the symbol has none).

### Removed / not overridable

- `modules`, `module` - removed with the module pages; a file with either name is ignored with a warning.
- `bucket-landing` - removed with the `categories/` pages; see "Breaking change in 0.9.0: features replace category buckets".
- `block-enum`, `block-typealias`, `block-host-listener` - no page rendered these blocks; a file with one of these names is ignored with a warning. `block-host-listeners` covers host listeners.
- `miscellaneous-functions`, `miscellaneous-variables`, `miscellaneous-typealiases`, `miscellaneous-enumerations`, `miscellaneous-function`, `miscellaneous-variable`, `miscellaneous-typealias`, `miscellaneous-enumeration` - renamed, see the table in "Breaking change in 0.9.0: dependency injection and utilities pages". A file with an old name is ignored with a rename hint.
- `component-detail` - compodoc's detail partial is part of the `component` page.
- `search-results`, `search-input` - Pagefind replaces Lunr and ships its own UI shell. No override hook.
- `breadcrumbs` - replaced by inline rendering in the entity hero. Override the page-level template if you need to change breadcrumb markup.
- `block-relationships`, `index`, `index-misc`, `link-type` - not overridable. `link-type` was a Handlebars helper, available now as `helpers.linkTypeHtml(typeName, { depth })` inside any JS override.

## Helper API

Every override receives a `helpers` object as its second argument - the full export of `src/templates/helpers/index.ts`. The source is authoritative; key entries:

| Helper | What it does |
|-|-|
| `t(key, params?)` | i18n lookup |
| `linkTypeHtml(type, { depth })` | Renders a TypeScript type as a clickable HTML chip; `depth` is the page's `data.depth` |
| `resolveType(name, indexKey, depth)` | Looks up an entity name and returns `{ raw, href, target, indexKey, kind? }` or `null` (pass `undefined` as `indexKey`) |
| `parseDescription(desc, depth)` | Renders a JSDoc description through the Markdown engine and resolves its `{@link}` targets |
| `functionSignature(method, depth)` | Code-formatted parameter list for a method |
| `extractJsdocParams(tags)` / `hasJsdocParams(tags)` | JSDoc helpers |
| `extractJsdocExamples(tags)` / `exampleComments(tags)` | JSDoc helpers; `exampleComments` returns each `@example` body as rendered HTML |
| `jsdocReturnsComment(tags)` | Pulls the `@returns` comment text |
| `signalKindLabel(kind)` | Maps signal kinds to human labels |
| `modifKind(k)` / `modifSlug(k)` / `modifIcon(k)` | TypeScript SyntaxKind modifier mappers |
| `relativeUrl(depth, path?)` / `shortPath(path)` / `shortUrl(url)` | URL / path utilities; `relativeUrl(data.depth, 'index.html')` links to the root |
| `codeWrap(html)` / `highlightedCodeWrap(value)` | Wrap content in `<code>` / `<pre>`, optionally Shiki-highlighted |
| `isApiSection(id)` / `isInfoSection(id)` / `isThemingSection(id)` / `isTabEnabled(navTabs, id)` | Honor user tab/section configuration |
| `computeCoverageStats(files)` | Runs the documentation-coverage analysis |

`resolveBucketSegments`, `hasAnyApiSections` and `isInternalMember` are no longer exported.

## CSS class rename cheatsheet

compodoc emitted Bootstrap classes plus ad-hoc `compodoc-` names. compodocx prefixes everything with `cdx-` and drops Bootstrap markup entirely.

| compodoc class | compodocx replacement |
|-|-|
| `.card`, `.card-block`, `.panel` | `.cdx-member-card`, `.cdx-member-body`, `.cdx-content-section` |
| `.nav.nav-tabs`, `.nav-link`, `.tab-content`, `.tab-pane` | `.cdx-tab-bar`, `.cdx-tab`, `.cdx-tab-panel` |
| `.menu`, `.chapter`, `.link`, `.collapse` | `nav.cdx-sidebar.menu` (`#sidebar`); the menu inside still uses `.chapter`, `.link` and `.collapse` |
| `.compodoc-icon-*` | `.cdx-icon` (Lucide-style inline SVGs) |
| Bootstrap badges (`.badge`, `.badge-primary`) | `.cdx-badge`, `.cdx-badge--<kind>` |
| `.alert` | gone; deprecation notices use `.cdx-deprecation-banner` |
| `.coverage-*` | `.cdx-coverage-*` |
| `.col-md-*`, `.row` (Bootstrap grid) | gone - replaced by CSS Grid + Flexbox |
| `.modal` | `.cdx-cp-panel` (used for the command palette) |

`data-compodoc="<block-name>"` attributes are emitted on every section to make CSS targeting and downstream scraping stable across versions.

## Unsupported migrations

What does NOT migrate cleanly:

- **Custom Handlebars helpers.** compodoc's `loadHelpers` extension point is gone. Port your `{{myHelper foo bar}}` partials as plain JavaScript functions and call them inline from your `partials/*.js` overrides.
- **`search-results` / `search-input` overrides.** Pagefind owns the search UI shell now. Style adjustments are still possible via CSS.
- **Block-level data-shape changes.** Several block templates received structured data in compodocx where compodoc passed strings:
    - `providers` and `viewProviders` are `ProviderEntry[]` (objects) instead of stringified arrays.
    - `host` is `hostStructured`, an array of `{ kind, name, value }` records.
    - `signalDeps` is a new `string[]` on `computed`/`linked-signal` properties.

    Templates that interpolated the raw strings need to walk the structured shape. Reference TSX: `HostSection.tsx`, `ProvidersSection.tsx`, `BlockDerivedState.tsx`.

- **`--gaSite` flag.** Use `--gaID G-XXXXXXXXXX` (GA4 measurement ID).
- **Bootstrap markup contract.** Downstream tooling that scraped specific Bootstrap selectors (e.g. `.card.text-center`, `.panel-default`) needs an update - those classes are no longer emitted. Use the `cdx-*` selectors or the stable `data-compodoc="<block-name>"` attributes instead.
- **Lunr search index.** Replaced by Pagefind. The `js/search/` and `pageinfo.json` files are gone. Pagefind writes its index to `pagefind/` next to the HTML output.
