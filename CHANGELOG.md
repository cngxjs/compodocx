# Changelog

All notable changes to compodocx are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the version numbers follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For the upstream compodoc history that predates the cngx fork, see <https://github.com/compodoc/compodoc/blob/master/CHANGELOG.md>.

## [Unreleased]

### Added

- **Legacy notice.** compodocx documents Angular 21+ standalone code only. A full run now warns with the number of legacy constructs it skipped (NgModules, `@Input`/`@Output`/`@HostBinding`/`@HostListener` members, constructor injection, class guards/interceptors/resolvers, `standalone: false`, `RouterModule.forRoot/forChild`, string `loadChildren` and similar) and lists their locations per kind. The exit code is unchanged.
- **Semantic facts in the JSON export.** compodocx now analyses the whole project through the `-p` tsconfig (`extends`, `paths` and `baseUrl` included) and adds optional fields to every symbol in `documentation.json`: the entry point that exports it (`entryPoint`, `exportedBy`), whether an exported symbol is reachable from no entry point (`notExported`), who uses it (`usedBy`), its dependency injection role (`di`: provider or feature function, feature type, tokens provided and read, whether it needs an injection context) and, for injection tokens, the shape of the token type (`token`). A top-level `semantic` object lists the entry points (`ng-package.json` entry files and barrel-shaped tsconfig `paths` targets) and the counts, which the build log prints as one `Semantic analysis:` line. Symbols without facts are written as before, the HTML output is unchanged and the schema version stays 3. See the export section in [docs/configuration.md](docs/configuration.md).

### Changed

- **Angular 21+ standalone code only (breaking).** NgModules, decorator members, constructor injection in Angular classes and class guards/interceptors/resolvers are no longer documented; class guards and interceptors show up as plain classes or injectables. See [MIGRATION.md](MIGRATION.md).
- **JSON export schema 3 (breaking for export consumers).** `modules` and `entryComponents` are removed. Component style sources move into a shared top-level `styleSources` map; `themeStyleSources` now lists keys into it, and inline styles get a per-component key (`<component file>#inline-<n>`) instead of a shared `<inline-style-N>`. `compodocx diff` and the llm-md export follow.
- **Standalone imports link without module pages.** The overview always shows the standalone dependency graph. On component pages, imports link to documented components, directives and pipes, Angular API symbols link to angular.dev, anything else stays plain text.
- **Routes tree root.** The root node of the routes data is `{ name: '<root>', kind: 'root' }`.
- **`groupBy` defaults to `'folder'`** when unset (it was `'none'` for projects with NgModules).

- **One generation pipeline.** Every run (one-shot build, coverage test, watch rebuilds) now goes through a single sequence of phases with one table of prepare steps, instead of two hand-maintained queues and a callback chain. The generated output is byte-identical to before; CLI flags, defaults and the export schema are unchanged.
- **Programmatic entry point is `runCompodocx` (breaking for API users).** The `Application` and `CliApplication` exports are removed. `runCompodocx` is exported as experimental; the CLI remains the supported entry point. See [MIGRATION.md](MIGRATION.md).
- **The "done" log line waits for every file.** The `--assetsFolder` copy is now awaited, so `Documentation generated in ...` appears only once all files are on disk. The seconds in that line count from the start of the generation run instead of process start.

### Removed

- **Module pages, chapter and graph.** `modules.html`, the per-module pages, the Modules sidebar chapter, the module dependency graphs and the `@compodoc/ngd-transformer` dependency are gone, together with the `disableMainGraph` option and the `modules.js`/`module.js` template overrides. The `toggleMenuItems` value `modules` is ignored with a warning.
- **i18n keys** `module`, `modules`, `bootstrap`, `declarations`, `entrycomponents` and `no-svg`.

### Fixed

- **Injected fields with a type argument.** A class field initialised with `inject<T>(X)` (for example `inject<TemplateRef<Ctx>>(TemplateRef)`) was not recognised as injected, so it showed no `inject()` badge, an `unknown` type and no entry in the Dependencies section. `inject()` is now detected from the syntax tree, including type arguments, chained calls and aliased or namespace imports of `inject`.
- **Functional resolvers are no longer dropped.** An exported const typed as `ResolveFn<T>` was recognised as a functional resolver but then stored nowhere, so it was missing from the docs and the JSON export. It is now listed under miscellaneous variables with `functionalKind: 'resolver'`.
- **`@Injectable({ providedIn })` is extracted.** The value was never read from the decorator, so every service was labelled `Service` and the `providedIn` context line never rendered. Services provided in `'root'` or `'platform'` now show as singleton services. String values are stored without quotes for both services and injection tokens (tokens previously kept the source quotes, e.g. `"'root'"` in the JSON export); pages still render the literal in single quotes.
- **Type links on miscellaneous detail pages.** Links in signatures, parameter lists, return types and type definitions on `miscellaneous/<collection>/<name>.html` pages pointed one directory too shallow and were broken. They now resolve at the page's depth; links on all other pages are unchanged.
- **`HttpContextToken` on token pages.** Tokens created with `new HttpContextToken(...)` were rendered as `InjectionToken<T>` on the token page and in the llm-md export. The constructor is now kept in the new optional `tokenClass` export field and shown as `HttpContextToken<T>`.
- **No local machine paths in theme data.** Theme style sources and theme tokens stored the absolute path of each style file, which leaked into the JSON export and made it differ between machines. Their `file` values are now relative to the working directory with forward slashes, like every other entity's `file`.
- **Stable output between runs.** Source files were crawled in the order the file scanner returned them, which varies between runs. Symbols sharing a name could swap order, and duplicate-name suffixes (`Todo-1`, `Todo-2`) could point at a different declaration on each build. Files are now crawled in sorted path order.
- **Links on the app-config page.** Links from the app-config page to documented provider functions pointed one directory above the docs root and were broken. They now resolve from the page's own location.
- **Links to tagged miscellaneous symbols.** A function, variable, type alias or enumeration with an `@category` tag has its own page, but type links, function signatures, `{@link}` tags and the coverage report still pointed at its anchor on the shared collection page. They now link to the symbol's own page.
- **Unresolved `{@link}` targets.** A `{@link Name}` whose target is not a documented symbol rendered as a link to a file named after the symbol, which does not exist. It now renders as inline code, like an unresolved type reference. URLs and file targets are still links.

## [0.8.0] - 2026-08-03

Content slots are now documented on directive pages, not only on component pages.

### Added

- **`@slot` inventory renders on directive pages.** The `@slot <name> <description>` tag was extracted and rendered for components only, so a directive that hosts projected content documented nothing - and slot hosts are frequently directives (a list item, a tab host), whose own API tab is often the emptiest because the marker directives they accept carry no inputs or outputs. `slots` is now carried through the directive dependency factory, and the section moved into a shared `ContentSlots` template block so component and directive pages render one implementation with the same `#content-slots` anchor.

## [0.7.3] - 2026-07-23

A feature-layout fix so reference-only libraries get a first-class navigation node, plus a `playgroundGlobalStyles` fix so a global Sass theme entry point actually compiles.

### Added

- **`featureLibraryScope` gives reference-only libraries a first-class node under `menuLayout: 'feature'`.** A folder / `@category` bucket previously earned a node in the Features chapter only when it shipped a class-like kind (component, directive, pipe, injectable, token, class, guard, interceptor, entity). A modern-Angular library whose public surface is purely functions, interfaces, and type aliases - `provideX` / `withX` helpers, functional composables, signal-store features, adapter types - had no library node and scattered into the flat reference sections. The new config-only `featureLibraryScope: 'primary' | 'auto' | 'all'` (default `'auto'`) decides this per bucket: `'primary'` keeps the previous class-like-only behaviour; `'auto'` falls a bucket with no class-like symbol back to its full reference surface, so pure function/type libraries are first-class while class-like buckets stay curated; `'all'` lists every bucket's complete surface. The exhaustive `references.html` portal and the `categories/<bucket>.html` landing pages are unchanged in every mode.

### Fixed

- **`playgroundGlobalStyles` now compiles a global Sass entry point.** The configured global styles were always written to `src/styles.css`, and the Angular application builder selects Sass purely by file extension, so a Sass-only prelude such as `@use '@cngx/themes/material/azure-theme';` never resolved - a global Material theme bridge was silently dropped. Leading `@use` / `@forward` statements are now hoisted above the body reset alongside the existing `@import` / `@charset` / `@layer` handling (Sass errors when they follow any rule), and when the value carries a Sass prelude the sheet is emitted as `src/styles.scss` with the `angular.json` styles entry pointed at it. Plain-CSS values stay `src/styles.css`.

## [0.7.2] - 2026-06-24

A small `playgroundGlobalStyles` fix so a foundation stylesheet pulled in with `@import` actually loads.

### Fixed

- **`playgroundGlobalStyles` no longer drops a leading `@import`.** The configured global CSS was appended verbatim after the generated `src/styles.css` body reset, so a leading `@import` (the common way to pull a foundation stylesheet into a playground) landed after a style rule and was discarded per the CSS spec - the imported CSS never loaded. Leading `@import` / `@charset` / `@layer`-statement at-rules are now hoisted above the body reset; the remaining author CSS still follows the reset so it can override it.

## [0.7.1] - 2026-06-16

A `playgroundVendor` payload-size fix. Vendoring a real component library now produces a slim StackBlitz project that launches instead of failing with `413 Request Entity Too Large`.

### Fixed

- **`playgroundVendor` payload now fits StackBlitz's project-POST limit.** Vendoring a real component library previously embedded the whole `dist/<pkg>` tree verbatim, which blows StackBlitz's ~2 MB `openProject` POST limit and fails the playground launch with `413 Request Entity Too Large`. The vendored payload is now slimmed and pruned: sourcemaps (`*.map`) and legacy or duplicate bundle directories (`esm2022/`, `esm2020/`, `fesm2020/`, ...) are dropped - keeping only `fesm2022/*.mjs`, typings, and the `package.json` files - and each package is reduced to the entry points the playground actually imports, plus any sibling or cross-package entry point a kept FESM chunk or its typings references, followed transitively. SCSS-only dependencies referenced via `@use` now seed the vendor closure as well, so a theme bridge is vendored from the local build instead of resolving stale from the registry. Pruning is conservative: a package with no `exports` map, or whose imported subpath maps to no known entry point, still ships whole.

### Added

- **`playgroundVendorCap` and `playgroundVendorIncludeSourcemaps` config keys.** `playgroundVendorCap` (default ~1.5 MB, set under the StackBlitz POST limit) is the backstop byte cap on a single playground's slimmed-and-pruned vendored closure; a closure that exceeds it fails the build naming the per-package bytes, and says so explicitly when the payload also exceeds the StackBlitz limit. `playgroundVendorIncludeSourcemaps` (default `false`) keeps `*.map` sourcemaps in vendored packages.

## [0.7.0] - 2026-06-15

A playground-focused release. The `@playground` (StackBlitz) engine gains local-build vendoring, a pre-publish compile guard plus a standalone validate command, a customizable page shell, application-config injection, and configurable dependency-walk caps. All additions are config-only or opt-in; existing playgrounds render unchanged.

### Added

- **Vendoring the local build (`playgroundVendor` / `playgroundVendorRoot`).** Names and/or globs (`"@cngx/*"`) of locally built packages to embed into `@playground` projects from `dist/` instead of pulling them from the npm registry. When a playground imports a matching package, its whole built directory plus the transitive closure of other matching packages is embedded in the manifest and wired as a `file:` dependency, so the playground runs against the working tree rather than the last published release. `playgroundVendorRoot` (default `dist`) sets the base directory the closure is read from; each package is located by its `package.json` `name`, anywhere under that root. Registry peers (`@angular/*`, `rxjs`, `tslib`, ...) stay registry dependencies. Naming a package whose build output is missing fails the docs build with a clear message; a glob that matches nothing only warns.
- **Pre-publish breakage guard (`--strictPlaygrounds`).** For playgrounds whose imports resolve from the registry, each bare import is checked against the version of the package actually installed in `node_modules` (the version StackBlitz would resolve). An imported entry point or named symbol the pinned version lacks is surfaced at docs-build time: a per-playground warning by default, promoted to a hard build failure under `--strictPlaygrounds`. Both checks (subpath against the `exports` map, symbol against the entry `.d.ts`) are biased toward no false positives; vendored packages and framework peers are exempt.
- **`compodocx playground:validate <docsDir>` subcommand.** Compiles every `@playground` in a generated documentation folder and reports a per-playground pass/fail summary, the strongest guard. It reads the manifests back out of the produced HTML, materializes each StackBlitz project to a temp directory, and runs a real `npm install` + `npm run build`. Opt-in and decoupled from the docs build. Flags `--filter`, `--keep`, `--installCmd`, `--buildCmd`; exit codes `0` all passed / none found, `1` at least one failed, `2` fatal.
- **Custom `<head>` and global styles (`playgroundHead` / `playgroundGlobalStyles`).** `playgroundHead` appends arbitrary `<head>` entries to every generated `index.html` (after the Material shell links, when present) for custom fonts, meta tags, CSP, or preloads. `playgroundGlobalStyles` appends global CSS to every `src/styles.css` after the default body reset. Both extend the same shell writer the Material option uses, so they compose with it rather than replacing the scaffold. Per-block customization remains available through a `block-playground` template override.
- **`@playgroundConfig <relative.ts>` component JSDoc tag.** Ship an `app.config.ts` (providers, `provideRouter`, HTTP interceptors, any application config) into a component's playgrounds. The referenced file is shipped as the project's `src/app/app.config.ts` (its transitive relative imports bundled too) and `src/main.ts` wires `bootstrapApplication(AppComponent, appConfig)`; the file must export `appConfig`. One tag per component applies to all of that component's `@playground` blocks. Replaces the older undocumented `export { appConfig } from './app.config'` trick, which still works for back-compat.
- **`playgroundMaterialShell` config flag.** Forces the StackBlitz shell to emit the Roboto + Material-Icons font links and `mat-typography mat-app-background` body classes even when no `<mat-*>` elements are auto-detected and no Sass theme bridge is present. The shell still emits automatically on `<mat-*>` detection or a Material theme `@use`. The flag and heuristics control only the shell; they do not wire `@angular/material` / `@angular/cdk` deps or a prebuilt theme (those still require real `<mat-*>` usage).
- **Configurable dependency-walk caps (`playgroundDepDepth` / `playgroundFileCountCap` / `playgroundFileCap`).** Config-overridable versions of the built-in StackBlitz caps: max import depth followed when walking a playground's dependency graph (default `3`, range 1–100), hard ceiling on source files in one manifest (default `25`, range 1–1000), and per-file character cap before truncation (default `8000`, range 500–1,000,000). Cap-exceeded errors now name the root, the cap key, and the walked files.
- **Template-literal and computed decorator URLs.** `templateUrl` / `styleUrl` / `styleUrls` written as plain template literals (`` templateUrl: `./x.html` ``) are now resolved like string literals when bundling a `@playground`. Interpolated (`${...}`) or computed values are reported with a clear error instead of being silently dropped into a broken playground.

## [0.6.1] - 2026-05-29

### Fixed

- **Custom JSDoc tags now propagate to `class` and `injectable` entities.** The per-kind shape builders in the Angular dependency compiler copy extracted tag fields individually, and the `class` and `injectable` blocks had drifted from the directive / component reference set: classes dropped `@since`, and injectables dropped `@docsKind`, `@wcag`, `@a11y`, `@selector`, and `@relatedTo`. Both shapes now carry the full tag set, so `documentation.json` populates the fields and the class / injectable page heroes render the Primary, Since, WCAG, selector, and Related chips consistently with component and directive pages. Additive to the JSON output — the fields already belong to the schema 2 surface, so no schema bump.

## [0.6.0] - 2026-05-29

`menuLayout: 'feature'` is reshaped from a single mixed chapter into a curated **Features** chapter plus a single-page **References** portal at `references.html`, with rich Pagefind metadata, accessibility tags, bucket landing pages, a first-class `token` kind, a finalized JSDoc tag system (`@selector`, `@relatedTo`, `@wcag`, `@docsKind primary`, `@github` URL validation), and a full themed token surface to match. `documentation.json` schema bumped to `2` (additive — old readers keep working).

### Added

- **Reshaped `menuLayout: 'feature'` sidebar.** The single Features chapter is replaced with a curated **Features** chapter (the subset of organisms a consumer USES - components, directives, pipes, injectables, tokens, classes, guards, interceptors, entities) plus a flat top-level **Reference** anchor to the new single-page `references.html` portal. The portal is the EXHAUSTIVE API surface (every public symbol of every kind, filterable in-place) - see the "Single-page API Reference portal" bullet below for the portal mechanics. Primary-kind organisms intentionally surface in BOTH places (sidebar Features chapter for table-of-contents, portal grid for index) - same target page, two reader intents. The Features chapter id is stable (`features-links`); group ids are `features-group-<path>`. The sidebar has no References tree, no `#references-links` id, and no `#references-group-<path>` ids - the portal owns the exhaustive surface. The global Miscellaneous chapter is suppressed under `menuLayout: 'feature'` (every misc symbol surfaces on the portal). `menuLayout: 'type'` is unchanged.
- **`featuresName` config option.** Override the **Features** chapter heading without touching i18n. Config-only string, default empty (falls back to the translated `features` i18n key). The sibling `referencesName` is parsed and exposed on `data.referencesName` for `menu.js` / `api-reference.js` custom-template overrides, but the built-in sidebar and portal read the localised `reference` / `api-reference` keys directly and do not consume it.
- **`@docsKind primary` JSDoc tag for per-symbol promotion.** A reference-kind symbol (function, interface, typealias, variable, enumeration) marked with `@docsKind primary` is promoted into the **Features** chapter regardless of its TypeScript kind. Use for bootstrap providers, feature-config helpers, state factories, and other consumer entry points that deserve the curated-highlights treatment. The tag controls Features inclusion only - the References portal is exhaustive and always lists every public symbol. Tag values other than `primary` (typos, the inverse override) fall back to default placement silently. No effect under `menuLayout: 'type'`.
- **`cdx-chip[href]` link affordance.** Chip-style cross-reference links now communicate that they navigate: pointer cursor, underline on hover, focus ring on keyboard focus. Static chips (no `href` - kind badges, status pills) keep their flat appearance.
- **"Referenced by" backlinks on References pages.** Interfaces, typealiases, enumerations, variables, and functions now show a chip-list at the top of the Info tab listing every primary-kind entity (components, directives, pipes, injectables, classes, guards, interceptors, entities) that references the type in its public surface (extends / implements / member types / method return types / constructor args / host directives). Self-references skipped; the section is omitted when the reverse-index has zero entries. Overridable as `referenced-by` via `--templates`.
- **Rich Pagefind search metadata on entity pages.** Every generated entity hero now emits hidden `<span data-pagefind-meta="kind:Component">`, `<span data-pagefind-meta="category:ui/feedback/toast">`, and `<span data-pagefind-meta="description">first-sentence excerpt…</span>` fragments so search results can distinguish a Component from a Function from an Interface, surface the bucket category, and show a first-sentence excerpt. The literal `key:value` form is required - the per-suffix attribute variant (`data-pagefind-meta-kind="…"`) is not discovered by Pagefind 1.x's static scan and is intentionally not emitted. Empty descriptions are omitted entirely to keep the index small. The command-palette result UI now reads `meta.kind` directly (preferred) and falls back to title-parsing for legacy builds, then renders the category and excerpt under the entity name. Non-entity pages (README, CHANGELOG, Coverage) keep the existing "Docs" fallback label. New helper exports under `src/templates/helpers/pagefind-meta.ts` (re-exported from `helpers/index.ts`): `KIND_LABELS`, `KIND_LETTER`, `firstSentence(html)`, `pagefindMetaBlock(input)`, `pagefindFilterBlock(input)`, `deriveLibFromBucket(bucket)`.
- **Bucket landing pages under `menuLayout: 'feature'`.** Every `@category` bucket - leaf paths (`ui/feedback/toast`) and intermediate folders (`ui`, `ui/feedback`) alike - now generates an auto-built landing page at `categories/<bucket-id>.html`. Pages group their members by kind (Organisms vs. References) into a responsive card grid with first-sentence descriptions. Intermediate buckets aggregate items from every descendant leaf so a reader exploring "ui/feedback" sees the full surface without drilling further. The sidebar bucket row is now a **two-hit-zone**: clicking the label navigates to the landing page; clicking the chevron toggles expand. Pages emit only under `menuLayout: 'feature'`; `menuLayout: 'type'` is unaffected. Overridable as `bucket-landing` via `--templates`.
- **Inline filter strip on bucket landing pages.** When a bucket landing has at least 15 cards (configurable threshold), an inline filter strip renders between the hero and the content: a full-width search input that substring-matches `name + first-sentence excerpt`, kind-toggle chips (saturated `cdx-badge--entity-<kind>` badges that double as a one-to-one colour key for the card grid below), and a Reset pill that auto-disables when no filter is active. Per-kind section count badges update live; sections with zero matching cards hide. Pure DOM (no Pagefind) and idempotent across SPA navigations via a `WeakSet` guard.
- **`@wcag <level>` and `@a11y <text>` JSDoc tags.** Surface accessibility-conformance claims at the entity level. `@wcag` accepts `A`, `AA`, or `AAA` (case-insensitive) and renders a colored chip in the entity hero - neutral grey for `A`, green for `AA` (the cngx default target), blue for `AAA`. `@a11y` accepts free-form markdown text, parsed and stored on `IDep.a11yNote` for the LLM-md export and future reverse-lookups but intentionally not rendered as a page section - the hero WCAG chip is the single user-visible conformance signal so the description tab stays focused. Both tags propagate via the standard JSDoc extractor pipeline (`IDep.wcagLevel`, `IDep.a11yNote`); invalid `@wcag` values log a build-time warning and fall back to no chip. The level also surfaces as a `data-pagefind-filter="wcag:<level>"` span so the search-palette facet rail can narrow to "WCAG AA and up".
- **Pagefind facet filters in the command palette.** Search dropdown now renders chip rows above the result list for **Kind** (Component / Directive / Pipe / ...), **Library** (top segment of the bucket id - `ui`, `common`, `forms`, ...), **Tier** (Primary vs. Reference - promoted symbols vs. exhaustive surface), and **WCAG** (A / AA / AAA). Multi-select within each dimension, AND across dimensions. Active filters persist to the URL as `?q=toast&kind=Component,Directive&tier=primary` so a copy-pasted search is reproducible. Dimensions with zero or one distinct value hide automatically. Facet counts come from Pagefind's `filters` API; zero-count rows for active selections stay visible so users can unselect from an empty intersection. A reset button clears all filters in one click. Every entity hero now emits a hidden `<span data-pagefind-filter="<dim>:<value>">` per dimension (`kind`, `lib`, `bucket`, `tier`, `wcag`); module pages emit `kind:Module`, bucket landings emit `kind:Bucket`.

- **First-class `token` kind for InjectionToken / HttpContextToken declarations.** `export const X = new InjectionToken<T>(...)` and `new HttpContextToken<T>(...)` are no longer lumped in with `@Injectable()` service classes. They land in a new `token` collection and emit at `tokens/<name>.html` with a dedicated lean page (`TokenPage`, override name `token`) — just hero + Referenced-by + description + type signature + providedIn. No methods, no inputs/outputs, no API tab. The References-portal chip rail and command-palette facets show `Token` as a sibling of `Injectable`; the `Injectable` count now reflects only real services. The portal letter-pill is `Tk` over a slate-blue tint. Reverse-index backlinks include token names so a service that depends on a token surfaces under its detail page. `EntityKind` gains `'token'`, `PRIMARY_KINDS` includes it (tokens appear in the Features chapter), `KIND_HREF_PREFIX.token = 'tokens'`. **Breaking:** existing URLs at `injectables/<TOKEN_NAME>.html` are gone — see MIGRATION.md.
- **Single-page API Reference portal at `references.html`.** Under `menuLayout: 'feature'`, the exhaustive symbol catalogue moved off the sidebar tree onto a single searchable page with kind / stability / bucket / text filters and URL state persistence. Replaces the old per-bucket References chapter; the sidebar now surfaces a top-level "Reference" link to the portal. Features chapter remains the curated organisms surface. Container queries drive column count by content width.
- **Sticky bucket headings on the API Reference portal.** Each `<section>`'s heading now pins to the top of the viewport while any of its items are still in view; once the next section starts, its heading takes over the sticky slot. CSS-only - no JS, no IntersectionObserver. `--cdx-app-header-height` is the override hook for sites that mount the portal behind a fixed top header.
- **`@selector <css-selector>` JSDoc tag.** Surfaces the public selector contract in the entity hero of components, directives, and tokens as a dedicated chip (`cdx-entity-hero-selector`). Stored on `IDep.taggedSelector` (distinct from the existing decorator `selector` field — the tag is documentation-only, never overwrites the runtime decorator value). Multi-selector strings (`button[cngxToggle], [cngxToggle]`) render verbatim as a single chip.
- **`@relatedTo <Symbol>[, <Symbol>...]` JSDoc tag.** Renders a Related section directly under the entity description as a chip-list of cross-links to sibling symbols. Resolved via `DependenciesEngine.findInCompodoc()` plus a tokens-array fallback (tokens are not yet included in the merged-data search). Unresolved targets emit a build-time warning AND render as a dashed grey pill so docs authors can spot typos at a glance. Stored on `IDep.relatedTo: string[]`. Overridable as `related` via `--templates`. The Related section is wired into ComponentPage, EntityPage (covers Directive / Class / Interface / Injectable / Guard / Interceptor / Entity / Pipe), and TokenPage.
- **`@github <url>` URL validation.** The tag now validates that the URL starts with `https://github.com/`. Invalid values (HTTP, non-GitHub hosts, malformed) emit a build warning and the field is dropped. Previously any string was accepted verbatim and rendered as a broken link in the entity hero.
- **`@docsKind primary` first-wins detection.** Multiple `@docsKind primary` tags on the same symbol now emit a single first-wins warning instead of silently retaining the last value. Detection uses a pass-local counter so the dual-extractor surface (`jsdoc-tags.ts` + `class-helper/jsdoc-extractor.ts`) does not false-fire on pass 2.
- **`warnOnce(result, kind, msg)` helper.** New `src/utils/jsdoc-tag-warn.ts` provides per-`(result, kind)` warn dedup via a WeakMap. Used by the dual-extractor paths for `@wcag`, `@github`, and `@docsKind` warnings so an invalid value on a single source occurrence does not surface twice in the build log.
- **`token` collection in the JSON export.** `documentation.json` now includes `tokens?: ExportInjectable[]` at the top level. Previously the parsed token deps existed in memory (and were emitted as HTML pages) but the JSON export silently dropped them, breaking downstream tools that walked the snapshot to find DI keys.
- **WCAG sub-badge on bucket-landing cards + WCAG filter chips.** Cards inside a `categories/<bucket-id>.html` page now render a small WCAG chip below the entity name when the symbol carries a `@wcag` tag. The filter strip gains a second chip row dedicated to WCAG levels — one chip per distinct `(level, count)` present in the bucket. The row is suppressed when no item in the bucket carries a WCAG level (no "WCAG (0)" ghost row). The client filter AND-combines kind ∧ text ∧ wcag predicates; Reset clears all three at once.
- **Primary badge in entity heroes.** Symbols with `@docsKind primary` (and primary-kind organisms whose docsKind was promoted to `'primary'` by the compiler) now render a star + "Primary" chip (`cdx-badge--primary`) in the entity hero between the type badge and the WCAG / Since chips. Tooltip from new i18n key `docskind-primary-title`, backfilled across all 17 locales. Token uses the shared `--cdx-badge-base` pattern with an amber default fallback so themes can override per the existing badge-color convention.

### Changed

- **`EXPORT_SCHEMA_VERSION` bumped 1 → 2.** Non-breaking additive change for the `documentation.json` shape: the new top-level `tokens?: ExportInjectable[]` field plus optional per-entity fields `docsKind?: 'primary'`, `wcagLevel?: 'A' | 'AA' | 'AAA'`, `a11yNote?: string`, `taggedSelector?: string`, `relatedTo?: string[]` on directives / components / interfaces / classes / tokens. Old v1 readers ignore unknown fields and keep working; downstream tools that want to react to the new surface should gate on `schemaVersion >= 2`. The `compodocx diff` CLI gates strictly on `schemaVersion === EXPORT_SCHEMA_VERSION`, so cross-version diffs (v1 snapshot vs. v2 snapshot) need both snapshots re-exported with v0.6.0+. See MIGRATION.md.

### Fixed

- **Empty feature-buckets no longer render as leftover labels.** When a bucket has zero matching items for the active chapter (all its symbols landed in the other chapter), it is pruned from the dict before tree construction. Leaf-level pruning is sufficient because empty buckets never enter the dict - the tree builder cannot synthesise empty intermediate nodes.
- **All 7 bundled themes now define the new v0.6.0 badge tokens.** `--color-cdx-entity-token`, `--color-cdx-badge-ai-generated`, and `--color-cdx-badge-wcag-a` / `-aa` / `-aaa` are declared in both `:root` and `.dark` blocks of `brutalist`, `ember`, `midnight`, `neon`, `nord`, `ocean`, and `rose-pine`, with palette-matched values per theme. Without these, the `cdx-badge--entity-token` badge in `badges.css` (which references the token without an inline fallback) rendered slate-700 on dark backgrounds and was effectively invisible on dark themes. The boilerplate `theme-template.css` gains the same five tokens as commented placeholders so custom themes see the full surface.
- **Long symbol names truncate correctly in the API Reference grid.** The `.cdx-ref-item-list` `@container` overrides at 700px (3 cols) and 1000px (4 cols) now use `repeat(N, minmax(0, 1fr))` instead of bare `1fr`. Bare `1fr` resolves to `minmax(auto, 1fr)`, which lets a track grow to fit its longest intrinsic-sized child - at which point the existing `text-overflow: ellipsis` on `.cdx-ref-item-name` never fires because the column expanded to accommodate the full name (and the other columns collapsed to ~100px each).

### Internal

- **i18n keys.** `accessibility-notes`, `categories`, `category`, `wcag-level`, `reference`, `api-reference`, and the v0.5.0 / v0.6.0 keys that had only landed in en-US + de-DE (`ai-generated`, `ai-generated-tooltip`, `api`, `application-configuration`, `binding`, `definition`, `event`, `expression`, `handler`, `members`, `references`, `referenced-by`) are now translated across all 17 supported locales (bg-BG, de-DE, en-US, es-ES, fr-FR, hu-HU, it-IT, ja-JP, ka-GE, ko-KR, nl-NL, pl-PL, pt-BR, ru-RU, sk-SK, zh-CN, zh-TW). Set `featuresName` to override the Features chapter heading without touching translations; `referencesName` is exposed on `data.referencesName` for custom template overrides only.
- **New override-context names.** `referenced-by`, `bucket-landing`, `api-reference`, and `token` join the override lists (`src/migrate/override-names.ts`); the parity drift spec re-derives them from disk.

## [0.5.0] - 2026-05-27

First-class detail pages for `@category`-tagged miscellaneous symbols under `menuLayout: 'feature'`, with a cluster of related UX polish.

### Added

- **First-class detail pages for `@category`-tagged miscellaneous symbols.** Functions, variables, type aliases, and enumerations carrying a non-empty `@category` JSDoc tag now generate a dedicated page at `miscellaneous/<plural>/<name>.html` with an Info / API / Examples tab structure. Untagged entries continue to render as inline anchors on the shared collection page - `@category` is the single opt-in signal that promotes a miscellaneous symbol to first-class API status. Collection pages gain a chip-list of "Open detail page" links above each grouped section for tagged entries; the row anchors remain so cross-page type links keep resolving. Four new override-context names ship for `--templates` consumers: `miscellaneous-function`, `miscellaneous-variable`, `miscellaneous-typealias`, `miscellaneous-enumeration`.
- **Hero breadcrumb mirrors the sidebar bucket path in `menuLayout: 'feature'`.** The breadcrumb on entity pages now tracks the same path the sidebar uses to bucket the entity - explicit `@category` split on `/` when set, the folder-fallback path from `deriveGroupKey` otherwise. The entity-kind chip under the H1 still carries the kind, so nothing is lost when the breadcrumb form switches. Category and folder segments render verbatim from the user's input; `menuLayout: 'type'` is unchanged and continues to render the kind label.
- **Multi-column index on miscellaneous collection pages.** The flat alphabetical index on `miscellaneous/<plural>.html` flows into multiple columns based on available width (`column-width: 220px` - browser fits 1 column on narrow viewports, 4+ on wide). The filter input + no-results UI are column-aware via re-flow. API-tab Index on entity pages is unaffected - it keeps the 3-grid built for Inputs / Outputs / Methods.

### Fixed

- **Hash anchors on tab-less pages no longer silently land at scrollTop=0.** `resolveHash` previously returned `null` for elements outside any `.cdx-tab-panel`, so the SPA router's hash branch (`router.ts`) had no target to act on. Sidebar links to `miscellaneous/<plural>.html#<name>` and any other anchor on a tab-less layout landed the URL correctly but the viewport stayed at the top. A new `'scroll'` `HashTarget` kind covers bare anchor targets, so any page without a tab structure now scrolls correctly on both initial load and SPA navigation. Adds a unit-test regression and a Playwright assertion against `miscellaneous/functions.html#<name>`.
- **Type aliases and enumerations rendered as cards while the rest of the API-block family rendered as flat rows.** `BlockTypealias` and `BlockEnum` were the last two API blocks routing through `MemberCard`. The visual inconsistency was obvious on the miscellaneous collection pages where type aliases shipped as cards while functions and variables on the same page shipped as flat rows. Both blocks now use the flat `cdx-io-member` pattern with two new kind discriminators (`cdx-io-member--typealias`, `cdx-io-member--enumeration`) wired into the existing entity-kind palette. Enum members render as a compact `<ul>` of `name = value` pairs.
- **`BlockMethod` / `BlockProperty` rendered an empty `<h3>` with a stray `#` permalink when `title: ''` was passed.** The old `props.title ?? t('methods')` treated the empty string as a real value, so the heading rendered with no text and a dangling permalink anchor - visible on every grouped section of `miscellaneous/functions.html`, `variables.html`, and friends where the collection-page template provides its own outer heading. The caller contract is now three-way: omit `title` for the default heading, pass a string for a custom one, pass `''` to suppress the heading entirely.
- **Sidebar truncation for long entity names.** Names like `CNGX_SELECTION_CONTROLLER_FACTORY` overflowed the sidebar's right edge because the existing `text-overflow: ellipsis` couldn't fire - the flex link container had no max-width constraint and the bare text node had no min-width override. Wraps every entity name in `<span class="cdx-menu-item-name">` and applies the `max-width: 100% / min-width: 0 / box-sizing: border-box` constraint triad. Trailing badges (D / S / T / B) and the feature-layout kind icon stay fully visible.
- **Copy button on code blocks scrolled with horizontal overflow.** The button was injected as a child of `<pre>`, which is the horizontally-scrolling container; `position: absolute; right: 8px` anchored to the actual content-right edge, dragging the button off-screen as the user scrolled right inside a long line. The button is now a sibling of `<pre>` inside a positioned wrapper that sits outside the scrolling subtree (`.cdx-code-snippet` is reused when present, otherwise a thin `.cdx-code-copy-wrap` is inserted).
- **Category and folder-fallback breadcrumb segments render title-cased via CSS.** Bucket identity stays lowercase in URLs and sidebar IDs (lowercase is what merges tagged + folder-fallback entries into the same sidebar bucket); display-only title-casing happens with `.cdx-breadcrumb li:not(:last-child) { text-transform: capitalize }` so the trailing entity-name segment stays verbatim. Acronyms (`ui`, `api`, `dom`) currently render as `Ui`/`Api`/`Dom`; a smart-acronym pass is intentionally out of scope.
- **Inline `<code>` pill backgrounds unified across the member-card system.** `.cdx-io-member-desc code` used a neutral `bg-alt` box that contrasted with the `color-mix(in srgb, var(--color-cdx-code-inline) 6%, transparent)` tint pattern `.cdx-param-type` and `.cdx-member-returns code` already used. The pill is now the same color-mix tint family everywhere.

### Internal

- **i18n keys.** `open-detail-page` added across all 17 locales. `definition`, `members`, and `api` added in en-US + de-DE; the other 15 locales fall back to the literal key per the existing `I18nEngine.exists(key) ? translate : key` semantics.

## [0.4.9] - 2026-05-26

Feature-grouping fix for interfaces and miscellaneous entities under `menuLayout: 'feature'`.

### Fixed

- **`@category` JSDoc on interfaces and miscellaneous entities was silently dropped from the feature-grouped sidebar.** Two bugs hid the tag from `DependenciesEngine.prepareFeatureGroups()`. First, the orchestrator built every `IInterfaceDep` from the `ioExtractor` result but forgot to copy `IO.category` onto it - so even interfaces whose JSDoc was parsed correctly fell back to folder-based grouping regardless of their explicit tag. Second, the cross-kind walk iterated nine entity kinds (components / directives / injectables / pipes / classes / interfaces / guards / interceptors / entities) and never visited the four miscellaneous sub-collections - functions, variables (incl. `InjectionToken`s), typealiases, enumerations - so items in those collections could not enter the feature groups even when they carried an explicit `@category`. Adds the missing field copy to the interface construction site and extends the kinds list with the four miscellaneous sub-collections (`hrefPrefix` `miscellaneous/<sub>`). The `EntityKind` union grows to `component | directive | injectable | pipe | class | interface | guard | interceptor | entity | function | variable | typealias | enumeration` so the `EntityWithKind` shape stays typed. After the fix, `@category` works for every documented symbol kind under `menuLayout: 'feature'`.

## [0.4.8] - 2026-05-18

Theming-tab regression fix for Angular 21's singular `styleUrl`.

### Fixed

- **Theming tab silently dropped for components on Angular 21's singular `styleUrl: './foo.css'` form.** `collectStyleSources` only inspected the plural `styleUrls`, so any component authored with the singular field - which Angular 21 made the default for new components, and which Stencil has always used - produced empty `themeTokens` even when its stylesheet carried fully annotated `@property` blocks. `getComponentStyleUrls` now folds the singular value into the array at the helper boundary, so the theming parser, `handleStyleurls`, nav-tabs gating, and hero metadata all receive one canonical list regardless of authoring style. Duplicate URLs are de-duped so a component declaring both forms (rare but legal) does not double-load. Closes #85.

## [0.4.7] - 2026-05-15

`@aiGenerated` content marker, iframe-content auto-sizing with theme sync on the Examples tab, a fix for the sticky source-viewer header, plus the bulk of the Phase 6 internal refactor.

### Added

- **`@aiGenerated` JSDoc tag for entities and `<!-- @aiGenerated [value] -->` marker for markdown.** A single mechanism for flagging AI-assisted content across the documentation surface. On any class-level JSDoc (component, directive, class, interface, pipe, injectable, guard, interceptor, module, standalone function), `@aiGenerated` renders a purple "AI generated" chip in the entity hero next to the Beta / Since / Breaking row. The same value-aware syntax works as an HTML-comment marker at the top of any markdown source - additional pages (`--includes` + `summary.json`) and the five root markdowns (README, CHANGELOG, CONTRIBUTING, LICENSE, TODO) - and renders as a full-width banner above the page body. Optional inline value (model name, date, …) surfaces in the badge tooltip. Locales: English and German labels ship; other locales fall back to English. CSS tokens: `--color-cdx-badge-ai-generated` for chip chrome (purple `hsl(290 55% 48%)`), `cdx-ai-generated-banner` for the markdown banner block. Not yet wired through the neighbour-`*.md` README tab on entity pages - that's a follow-up.

- **Example-tab iframes auto-resize to their content height and stack with proper spacing.** `iframe.cdx-example-container` now reports its inner `body.scrollHeight` via a same-origin `ResizeObserver` + `load` handler, so each example shrinks or grows to fit its content - no more 400px min-height clip that masked short demos and forced internal scrollbars on tall ones. Sibling iframes get a `--spacing-cdx-lg` margin so they no longer butt up against each other, `box-sizing: content-box` removes the 1px-border-eats-the-viewport issue that produced phantom scrollbars, and the `.dark` class on the parent document propagates into same-origin iframe contents (with a `postMessage({ type: 'cdx-iframe-theme', dark })` fallback for opt-in cross-origin examples) so demo HTML can theme itself via `html.dark { ... }`. Cross-origin examples keep the CSS `min-height: 120px` fallback. New client module: `src/client/examples.ts`.

- **Dev-watch fixture conventions: `assets/` and `additional-doc/` folders auto-pass to the CLI.** `npm run dev` now appends `-a test/fixtures/<fixture>/assets` and `--includes ./test/fixtures/<fixture>/additional-doc` automatically when the matching directory exists under the active fixture. Any fixture can opt in to assets-copy or summary-driven additional pages just by creating the folder - no manual flag, no per-fixture config tweaks.

### Fixed

- **Sticky source-viewer header sat 33px above the scroll viewport, leaving only a 10-18px sliver visible while reading code.** Switched `.cdx-source-viewer-header` from `top: -33px` to `top: -0.5rem` so the file-path bar negates `.content`'s 8px top padding and pins flush at viewport `y: 0`. Sticky scope-context stack (`.cdx-source-viewer-sticky-stack`) moves from `top: 10px` to `top: calc(var(--cdx-source-header-h, 43px) - 0.5rem)` so scope lines tuck right under the header rather than overlapping it. Sentinel + `is-stuck` class detection unchanged.

### Internal

- **`src/lib/` foundation layer for the Phase 6 refactor.** Adds `Result<T, E>` (`ok`/`err`/`isOk`/`isErr`/`mapResult`), `pipe` + `pipeAsync` (9-arg overloads), `tap` + `tapAsync` (rejection-propagating), and three predicates (`isNonNull`, `isUnique`, `hasProp`). Zero runtime dependencies, additive only - no production code change. Module barrel at `src/lib/index.ts`; specs at `test/src/lib/` (34 cases). `test:unit` script now also covers `test/src/lib`.
- **Adopt `src/lib/Result` in `src/diff` and validation utils.** `src/diff/parse.ts` and `src/diff/types.ts` no longer define a local `ParseResult` - both now use the shared `Result<T>` and the `ok` / `err` / `isErr` constructors. The same refactor lands in `src/utils/json-indent.util.ts` and `src/utils/max-versions-shown.util.ts`: the local `JsonIndentResult` / `MaxVersionsShownResult` aliases are gone; both helpers return `Result<number>`. Net −53 lines of boilerplate, callsites unchanged, behaviour identical, 870 unit + 657 CLI tests stay green. `src/llm-md` and `src/migrate` were audited for adoption candidates and left untouched - both modules are already idiomatically functional without any duplicate Result-shaped types. The `schematics/ng-add/` build uses its own `tsconfig.json` with a separate `rootDir`, so adopting `src/lib` there is deferred to a later build-topology change.
- **Extract serve / coverage / dependencies into `src/app/services/`.** Three pure-function modules carve self-contained concerns out of `Application`: `serve.ts` exports `startWebServer(folder, cfg, onListening?)` (polka + sirv + cross-platform browser spawn); `dependencies.ts` exports `crawlDependencies` and `crawlMicroDependencies` wrapping the `AngularDependencies` crawler; `coverage.ts` exports `computeDocumentationCoverage(deps)` and `computeUnitTestCoverage(summary, coverageFiles?)`. Each function takes an explicit config parameter rather than reaching into `Configuration.mainData`, so they unit-test in isolation. The previous method bodies - `runWebServer`, `prepareCoverage`, `prepareUnitTestCoverage`, the crawler instantiation inside `getDependenciesData` / `getMicroDependenciesData` - are gone; `application.ts` keeps only the orchestration (page registration, badge generation, watch-trigger, CI-fail threshold dispatch) and shrinks by ~390 lines net. 26 new Vitest specs cover the extracted logic. Public API and generated HTML are unchanged.
- **Split `src/index-cli.ts` into `src/app/cli/{flags,banner,config-loader}.ts`.** Three pure-function modules carry the option-definition chain, the banner block, and the cosmiconfig load + 620-line config-merge cascade out of `CliApplication.start()`. `flags.ts` exports `defineFlags(program)` - every `.option(...)` call in source order, returning the program for chaining without invoking `parse`. `banner.ts` exports `printBanner(ctx, opts, log?)` with a logger injection point and a two-candidate `resolveBannerPath()` mirroring `src/migrate/printer.ts` so the `src/banner` asset resolves from both the dev source tree and the published tarball. `config-loader.ts` exports `loadConfigFile(opts): Result<{ config, explorerResult }, string>` as the cosmiconfig boundary and `applyConfigToMainData(mainData, configFile, program, sources): void` as a verbatim relocation of the if-cascade - `Configuration.mainData.X` becomes `mainData.X`, `process.cwd()` becomes `sources.cwd`, and `program.getOptionValueSource('X') === 'cli'` stays intact. `index-cli.ts` shrinks from 1344 → 438 LOC. 36 new Vitest specs cover the extracted modules. Public CLI surface (flags, defaults, `--help` output) is byte-identical to develop; smoke and golden HTML output are unchanged.
- **Eliminate parallel-fork port contention in CLI integration tests.** Vitest's default file-parallel fork pool ran `cli-serving.spec.ts`, `cli.spec.ts`, and `cli-generation.spec.ts` concurrently - all three spawned `./bin/index-cli.js -s` against port 8080 and lifecycled `./documentation/` at the repo root, producing intermittent EADDRINUSE failures and folder-state races. `cli-serving.spec.ts` now assigns a distinct port per describe block (6700–6704); the "just serving without generation" test in `cli.spec.ts` and the "when generation without d flag" test in `cli-generation.spec.ts` spawn the child in a fresh `os.tmpdir()` cwd so the default-folder paths never collide. macOS quirks handled: `fs.realpathSync` the tmpdir before computing `path.relative(cwd, bin/tsconfig)` so the relative chain matches the spawned child's real-path `process.cwd()`. Suite stays parallel; no `package.json` script changes.
- **Split `src/app/compiler/angular-dependencies.ts` and `src/utils/router-parser.util.ts` into concern-scoped helper folders.** Two god-files in one PR. `angular-dependencies.ts` (2146 LOC, `AngularDependencies extends FrameworkDependencies`, ~40 methods) becomes an orchestrator at `src/app/compiler/angular-dependencies/index.ts` plus seven collaborators: `metadata-predicates.ts` (the decorator-shape predicates `isEntity` / `isComponent` / `isPipe` / `isDirective` / `isInjectable` / `isModule` / `isGuard` / `hasInternalDecorator` plus `parseDecorator(s)`), `jsdoc-tags.ts` (the verbatim `checkForDeprecation` + `extractCustomTags` pair driving `@deprecated` / `@category` / `@slot` / `@signal` / `@zoneless` / `@beta` / `@group` / `@order` / `@since` / `@breaking` / `@route` / `@storybook` / `@figma` / `@stackblitz` / `@github` / `@docs` dispatch), `public-api-filter.ts` (the `--publicApiOnly` allow-set state and `isSymbolAllowed`), `expression-finder.ts` (the `findExpressionByName*` / `getSymboleName` / `findProperties` traversal helpers), `provider-detector.ts` (ApplicationConfig `extractProviderCalls` + `isInjectionToken` / `getInjectionTokenType` / `getInjectionTokenProvidedIn` + the `detectFunctionalAngularKind` / `detectFactoryKind` naming heuristics), `io-extractor.ts` (`getClassIO` / `getInterfaceIO` / `getRouteIO` / `visitEnumDeclarationForRoutes` / `isExportedVariable`), and `entity-visitor.ts` (~280 LOC - `visitTypeDeclaration` / `visitArgument` / `mapType` / `hasPrivateJSDocTag` / `visitFunctionDeclaration` / `visitVariableDeclaration` / `visitEnumTypeAliasFunctionDeclarationDescription` / `visitEnumDeclaration`). `router-parser.util.ts` (1110 LOC, `RouterParserUtil` singleton, ~25 public methods) becomes a ~140-LOC orchestrator at `src/utils/router-parser/index.ts` plus five collaborators: `route-store.ts` (the routes / incompleteRoutes / modules / modulesWithRoutes / scannedFiles / rootModule / modulesTree / cleanModulesTree state and every state-mutating or state-reading method, plus `foundLazy*` and `isVariableRoutes`), `raw-route-cleaner.ts` (the four Angular-8-import regex constants, `trailingComma`, `cleanRawRoute` + `cleanRawRouteParsed`), `module-linker.ts` (`hasRouterModuleInImports` / `fixIncompleteRoutes` / `linkModulesAndRoutes`), `routes-tree-builder.ts` (~400 LOC - `constructRoutesTree` / `constructModulesTree` / `generateRoutesIndex`), and `source-file-cleaner.ts` (~370 LOC - the five `cleanFile*` methods plus `cleanRoutesDefinitionWithImport`; the module-level `const ast = new Project()` now lives as a private constructor field, scoped per instance). The singleton wrapper (`private static instance`, `private constructor`, `static getInstance()`) stays on the orchestrator only; internal helpers are plain classes the orchestrator composes. Both original paths reduce to one-line re-export shims, so every consumer import site keeps working byte-for-byte. Verbatim relocation - body edits limited to field-prefix swaps (`this.X` → `this.Y.X`). Public API surface unchanged; generated HTML byte-identical. Smoke specs at `test/src/app/compiler/angular-dependencies.spec.ts` and `test/src/utils/router-parser.spec.ts` cover the orchestrator wiring and shim re-export contract (13 specs total).
- **Split per-entity page generation out of `application.ts` into `src/app/page-generator/`.** The page-data-preparation and write-loop methods on `Application` move into 18 concern modules under a new folder: one generator class per entity kind (`PipePageGenerator`, `ClassPageGenerator`, `InterfacePageGenerator`, `EntityPageGenerator`, `DirectivePageGenerator`, `InjectablePageGenerator`, `InterceptorPageGenerator`, `GuardPageGenerator`, `ComponentPageGenerator` - which carries `handleTemplateurl` / `handleStyles` / `handleStyleurls` as private methods - and `ModulePageGenerator`), plus seven non-entity page generators (`MiscellaneousPageGenerator`, `AppConfigPageGenerator`, `RoutesPageGenerator`, `OverviewPageGenerator`, `AdditionalPageGenerator`, `PackageDependenciesPageGenerator`, `PlaygroundFileResolver`), the coverage helper (`CoveragePageGenerator` with `prepareDocumentation` + `prepareUnitTest`), and the write-loop trio (`PageWriter` owns `processPage` / `processPages` and the dependency-graph + entity-index builders; `AssetCopier` owns `processAssetsFolder` / `processResources` and takes `onServe` / `onDone` / `getElapsedTime` callbacks so the orchestrator keeps lifecycle control; `GraphGenerator` owns `processGraphs`). A new `NavTabsResolver` extracts the legacy `getNavTabs` body and is constructor-injected into every per-entity generator. The `Application` class stays at `src/app/application.ts` with its public surface (constructor, `generate`, `setFiles`, `setUpdatedFiles`, `hasWatchedFilesTSFiles`, `hasWatchedFilesRootMarkdownFiles`, `clearUpdatedFiles`, `serveAndStartWatch`, `runWatch`, getters) byte-identical to develop; the file shrinks from 2732 → ~890 LOC. To break a circular import between the new coverage helper and the orchestrator, the `generationPromise` / `generationPromiseResolve` / `generationPromiseReject` module globals lift into a tiny `src/app/generation-promise.ts` carrier consumed by both. The app-config page (formerly the top branch of `prepareMiscellaneous`) is now its own generator pushed into both action queues before the miscellaneous push - CLI banner emits one additional `Prepare app-config` log line; generated HTML byte-identical. Both action queues (`prepareJustAFewThings` and `prepareEverything`) and the watch-mode rebuild paths dispatch through the new generators verbatim. Smoke spec at `test/src/app/page-generator.spec.ts` covers barrel exports and happy-path data-prep for each generator (9 cases). Public CLI surface, generated HTML, and Playwright e2e all green on sample-files / todomvc / standalone / standalone-feature / multi-version fixtures.
- **Split `src/app/compiler/angular/deps/helpers/class-helper.ts` into concern-scoped helpers.** The 1801-line god-class is replaced by an orchestrator plus four collaborators under `src/app/compiler/angular/deps/helpers/class-helper/`: `type-renderer.ts` (TypeScript AST → printable type strings - `visitType`, `visitTypeIndex`, `visitTypeName`), `jsdoc-extractor.ts` (the five JSDoc methods, including the verbatim `@slot` / `@playground` / `@deprecated` / `@category` / custom-tag dispatch), `decorator-inspector.ts` (the eleven decorator and visibility predicates - `isPrivate`, `isProtected`, `isPublic`, `isInternal`, `isHiddenMember`, `getDecoratorOfType`, `hasDecoratorType`, `isDirectiveDecorator`, `isServiceDecorator`, `isPipeDecorator`, `isModuleDecorator`), and `member-visitor.ts` (the eleven member visitors plus the inline utilities they consume - `visitMembers` / `visitProperty` / `visitMethodDeclaration` / `visitInputAndHostBinding` / `visitOutput` / `visitHostListener` / `visitConstructorDeclaration` / `visitConstructorProperties` / `visitArgument` / `addAccessor` / `visitCallDeclaration` / `visitIndexDeclaration`, plus `detectSignalKind`, `formatDecorators`, `stringifyArguments` and friends). The orchestrator at `class-helper/index.ts` keeps `visitClassDeclaration`, the public `stringifyDefaultValue`, and thin `visitType` / `visitTypeIndex` proxies onto the TypeRenderer. The file at the original `helpers/class-helper.ts` path becomes a one-line re-export shim so every external import site (`angular-dependencies.ts`, `component-helper.ts`, `framework-dependencies.ts`) keeps working byte-for-byte. Verbatim relocation - body edits limited to field-prefix swaps (`this.X` → `this.Y.X`). Public API surface unchanged; generated HTML byte-identical. The existing `test/src/app/compiler/angular/deps/helpers/class-helper.spec.ts` and `class-helper-signal-deps.spec.ts` were updated to access the composed helpers via the orchestrator (`memberVisitor.visitProperty`, `decoratorInspector.isPrivate`, etc.).

## [0.4.6] - 2026-05-13

Configurable sidebar layout. Two new config-only options, both default off, both fully backwards compatible.

### Added

- **`menuLayout: "feature"` config option for cross-kind sidebar grouping.** Setting `menuLayout: "feature"` in `.compodocxrc.json` (or any cosmiconfig-discovered config form) flips the sidebar from the default per-kind chapters (Components / Directives / Injectables / Pipes / Classes / Interfaces / Guards / Interceptors / Entities) into a single **Features** chapter that mixes every kind together by folder. A `button/` folder containing `ButtonComponent`, `RippleDirective`, and `ButtonService` now appears as one expandable group with all three side-by-side, each link tagged with its kind icon. `@category` JSDoc tags still override the folder-derived key. Modules, Routes, Miscellaneous, and Additional Pages chapters stay at the top level in both layouts. Folder depth is controlled by the existing `groupDepth` config (default `2`). Config-only - no CLI flag - and defaults to `"type"`, so existing builds are byte-identical. `toggleMenuItems` adds one new key `features` to collapse/expand the cross-kind chapter.

- **`collapsedAll: true` config option to start every sidebar chapter AND every nested folder group collapsed on first load.** Config-only - no CLI flag. Defaults to `false` (no behavior change). Overrides both `toggleMenuItems` (which only controls top-level chapters) and the `groupDepth`-driven nested-group expansion. Useful for large codebases where the default expansion produces a wall of links on page load. Works under both `menuLayout: "type"` and `menuLayout: "feature"`.

### Internal

- **Workflow `peter-evans/repository-dispatch` bumped to `@v4`** (Node 24 runtime; v3 emits a Node 20 deprecation warning that becomes a hard failure on 2026-09-16). No behaviour change in the dispatch payload.
- **`cli-export.spec.ts` assertions rewritten against the current `--jsonIndent 0` default output** - 8 stale specs that asserted on the pre-v0.3.0 `"key": "value"` (with space after the colon) shape are now green. No production-code change.

## [0.4.5] - 2026-05-13

Directives can now ship a Playground tab.

### Added

- **`@playground` JSDoc blocks now surface on directive detail pages.** `DirectiveDepFactory` propagates `IO.playgrounds` onto the directive dep (defaulting to `[]`), the same way components have done since the Playground feature shipped. Directives that declare one or more `@playground <title>` blocks render a runnable Playground tab next to Info / API, gated by `--disablePlaygroundTab` and a non-empty block list. Components are unaffected.

### Changed

- **Playground tab logic moved into `EntityTabs`.** Previously component-only and inlined in `ComponentPage.tsx`; now lives in the shared `EntityTabs` block so component and directive pages render it from the same code path. The `playground` nav-tab definition in `COMPODOC_CONSTANTS.navTabDefinitions` adds `directive` to its `depTypes`, so `getNavTabs()` keeps the tab when a directive ships blocks.

### Internal

- **Flaky `Sidebar > desktop: expand/collapse persists to localStorage` Playwright test marked `test.fixme()` across every engine.** The webkit-only skip from v0.4.4 was insufficient - the same `localStorage.getItem` race surfaces intermittently on Chromium. Re-enable once the test waits on a deterministic sync signal (storage event, `MutationObserver`, or polled getItem) instead of `waitForTimeout(300)`. Not a regression in the persistence layer.

## [0.4.4] - 2026-05-12

Bug fix release.

### Fixed

- **`@playground` ts-mode no longer ships the documented component's source as dead weight in the StackBlitz file tree.** When a `@playground` block uses the `.ts` file-reference form (`@playground <title> ./examples/foo.component.ts`), the referenced file replaces the AppComponent and imports the documented component via a bare specifier - the package is auto-forwarded into `dependencies`, so the documented component's source already lives in `node_modules` at runtime. The dep-graph walked emit loop is now skipped when the playground entry replaces the AppComponent, removing the dead file (e.g. `src/app/mat-stepper.component.ts` for a `CngxMatStepper` playground) from the StackBlitz sidebar. Inline and HTML-mode playgrounds are unaffected - their generated AppComponent imports the documented component locally and still needs the walked source on disk.

## [0.4.3] - 2026-05-12

Maintenance release. One additional-page regression follow-up, a dev-watcher fix, and lint coverage expanded across tooling.

### Fixed

- **Additional pages rendered with nested `content-data` wrappers.** v0.4.2 added a wrapper div with `class="content-data cdx-readme"` for SPA fade-in + prose styling, but `Layout.tsx` already emits the outer `<div class="content-data">` as the page container. Two stacked `content-data` divs caused double padding and broke the additional-page layout. The inner wrapper now uses `class="cdx-readme"` only.

- **`npm run dev` failed immediately with "Initial build failed".** The dev-watcher's cold-build entry called `buildRollup()` after the tsdown migration replaced Rollup. The actual symbol in the same file is `buildLib()`; calling that restores a working dev server on `:8081` for every fixture.

### Internal

- **Biome lint scope extended to `tools/**/_.{js,mjs}`and`scripts/\*\*/_.mjs`.\*\* Existing tooling already followed the 4-space + single-quote convention; future tooling PRs that drift now fail lint instead of merging silently.

- **Removed the dead `tools/tests-angularexpo.js` runner.** Required a `test/dist/test/src/helpers.js` path that has never existed in this repo and crashed with "Cannot find module" on invocation. Backing repo list was a 2016–2018 corpus of Angular 2.x demos that no longer build against modern Angular.

## [0.4.2] - 2026-05-12

Additional-page polish.

### Fixed

- **Missing `--includes` directory now silently skipped instead of aborting.** Pointing `--includes` at a non-existent path or a directory without a `summary.json` previously logged a fatal error and exited non-zero, even though the documented contract is to skip cleanly. `prepareExternalIncludes()` now resolves with no extra pages when the directory is missing, matching the "silently skipped" behaviour for missing `summary.json` files.

- **Additional pages render inside a styled prose container.** Pages emitted via `--includes` previously inherited only the outer layout styles, so long-form markdown looked unformatted compared to the README. `AdditionalPage.tsx` now wraps the page body in `<div class="cdx-readme">` so additional pages get the same prose + SPA fade-in treatment as the README.

## [0.4.1] - 2026-05-10

UX polish.

### Added

- **Native page transitions on SPA navigation.** The client router now wraps every doc-page swap in `document.startViewTransition()` when the browser supports it (Chrome / Edge 111+, Safari 18+ - ~94% of global users). The crossfade is tuned to 220ms with a `cubic-bezier(0.22, 1, 0.36, 1)` ease-out so it matches the existing `cdx-fade-in` keyframe feel. Browsers without the API (Firefox as of 2026-05) fall back to the previous CSS keyframe path automatically. `prefers-reduced-motion: reduce` disables the transition completely on both paths.

## [0.4.0] - 2026-05-09

Runtime UX and schematics. Two headline features land together: a modern `ng add` composer that scaffolds compodocx into any Angular workspace and migrates existing compodoc artefacts in one go, and a runnable `@playground` JSDoc tag with three authoring modes that produces fresh StackBlitz projects per block - assembled at build time, lazy-loaded on click, no library publication required. The deprecated Handlebars template-playground browser UI is removed; existing template work moves to the JS override path covered by `compodocx migrate`.

### Added

- **`ng add @cngxjs/compodocx` composer.** Replaces the legacy schematics with a composer-style flow: detects existing compodoc artefacts, migrates them idempotently (`compodoc` package replaced with `@cngxjs/compodocx`, scripts renamed under a configurable `scriptPrefix`, conflicts resolved with a `-legacy` suffix, malformed `angular.json` surfaced as a Result error rather than a hard crash), creates a `tsconfig.doc.json`, and writes three new package scripts (`compodocx:build`, `compodocx:build-and-serve`, `compodocx:serve`). Multi-project workspaces require `--project <name>`; single-project workspaces auto-resolve. New flags: `--skipMigration`, `--project`, `--scriptPrefix`. Composes the `NodePackageInstallTask` so users land on a fully wired setup after a single `ng add`. Full schematic + integration test coverage with `SchematicTestRunner`.
- **`@playground <title>` JSDoc tag - runnable component demos.** Adds a dedicated Playground tab to component pages with click-to-launch StackBlitz projects assembled at build time. Three authoring modes share the same scaffold; only the AppComponent body differs:
    - **Inline** - fenced HTML or TS code block right below the title, in the JSDoc comment.
    - **HTML file** - `@playground <title> ./path/to/file.html`. The file body becomes the AppComponent template literal.
    - **TS component file** - `@playground <title> ./path/to/file.component.ts`. A real standalone `@Component` class replaces the AppComponent. `templateUrl` / `styleUrl` / `styleUrls` siblings and relative imports are walked BFS-style and packed flat under `src/app/<basename>`. An `export { OriginalName as AppComponent }` alias is appended automatically so `src/main.ts` resolves regardless of the entry class name.
- **WebContainer-templated StackBlitz projects.** Manifests use `template: 'node'` (not the legacy `'angular-cli'`). All eight Angular peers are pinned to a single major derived from your `package.json`'s `@angular/core`. `@angular/material` and `@angular/cdk` are auto-pinned when Material widget selectors or attribute directives are detected in the demo body - Roboto + Material Icons are wired in `<head>` and the prebuilt theme is added to `angular.json`'s styles list. Bare-specifier imports across the demo and walked sources are auto-forwarded with the version your `package.json` declares.
- **`playgroundDependencies` config-only key.** Inject extra packages into every StackBlitz manifest's `dependencies` with the version YOU specify. Wins over both the consumer-`package.json` auto-forward AND any auto-detected version. Use for libraries the consumer ships but doesn't `npm install` directly (peer-only CSS themes) or to pin a specific version per build.
- **`--disablePlaygroundTab` flag (default `false`).** Hides the per-component Playground tab globally even when `@playground` blocks are present. Independent of `--disableDependenciesTab`.

### Changed

- **JSON-in-script hardening.** Inline `<script type="application/json">` payloads (used by every `@playground` block to ship its manifest to the browser) now escape every `<`, `>`, `&`, U+2028, U+2029 character as `\uXXXX`. Replaces the previous naive `</` sanitiser, which intermittently produced "Unterminated string in JSON" parse failures in browsers when manifest payloads contained arbitrary angle brackets, embedded HTML/CSS, or template literals.

### Removed

- **`--templatePlayground` CLI flag and the entire Handlebars-based Template Playground browser UI** (deprecated in v0.3.0). Authors who used the playground should migrate to the JS template override path (`--templates`); the companion `compodocx migrate` sub-CLI converts existing Handlebars partials to JS overrides automatically. Removed surfaces: `src/template-playground/`, `src/resources/template-playground/`, `src/resources/template-playground-app/`, `tools/build-template-playground.js`, `scripts/start-playground{,-simple}.js`, the `templatePlayground` field on `MainDataInterface`/`ConfigurationFileInterface`, the `processTemplatePlayground()` method on `Application`, the `template-playground-server` tsdown entry point, and the `start-playground` / `playground` / `dev:playground` / `playground:simple` / `build-template-playground` / `test:playground` `package.json` scripts.

## [0.3.0] - 2026-05-08

Migration and tooling foundations. Adds three new sub-commands (`migrate`, `diff`, plus an `llm-md` export format), an end-to-end multi-version output pipeline with a runtime version-switcher dropdown, and finer JSON output control. Existing 0.2.x consumers can stay on a flat single-version layout with `--no-multiVersion`; everything else lands additively.

### Breaking

- **`--multiVersion` defaults to `true` (#58).** Output now writes to `<output>/<versionLabel>/` instead of directly to `<output>/`, and a `versions.json` manifest is emitted at the deploy root. Opt out with `--no-multiVersion` to restore the previous flat layout. The version label auto-resolves from the nearest `package.json`; pass `--versionLabel <string>` to override or to satisfy projects without a `package.json`. Missing label combined with `--multiVersion` is a hard error (exit 2) with a hint pointing at `--versionLabel ... or --no-multiVersion`. See `MIGRATION.md` for the upgrade callout.

### Added

- **`compodocx migrate` sub-command (#53).** Helps existing compodoc consumers port custom Handlebars templates and CSS to the compodocx surface. Four sub-commands: `inspect <path>` reports template-format / CSS-class / config-file drift; `template <file.hbs>` converts a single Handlebars partial to the JS override format (streams to stdout when neither `--out` nor `--dry-run` is set); `templates <hbs-dir> --out <js-dir>` batch-converts a directory; `css <file-or-dir>` rewrites legacy class names to the `cdx-` prefix (conservative by default; `--aggressive` also rewrites HTML / TS / TSX / JS files). Common flags: `--dry-run`, `--json`, `--no-warnings`. Exit codes: 0 clean, 1 yellow (lossy or partial), 2 red (hard limit). Hard limits stop conversion when the input matches a full HTML page, an unknown override name, or any other shape that cannot map cleanly.

- **`compodocx diff` sub-command (#55).** Compares two `--exportFormat json` snapshots and surfaces API changes by severity (breaking, additive, docs-only). Flags: `--old <path>`, `--new <path>`, `--json`, `--md`, `--no-warnings`. Exit codes: 0 clean (no changes), 1 additive only, 2 breaking or fatal error. The default console formatter mirrors `git diff` style with severity-coloured headers; `--json` emits a structured payload for downstream tooling and `--md` emits a markdown report ready to paste into PR descriptions or release notes. Volatile fields (`generatedAt`, `compodocxVersion`) are stripped before comparison so re-runs of the same source produce a clean diff.

- **`--exportFormat llm-md` (#56).** Third value for `--exportFormat` (`json | html | llm-md`). Emits a single markdown file (`<output>/llm-context.md`) optimized for LLM context windows: per-entity sections, signal-typed properties, JSDoc tags, and source-file paths. Streams to stdout when `-d` is omitted (for piping into `cat`, `sed`, or downstream tooling); writes to file when `-d` is provided. Token-density caps are applied at the format boundary so embedded base64 images and giant union literals never bloat the output.

- **Version-switcher widget (#58).** Right-aligned dropdown at the top of the content area on desktop (in the mobile topbar at smaller viewports). Shows the current version label, lists all built versions from `versions.json`, and navigates to the equivalent page in the target version using a HEAD-fetch existence probe - falls back to the version's root index when the page does not exist there instead of leaving the reader on a 404. On `file://` URLs the widget renders a static "open via http" hint instead of a half-working dropdown (HEAD fetch is uniformly blocked across browsers under the file scheme).

- **`--jsonIndent <spaces>` flag (#54).** Controls `JSON.stringify` indentation for `--exportFormat json`. Default `0` (compact single-line, unchanged from 0.2.x); valid range 0–8; explicit `--jsonIndent 0` is honoured over a non-zero config-file value. Out-of-range or non-numeric values exit non-zero with a clear error message.

- **`--versionsRoot <path>` and `--maxVersionsShown <n>` flags (#58).** `--versionsRoot` defaults to the `-d` folder itself (manifest at `<-d>/versions.json` alongside `<label>/` subfolders); override only for split-repo CI setups. `--maxVersionsShown` caps the dropdown entry count (default `10`, range 0–1000, `0` = unlimited); when the manifest contains more entries than the cap, the dropdown footer renders a "showing N of M versions" hint linking to the raw manifest.

- **Multi-version pattern guide (`docs/versioned-docs.md`, #57).** Deployment recipes for GitHub Pages, Netlify / Vercel, plain nginx, and a drop-in script for projects that prefer to manage version routing externally. References `scripts/build-versioned-docs.sh` as a starting point.

### Fixed

- **Page renderer crash on `@deprecated` JSDoc with inline `{@link X}` (#58).** TypeScript parses such JSDoc comments as a `NodeArray<JSDocComment>` rather than a string, which used to leak through `checkForDeprecation` and reach `BlockProperty` as a JSX child - KitaJSX rejected it with "Objects are not valid as a KitaJSX child" and aborted the entire build. Both `class-helper.ts` and `angular-dependencies.ts` now flatten the comment via `JsdocParserUtil.parseJSDocNode` so a string is always stored on `result.deprecationMessage`. The `{@link X}` literal is preserved in the rendered banner.

- **Diff output truncation cap missing on signature values (#55).** Embedded base64 images and giant union literals could push individual signature strings into the megabytes. A `SIGNATURE_VALUE_CAP = 160` constant in the format helper now truncates at the bottleneck, covering types, default values, return types, and rawtype in one place.

### Changed

- **Action icons moved out of the sidebar header into a content-area microheader (#58).** Theme picker, dark-mode toggle, and the new version-switcher used to share the sidebar brand row, which truncated long brand titles and crowded the header. They now sit in a right-aligned strip at the top of the content area on desktop; the mobile topbar still carries duplicates and the desktop strip hides under `@media (max-width: 1023px)`. Sidebar header is brand + search only.

### Internal

- **`tag.comment` flattening rule across the compiler (#58).** All sites that store JSDoc tag comments to user-visible string fields (`deprecationMessage`, `category`) now go through `JsdocParserUtil.parseJSDocNode` instead of reading `tag.comment` directly. This is the same gotcha that surfaced as the inline-`{@link}` crash; the rule prevents future regressions across other tag handlers.

- **`VOLATILE_EXPORT_FIELDS` runtime constant (#54).** Lists the export-data fields that change every run (`generatedAt`, `compodocxVersion`). Diff and downstream consumers iterate this constant rather than hard-coding the list, so adding a future volatile field updates both sides atomically.

- **`EXPORT_SCHEMA_VERSION = 1` runtime constant (#54).** Single source of truth for the export-data schema version. Diff and llm-md outputs include `schemaVersion` for forward compatibility; a drift-detection spec walks `src/` for any `schemaVersion: <number>` literal write and fails the build if any consumer hard-codes the number instead of importing the constant.

## [0.2.0] - 2026-05-07

Build modernization. Replaces the Rollup + esbuild + tsc + Tailwind + node-script chain with a single bundler - tsdown 0.21.10 (Rolldown engine, Rust) - for both the lib bundle and the client bundle. No public API change, no CLI flag change, no template API change. The published tarball is byte-for-byte equivalent in user-visible behavior; the lib bundle now ships dual ESM + CJS output for forward compatibility.

### Changed

- **Lib bundle migrated from Rollup to tsdown** (#48). Three entry points unchanged (`index-cli`, `index`, `template-playground-server`). Output is now dual format - CJS at `dist/*.js` (preserves the `main` field, the bin shim, and `scripts/start-playground-simple.js` `require()` resolution) and ESM at `dist/*.mjs` (added). Inline source maps preserved. The full Rollup `external` list ported verbatim into `deps.neverBundle`, because tsdown's auto-detection misses sub-path imports like `neotraverse/legacy`. Rolldown's default `dynamicImportInCjs: true` (semantics negated relative to classic Rollup) preserves `await import('shiki' | 'chokidar' | ...)` in CJS output, which is required because shiki is ESM-only and cannot be `require()`'d. `@rollup/plugin-typescript`, `@rollup/plugin-json`, and `rollup` removed from devDependencies.

- **Client bundle migrated from esbuild to tsdown** (#49). Single config file `tsdown.client.config.ts`. ESM-only, minified, ES2020, `platform: 'browser'`. D3 stays lazy-loaded as a separate chunk under `src/resources/js/chunks/` (preserved from esbuild behaviour - module-graph pages only fetch D3 on demand). Pagefind unchanged: `await import(/* @vite-ignore */ pagefindUrl)` is a runtime-URL form that bundlers cannot follow, so it is fetched from the deployed site at runtime. `deps.alwaysBundle: [/.*/]` forces every `dependencies` entry to inline; without this override, tsdown's auto-externalization would leave `await import('d3')` as a bare specifier the browser cannot resolve. Bundle size regressed in the project's favour: total client gzipped 110.3 KB → 106.9 KB (-3.1%); entry chunk gzipped 14.5 KB → 13.9 KB (-4.0%). esbuild removed from devDependencies.

### Fixed

- **`@compodoc/ngd-transformer` default-import resolution under Rolldown** (#48). The package flags itself `__esModule: true` but exports no `default`, so `import ngdT from '@compodoc/ngd-transformer'` followed by `new ngdT.DotEngine(...)` resolved to `undefined.DotEngine` at runtime under Rolldown's spec-strict ESM interop (Rollup tolerated this via `@rollup/plugin-typescript` letting TypeScript apply `esModuleInterop` first). Switched `src/app/engines/ngd.engine.ts` to `import { DotEngine } from '@compodoc/ngd-transformer'`. The named import is also more idiomatic TypeScript and works under both bundlers.

- **CLI shebang stripped from `dist/index-cli.{js,mjs}`** (#48). tsdown 0.21.x has a known issue (rolldown/tsdown#886, #300) where it removes the `#!/usr/bin/env node` shebang from CJS and ESM entries. Added `scripts/postbuild-shebang.mjs` as a post-build step that re-prepends the shebang and chmods 0755 on both formats. Idempotent. Without this, direct invocation of the bin would fail on POSIX systems.

- **`scripts/dev-watch.mjs` was broken after the bundler swap** (#50). The dev watcher invoked `npx esbuild` and `npx rollup` directly from its build steps, both of which were removed in #48 / #49. Switched both invocations to `npx tsdown` (root config for the lib step, `tsdown.client.config.ts` for the client step). `npm run dev`, `dev:standalone`, and `dev:module` work again.

### Internal

- **`src/resources/js/compodocx.js` is now a gitignored build artifact** (#50). The file had been tracked since the 0.0.1 initial commit but never updated, and the chunks it referenced (`src/resources/js/chunks/*.js`) were already gitignored, so the committed version always pointed at chunk hashes that don't exist on disk after a fresh clone. Added to `.gitignore`, removed from tracking via `git rm --cached`. The vendored `libs/jszip.min.js` stays tracked. The npm tarball still ships the regenerated bundle because `src/resources/` is in `package.json` `files` and the release workflow runs `npm run build` before `npm pack`.

## [0.1.0] - 2026-05-06

The first feature-complete release. Closes the compodoc → compodocx rendering compatibility gap surfaced by a full sweep of the legacy CLI test suite, drops the last `it.skip` / `describe.skip` markers from the migration era, and brings the published behaviour up to "no broken promises" against the migration guide.

### Fixed

- **Custom property and method decorator listing on the API tab.** `BlockProperty` and `BlockMethod` now render `p.decorators` / `m.decorators` (already populated upstream by `class-helper.ts:formatDecorators`) inside a `cdx-member-decorators` line, with `<br />`-separated entries when multiple decorators stack on the same member. Custom decorators like `@LogProperty()`, `@LogPropertyWithArgs('theCurrentFilter')`, and `@throttle(1000 as PollingSpeed, {leading: true})` now reach the rendered output again instead of disappearing into the source-code panel only.
- **Component metadata table now includes `changeDetection`, `encapsulation`, and `preserveWhitespaces`.** The TSX rewrite had pushed those boolean / enum traits into hero-row badges only; downstream consumers that grep the metadata-card labels (Change detection / Encapsulation / Preserve whitespaces) for migration scripts and snapshot tests had nothing to match. Both surfaces ship now - badges for visual emphasis, metadata-card row as the source-of-truth label.
- **Private-only constructors render with their modifier badge.** `EntityPage`'s Dependencies branch falls back to `BlockConstructor` when `e.constructorObj.modifierKind` is non-empty but inject() props and constructor args are both empty, so a `private constructor()` now surfaces a proper Constructor section with `cdx-member-modifier--private">Private` chip instead of being filtered out entirely.
- **`@NgModule({ providers, … })` shorthand resolution.** `SymbolHelper.getProviderEntries` previously bailed out when the prop was an Object-Literal-Shorthand (`@NgModule({ providers })` referencing a local `const providers = [Foo]`) because the prop's initializer was an `Identifier`, not an `ArrayLiteralExpression`. Threaded `srcFile` through and added a shorthand-aware branch that walks the file's top-level `const`/`let` declarations to find the bound array literal - same pattern as `parseSymbols`. The AboutModule providers section renders again, and `<h3>Providers</h3>` reappears for every module that uses the shorthand pattern.
- **Constructor JSDoc threading into the Dependencies section.** `visitConstructorDeclaration` now copies `@param` descriptions back onto each `result.args` entry after `mergeTagsAndArgs`, and `DependenciesSection` gained two optional fields: `description` (per-dep, rendered below the dep row inside `cdx-deps-desc`) and `constructorDescription` (whole constructor body, rendered above the deps list inside `cdx-deps-constructor-desc`). Both flow through `parseDescription` so `{@link X}` resolves to a proper anchor. Restores the `Watch {@link TodoStore}` constructor body link on the Todo class and the `A TodoStore -> see {@link TodoStore}` per-param description on FooterComponent.

### Internal

- **CLI test migration complete.** Six clusters of stale Bootstrap-era assertions (12 spec files, ~250 assertions across `cli-extends`, `cli-typedoc-examples`, `cli-generation`, `cli-disable-options`, `cli-generation-big-app`, `cli-jsdoc-examples`, `cli-coverage`, `cli-unit-test`, `cli-deprecated`, `cli-duplicates`, `cli-toggle-menu-items`, `cli-uniqid`) rewritten against the cdx-\* TSX markup surface. No `it.skip` / `describe.skip` markers remaining from the migration era. The legacy `routing-without-module` fixture (12 files) targeting the deprecated Angular ≤ 8 `loadChildren: 'app/path#ModuleName'` string-syntax was removed entirely.
- **CLI assertion markup reference added to `CLAUDE.md`.** Documents every Bootstrap → cdx-\* shift surfaced during the migration so future spec authors can write assertions against the right landmarks the first time.

## [0.0.5] - 2026-05-05

### Fixed

- **Class-level `@example` (and every other class-level JSDoc tag) was silently dropped from generated component / directive pages.** The TSX-era Examples section on the Info tab (and any other render path that reads `c.jsdoctags`) saw an empty array because `component-dep.factory.ts` and `directive-dep.factory.ts` accessed `IO.jsdoctags[0].tags` - a leftover from a 2017-era compodoc shape where `IO.jsdoctags` was wrapped in a single-element array. After the migration `IO.jsdoctags` is the flat tag array directly, so `[0].tags` returned `undefined` for every component and directive. The bug was invisible in old compodoc because its Handlebars templates never read class-level `c.jsdoctags` - they only sourced examples from `component.exampleUrls` (iframe previews). The TSX migration added a real Examples section but built it on top of the pre-existing broken data path. Both factories now assign `IO.jsdoctags` directly. Verified against a project with 163 `@example` tags: 22 component pages now render an Examples section that previously rendered nothing.

## [0.0.4] - 2026-05-05

### Fixed

- **Sidebar sections opened by default regardless of `toggleMenuItems`**. The Handlebars-era helper read `toggleMenuItems` as a whitelist of types that stay open, with the special token `'all'` collapsing everything; the JSX port inverted the semantics so `['all']` (the default) caused every section to render fully expanded. The default now matches compodoc's long-standing behaviour again - sections start collapsed unless their type is explicitly listed in `toggleMenuItems`.

### Changed

- **Release pipeline gated on CI.** The `Release` workflow now waits for the main CI workflow (4-OS x 2-node-matrix + e2e) to succeed on the same commit before publishing to npm, plus runs `npm run lint` itself as defence-in-depth. Tags pushed against commits that fail CI are no longer published.

### Internal

- Dependency bumps (patch + minor only): `@angular-devkit/schematics 21.1→21.2.9`, `@biomejs/biome 2.4.10→2.4.14`, `@playwright/test 1.57→1.59.1`, `@types/node 25.0→25.6`, `cheerio 1.1.2→1.2.0`, `rollup 4.55→4.60`. Major bumps deferred (i18next, marked, os-name, ts-morph, uuid, esbuild).
- Release workflow now uses Node 24 + npm 11 so OIDC Trusted Publisher works without a pre-publish CLI upgrade step.

## [0.0.3] - 2026-05-05

### Fixed

- **Folder grouping in the sidebar for multi-project Angular workspaces** (`projects/<group>/<lib>/src/...`). The grouping function had a hardcoded marker list that stripped at the first `src/` it found, which collapsed the entire `projects/<group>/<lib>` hierarchy into nothing. Workspaces ended up with either no grouping or a flat per-library group, ignoring `groupDepth` entirely. The function now detects the `projects/` prefix, strips it, and also strips the inner `/src/` folder so segments become `[<group>, <lib>, ...rest]`. With `groupDepth: 2` you now get one sidebar group per library (e.g. `forms/field`, `ui/layout`); `groupDepth: 1` gives one group per top-level project (e.g. `forms`, `ui`, `common`). Single-app layouts are unchanged.

## [0.0.2] - 2026-05-05

### Fixed

- **Published tarball was missing two runtime files** - `src/data/api-list.json` (Angular API name index used by the type linker) and `src/banner` (ASCII startup banner). Both are required at runtime by the bundled CLI but were excluded from the `files` whitelist in 0.0.1, causing `Cannot find module '.../src/data/api-list.json'` on every invocation of an installed `0.0.1` package. The 0.0.2 tarball includes both files, restoring CLI functionality. **0.0.1 is broken on npm - install 0.0.2 or later.**

## [0.0.1] - 2026-05-05

First cngx-line tag. compodocx forks compodoc 1.1.32 with the analyzer and configuration story preserved and the rendering layer rewritten from scratch.

### Identity

- Renamed package to `@cngxjs/compodocx` and CLI to `compodocx` (with `compodoc` kept as a binary alias for drop-in compatibility).
- Repository moved to <https://github.com/cngxjs/compodocx>.
- Scope narrowed to Angular only - AngularJS, Angular 1, and TypeScript-without-Angular code paths removed from the analyzer.
- New brand mark, README, and MIGRATION.md.

### Rendering layer (rewritten)

- Migrated all page and block templates from Handlebars to JSX via `@kitajs/html`. The two systems are not compatible at the template level - see `MIGRATION.md` for the cookbook.
- Replaced Bootstrap 4 markup throughout with semantic HTML and CSS Grid / Flexbox layouts. All emitted classes are now `cdx-` prefixed; `data-compodoc="<block-name>"` attributes are also emitted on every section as a stable selector for downstream tooling and CSS.
- Replaced jQuery with native APIs in the client bundle (`src/client/`).
- Replaced Lunr search with [Pagefind](https://pagefind.app/). Search index is generated at build time and works fully offline.
- Replaced the Bootstrap-style theme switcher with a CSS-custom-property-based theme system. Eight bundled themes (`default`, `ocean`, `midnight`, `nord`, `rose-pine`, `ember`, `neon`, `brutalist`) plus a `gitbook` compat theme. Custom themes ship as a single CSS file overriding the design tokens.
- Replaced `prism.js` with [Shiki](https://shiki.matsu.io/) for syntax highlighting. Themes can pair with a Shiki theme via `--shikiTheme`.
- New design system in `src/styles/components/*.css` built on Tailwind v4 utilities + token primitives.

### Modern Angular awareness

- First-class rendering of `inject()`-based DI alongside constructor DI, with a dedicated Dependencies section and modifier badges (`optional`, `skipSelf`, `self`, `host`).
- Recognises and renders `input()`, `output()`, `model()`, `signal()`, `computed()`, `linked-signal()`, and `effect()` constructs distinctly from legacy `@Input()` / `@Output()`.
- Dedicated Derived State section showing `computed()` and `linked-signal()` properties with their `Derives from …` dependency narrative.
- Optional Effects section (`--showEffects`) for documented `effect()` blocks.
- Structured `host` metadata rendered as a flat list of typed entries (static class, static attributes, bound classes, bound styles, events, listeners) instead of a stringified object.
- Standalone-aware: per-component dependency graph for standalone imports, project-level module graph for NgModule projects, automatic detection so the right one shows up.
- New `--publicApiOnly` flag restricts processing to symbols re-exported from a project's public entry.

### Theming tab (new feature)

- New per-component Theming tab driven by inline-doc tokens parsed out of each component's SCSS or CSS.
- Supports CSS custom properties (`--cdx-foo`), SCSS variables (`$cdx-foo`), and `@property --cdx-foo` rules.
- JSDoc / SassDoc tag set: `@overview`, `@type`, `@default`, `@group`, `@example`, `@since`, `@deprecated`, `@see`. `@property` rules' `syntax` and `initial-value` populate `type` and `defaultValue` automatically.
- Configurable via `themingTabSections: ['overview', 'index', 'tokens', 'source']` in the config file.
- Source authoring guide at `docs/theming-tokens-authoring-guide.md`.

### Custom template overrides (new contract)

- `--templates` now expects JavaScript files (CommonJS modules) under `partials/`, replacing the Handlebars partials used by compodoc.
- Each override receives `(data, helpers)` and returns a raw HTML string.
- 27 page-level override names plus 16 block-level override names exposed as a stable contract - see `MIGRATION.md`.
- `helpers` exposes the full export of `src/templates/helpers/index.ts` (i18n `t()`, `linkTypeHtml()`, `parseDescription()`, `codeWrap()`, `functionSignature()`, …) - see `MIGRATION.md` for the full table.
- Reference templates live at `test/fixtures/test-templates/partials/` and are exercised by the CLI integration tests.

### CLI changes

- New flags: `--showEffects`, `--publicApiOnly`, `--disableDependenciesTab`, `--gaID`.
- Removed: `--gaSite` (Universal Analytics is end-of-life - use `--gaID` with a GA4 measurement ID).
- All other compodoc flags retained with identical behavior.
- Help text rewritten where stale (`--templates` no longer says "Handlebars").

### UI redesign

Full visual overhaul:

- New entity hero with breadcrumb, title, badges, file path.
- Member cards reorganised as flat `cdx-io-member` rows for API blocks (`BlockMethod`, `BlockProperty`, `BlockInput`, `BlockOutput`, `BlockAccessors`, `BlockIndexSignatures`, `BlockDerivedState`).
- Sticky source viewer with cloned-line stack and `#L42` deep linking.
- Stripe-style sliding-indicator tab bar on entity pages.
- Dependency graphs (D3 + Graphviz) with zoom-pan controls and fullscreen.
- Overview dashboard with project KPI tiles, dependency graph, and entity inventory chips.
- Coverage report with per-file scores, JSDoc completeness breakdown, and CI thresholds.
- Command palette (`Cmd+K` / `Ctrl+K`).
- Keyboard navigation (`j` / `k`, `[` / `]`, `?`).
- Dark mode by system preference plus manual toggle, with localStorage persistence.
- Eight-theme picker in the topbar.

### Compiler / metadata extraction

- `signalDeps[]` extracted on `computed` / `linked-signal` properties via AST walk.
- `slots[]` extracted from `@slot` JSDoc tags on components.
- `themeTokens[]`, `themeStyleSources[]`, `themeOverview` extracted on components from co-located SCSS / CSS files (one level of `@import` / `@use` followed for SCSS).
- `hostStructured` replaces the stringified `host` object.
- `ProviderEntry[]` replaces stringified `providers` / `viewProviders`.
- `inject()`-kind properties tracked separately from regular properties for the new Dependencies section.

### Documentation

- New: `MIGRATION.md` (this release).
- New: `README.md` (rewritten with a Why section, Highlights, "What the generated site contains", and "Authoring docs in your code").
- New: `docs/theming-tokens-authoring-guide.md`.
- New: `docs/custom-templates.md`.
- Updated: `docs/configuration.md` (50+ flag reference).
- New brand mark at `docs/assets/compodocx-mark.svg`.

### Build, test, infra

- `noEmit: true` in `tsconfig.json` - no stale `.js` artifacts checked in next to `.ts`.
- Replaced ESLint + Prettier with [Biome](https://biomejs.dev/).
- Replaced Mocha + Chai + Sinon with [Vitest](https://vitest.dev/).
- Added [Playwright](https://playwright.dev/) e2e suite covering the entity hero, content sections, theming tab, source viewer, hash router, sidebar focus, command palette, coverage report, and overview dashboard at three fixture projects.
- Dev watcher (`npm run dev`) rebuilds the docs site for one of the bundled fixtures whenever a source or fixture file changes.
- LICENSE refreshed: dual copyright crediting the compodoc contributors (2016–2025) and the cngx contributors (2026).

### Known limitations

- The Template Playground (`--templatePlayground`) still ships but is on the deprecation path. It generates Handlebars output that is no longer compatible with `compodocx --templates`. The ZIP export's README warns about this explicitly.
- `BlockRelationshipGraph` is intentionally not wired for `--templates` overrides (no downstream demand). Will be added if requested.
