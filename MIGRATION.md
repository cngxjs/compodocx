# Migrating from compodoc to compodocx

CLI flags and config-file shape stay backwards-compatible. A typical project switches with a one-line `package.json` edit. This document covers what differs and what to do about it.

## Quick switch

```diff
- "@compodoc/compodoc": "^1.1.32"
+ "@cngxjs/compodocx": "^0.4.0"
```

```diff
- "docs": "compodoc -p tsconfig.app.json -d docs"
+ "docs": "compodocx -p tsconfig.app.json -d docs"
```

For most projects this is the entire migration. The `compodoc` binary is also exposed by the new package, so leaving the script as `compodoc -p ...` works too.

## Migrating with `ng add`

Inside an Angular CLI workspace, `ng add @cngxjs/compodocx` does the package.json edit, the `tsconfig.doc.json` seed, and the legacy-artefact rewrite in one pass:

```bash
ng add @cngxjs/compodocx
```

What the schematic does on a project that previously used `@compodoc/compodoc`:

- Removes `@compodoc/compodoc` from `dependencies` and `devDependencies`.
- Renames any `compodoc:<suffix>` script to `compodocx:<suffix>`. If a `compodocx:<suffix>` already exists with a different value, the source script is renamed to `compodoc:<suffix>-legacy` instead - never overwritten.
- Rewrites the standalone `compodoc` token in any script value to use the new bin.
- Adds the three default scripts: `compodocx:build`, `compodocx:build-and-serve`, `compodocx:serve`.
- Creates `tsconfig.doc.json` if it does not already exist.

Useful flags:

- `--skip-migration` - leave the legacy dependency and `compodoc:*` scripts in place.
- `--project <name>` - required when `angular.json` declares more than one project.
- `--script-prefix compodoc` - produce `compodoc:*` script names instead of the default.

Re-running `ng add @cngxjs/compodocx` is idempotent (zero diff on the second pass). CI workflow files that invoke `compodoc -p ...` directly are not rewritten - update those manually, or rely on the `compodoc` bin alias the new package still ships.

The rest of this document only matters if:

- You shipped a custom Handlebars template directory via `--templates`.
- You used a built-in compodoc theme other than the new bundled set.
- Your CSS or downstream tooling targets compodoc's emitted class names.
- You scraped or post-processed the generated HTML.

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
| `-d`, `--output` | unchanged ||
| `-s`, `--serve` | unchanged ||
| `-r`, `--port` | unchanged ||
| `-w`, `--watch` | unchanged ||
| `-o`, `--open` | unchanged ||
| `-e`, `--exportFormat` | unchanged | `json` and `html` still supported. JSON shape gained typed `Export*` interfaces - see "JSON export" below. |
| `--jsonIndent` | new (default `0`) | Indent for `documentation.json`. Default dropped from `4` to `0` (smaller files). Pass `--jsonIndent 2` to restore human-readable formatting. |
| `--multiVersion` / `--no-multiVersion` | new (default `true`, BREAKING) | See "Breaking change in 0.3.0" above. |
| `--versionLabel`, `--versionsRoot`, `--maxVersionsShown` | new | Multi-version controls. See `docs/versioned-docs.md`. |
| `-n`, `--name` | unchanged ||
| `-a`, `--assetsFolder` | unchanged ||
| `-y`, `--extTheme` | unchanged ||
| `--theme` | new theme set | See "Themes" below. |
| `--templates` | breaking | Now expects JavaScript files (CommonJS modules), not Handlebars partials. See "Custom templates" below. |
| `--includes`, `--includesName` | unchanged ||
| `--coverageTest`, `--coverageMinimumPerFile`, `--coverageTestThresholdFail` | unchanged ||
| `--disableSourceCode`, `--disableDomTree`, `--disableTemplateTab`, `--disableGraph`, `--disableCoverage`, `--disablePrivate`, `--disableProtected`, `--disableInternal`, `--disableLifeCycleHooks`, `--disableConstructors`, `--disableFilePath` | unchanged ||
| `--disableDependenciesTab` | new | Hides the per-component standalone-import graph independently from `--disableGraph`. |
| `--customFavicon`, `--customLogo` | unchanged ||
| `--hideGenerator`, `--hideDarkModeToggle` | unchanged ||
| `--toggleMenuItems`, `--navTabConfig` | unchanged ||
| `--gaID` | replaces `--gaSite` | GA4 measurement IDs only (`G-XXXXXXXXXX`). SPA pageviews tracked automatically. |
| `--gaSite` | removed | Universal Analytics is end-of-life. |
| `--showEffects` | new (default `false`) | Renders Angular `effect()` blocks in a dedicated section on the API tab. |
| `--publicApiOnly` | new | Restricts processing to symbols re-exported from a project's public entry. |
| `--minimal`, `--silent`, `--language`, `--maxSearchResults` | unchanged ||
| `--templatePlayground` | removed in v0.4.0 | Deprecated in v0.3.0, removed in v0.4.0. Switch to the JS template override path (`--templates`). The `compodocx migrate` sub-CLI converts existing Handlebars partials automatically. |

Config-file (`.compodocrc.json`, `.compodocrc.yaml`, `.compodocrc.js`) keys mirror the CLI flags one-to-one. Existing config files keep working unchanged.

A handful of options are **config-only** (no matching CLI flag) - they only take effect when set in a config file:

| Key | Default | Notes |
|-|-|-|
| `themingTabSections` | `[]` | Subset of `['overview','index','tokens','source']` to render on the Theming tab. |
| `playgroundDependencies` | `{}` | Extra packages forwarded to every `@playground` StackBlitz manifest. |
| `menuLayout` | `"type"` | `"type"` keeps the per-kind sidebar chapters (default); `"feature"` replaces them with a curated **Features** chapter plus a single top-level link to the **`references.html`** API portal. Use `groupDepth >= 2` for the feature mode to feel right in multi-project workspaces. Non-breaking for `"type"` users; v0.6.0 reshaped the `"feature"` layout - see "Feature-layout reshape in v0.6.0" below. |
| `featuresName` | `""` (i18n default) | Override the **Features** chapter heading under `menuLayout: 'feature'`. Empty string falls back to the translated `features` i18n key. |
| `referencesName` | `""` (i18n default) | Exposed on `data.referencesName` for `menu.js` / `api-reference.js` overrides. The built-in templates read the localised `reference` / `api-reference` keys directly and do not consume `referencesName`. |
| `collapsedAll` | `false` | Force every chapter AND every nested folder group to start collapsed on first load. Overrides `toggleMenuItems` and `groupDepth`-driven expansion. Useful for large codebases. Non-breaking - default off. |

### Feature-layout reshape in v0.6.0

`menuLayout: 'feature'` used to render one Features chapter mixing every entity kind in each bucket. v0.6.0 reshaped it into:

- **Features chapter** in the sidebar - the curated subset of organisms a consumer USES (components, directives, pipes, injectables, tokens, classes, guards, interceptors, entities). A reference-kind symbol can opt in via `@docsKind primary`. Bucketed by folder / `@category` with collapsible groups and per-bucket landing pages at `categories/<bucket-id>.html`.
- **Single-page API Reference portal** at `references.html`, linked from the sidebar as a top-level **Reference** entry (flat anchor, no tree). The portal is the exhaustive catalogue of every public symbol regardless of kind - components, directives, services, types, functions, the lot - filterable by kind / stability / bucket / free-text with URL state persistence. Replaces the per-bucket References chapter that the sidebar tree used to host. Primary-kind organisms appear both in the Features chapter and on the portal - the table-of-contents vs. index pattern, same target page.

Sidebar selectors moved:

| Before (v0.4.6 – v0.5.x) | After (v0.6.0+) |
|-|-|
| `#features-links` (held every entity kind) | `#features-links` (primary kinds only) - the exhaustive catalogue lives on `references.html` |
| `#features-group-<path>` | `#features-group-<path>` (primary kinds only) |
| (no References tree) | `<li class="chapter references">` flat anchor to `references.html` (no `#references-links`, no group ids) |
| Miscellaneous chapter rendered alongside Features | Miscellaneous chapter suppressed; every misc symbol surfaces on the portal |
| (no portal page) | `references.html` single-page catalogue with kind / stability / bucket / text filters and URL state |

Downstream readers of `Configuration.mainData`:

- `categorizedByFeature` - unchanged. The LLM exporter and any third-party reader continue to see the flat, cross-kind dict.
- `categorizedByFeaturePrimary` - new sibling the Features chapter reads from.
- `categorizedByFeatureReference` - new sibling holding the EXHAUSTIVE per-bucket index. The built-in sidebar does not consume it (References is a flat link), but `menu.js` and `api-reference.js` overrides can read it to render their own tree.

To opt INTO the new layout, no migration is needed - set `menuLayout: 'feature'` in your config. To customise per-symbol placement, add `@docsKind primary` to any reference-kind JSDoc (function, interface, typealias, variable, enumeration). Set `featuresName` in your config to override the Features chapter label without touching translations. `menuLayout: 'type'` (the default) is unaffected by every v0.6.0 change.

**InjectionToken / HttpContextToken kind split (v0.6.0+).** `export const X = new InjectionToken<T>(...)` and `new HttpContextToken<T>(...)` declarations are no longer classified as `injectable`. They land in a new first-class `token` kind and emit at `tokens/<name>.html` (not `injectables/<name>.html`). Existing URLs pointing at the old `injectables/<TOKEN_NAME>.html` path 404 - readers must update bookmarks. The `Injectable` facet count in the References portal and command palette now reflects only `@Injectable()` classes; `Token` is a sibling facet. `EntityKind` gains `'token'`, `KIND_HREF_PREFIX.token = 'tokens'`, `KIND_LABELS.token = 'Token'`, and `PRIMARY_KINDS` includes it. The detail page renders a leaner template (`TokenPage`, override name `token`) with just hero + Referenced-by + description + type signature + providedIn - no methods, no inputs/outputs, no API tab.

**`#api` default-tab helper preserved for future use.** `KINDS_WITH_API_TAB` and `featureLinkHref(prefix, item, defaultTab)` in `Menu.tsx` still exist - they append `#api` to entity hrefs for the kinds whose detail page actually renders an API tab (component, directive, pipe, injectable, class, interface, guard, interceptor, entity, function, enumeration); typealiases and variables stay plain. No built-in caller passes `defaultTab='api'` in v0.6.0 since the References sidebar tree was retired in favour of the `references.html` portal, and the portal itself links to plain hrefs. Available for custom `menu.js` / `api-reference.js` overrides that want to land readers directly on the API tab.

**Pagefind search metadata.** Entity hero blocks now emit hidden `<span data-pagefind-meta="kind:Component">`, `<span data-pagefind-meta="category:ui/feedback">`, and `<span data-pagefind-meta="description">first sentence text…</span>` fragments so search results can surface the entity kind, bucket category, and a first-sentence excerpt. The literal `key:value` form is required - the per-suffix attribute variant (`data-pagefind-meta-kind="..."`) is not discovered by Pagefind 1.x's static scan and is intentionally not emitted. Empty descriptions are omitted from the index entirely. Helpers ship under `src/templates/helpers/pagefind-meta.ts` (re-exported from `helpers/index.ts`): `KIND_LABELS` / `KIND_LETTER` (Record), `firstSentence(html)`, `pagefindMetaBlock(input)`, `pagefindFilterBlock(input)` (filter-facet dimensions: kind / lib / bucket / tier / wcag), and `deriveLibFromBucket(bucket)`. The in-tree command-palette consumes `meta.kind` directly when present and falls back to title-parsing for legacy builds.

## JSON export shape

`documentation.json` produced by `compodocx --exportFormat json` gained:

- **Typed shape.** `ExportData` and every per-entity field are exported from `@cngxjs/compodocx`. Downstream tooling can import and narrow without `any`.
- **Header fields.** `schemaVersion: 2` (v0.6.0+; was `1` in v0.3.0–v0.5.0), `generatedAt` (ISO 8601), `compodocxVersion`. Pre-v0.3.0 outputs had no `schemaVersion` - consumers should treat its absence as version 0. The v0.6.0 bump from `1` to `2` is a non-breaking additive change: `tokens?: ExportInjectable[]` was added as a top-level entry (InjectionToken / HttpContextToken collection - previously dropped from JSON entirely), plus optional per-entity fields `docsKind?: 'primary'`, `wcagLevel?: 'A' \| 'AA' \| 'AAA'`, `a11yNote?: string`, `taggedSelector?: string`, `relatedTo?: string[]` on directives / components / interfaces / classes / tokens. Old v1 readers ignore unknown fields and keep working; downstream tools that want to react to the new surface should gate on `schemaVersion >= 2`.
- **Indent default `0`.** Single-line by default. Pass `--jsonIndent 2` to restore the previous human-readable formatting. `jq` consumers are unaffected.

## Themes

The bundled theme set is different.

| Old compodoc theme | Closest replacement |
|-|-|
| `gitbook` | `gitbook` (compat theme - preserved) |
| `material` | `default` or `ocean` |
| `original` | `default` |
| `postmark` | `nord` |
| `readthedocs` | `default` |
| `stripe` | `ocean` |
| `vagrant` | `midnight` |
| `laravel` | `ember` |

Eight bundled compodocx themes: `default`, `ocean`, `midnight`, `nord`, `rose-pine`, `ember`, `neon`, `brutalist`. Plus `gitbook` as compat.

Each theme is a single CSS file overriding the design tokens defined in `src/styles/compodocx.css`. Author your own by copying `src/themes/theme-template.css`, setting tokens, and passing the path via `--theme`.

## Custom templates: HBS → JS

The biggest behavioral break. compodocx ships a JavaScript-based template override system that replaces compodoc's Handlebars partials.

### Layout

```text
my-templates/
└── partials/
    ├── overview.js
    ├── component.js
    ├── module.js
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

The returned string is inserted raw - no escaping. `null` / `undefined` falls back to the built-in TSX rendering. Overrides are consulted before the built-in renderer.

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

Stable contract for `--templates`. Data shapes documented inline in the corresponding TSX source under `src/templates/`.

### Page-level

`overview`, `markdown`, `modules`, `module`, `component`, `component-detail`, `controller`, `entity`, `directive`, `injectable`, `interceptor`, `guard`, `pipe`, `class`, `interface`, `routes`, `miscellaneous-functions`, `miscellaneous-variables`, `miscellaneous-typealiases`, `miscellaneous-enumerations`, `miscellaneous-function`, `miscellaneous-variable`, `miscellaneous-typealias`, `miscellaneous-enumeration`, `additional-page`, `package-dependencies`, `package-properties`, `coverage-report`, `unit-test-report`, `menu`, `app-config`, `bucket-landing`

The four singular miscellaneous contexts (`miscellaneous-function`, `miscellaneous-variable`, `miscellaneous-typealias`, `miscellaneous-enumeration`) target the per-entity detail page generated when a function, variable, type alias, or enumeration carries an `@category` JSDoc tag. The plural contexts continue to drive the shared collection page.

The `bucket-landing` context (v0.6.0+) targets the auto-generated `categories/<bucket-id>.html` pages emitted under `menuLayout: 'feature'`. Data: `data.bucketLanding = { bucket: string, segments: string[], depth: number, items: EntityWithKind[] }`. Both leaf and intermediate folder nodes get pages; intermediate buckets aggregate items from every descendant leaf.

### Block-level

`block-theming`, `block-theming-token`, `block-method`, `block-property`, `block-input`, `block-output`, `block-accessors`, `block-host-listener`, `block-host-listeners`, `block-host-bindings`, `block-derived-state`, `block-constructor`, `block-enum`, `block-typealias`, `block-index`, `block-index-signatures`, `block-playground`, `playground-content`, `referenced-by`, `version-switcher`

The `referenced-by` block (v0.6.0+) renders the chip-list of primary-kind entities that mention a reference-kind symbol's name in their public surface. Data: `{ entries: ReferencedByEntry[], depth: number }`; `ReferencedByEntry = { name, kind, hrefPrefix }`.

### Removed / not overridable

- `search-results`, `search-input` - Pagefind replaces Lunr and ships its own UI shell. No override hook.
- `breadcrumbs` - replaced by inline rendering in the entity hero. Override the page-level template if you need to change breadcrumb markup.
- `block-relationships`, `index`, `index-misc`, `link-type` - not overridable. `link-type` was a Handlebars helper, available now as `helpers.linkTypeHtml(typeName)` inside any JS override.

## Helper API

Every override receives a `helpers` object as its second argument - the full export of `src/templates/helpers/index.ts`. The source is authoritative; key entries:

| Helper | What it does |
|-|-|
| `t(key, opts?)` | i18n lookup |
| `linkTypeHtml(type)` | Renders a TypeScript type as a clickable HTML chip |
| `resolveType(name)` | Looks up an entity name and returns the link target |
| `parseDescription(desc, depth?)` | Renders a JSDoc description through the Markdown engine |
| `functionSignature(method)` | Code-formatted parameter list for a method |
| `extractJsdocParams(tags)` / `hasJsdocParams(tags)` | JSDoc helpers |
| `extractJsdocExamples(tags)` / `extractJsdocCodeExamples(tags)` | JSDoc helpers |
| `jsdocReturnsComment(tags)` | Pulls the `@returns` comment text |
| `signalKindLabel(kind)` | Maps signal kinds to human labels |
| `modifKind(k)` / `modifSlug(k)` / `modifIcon(k)` | TypeScript SyntaxKind modifier mappers |
| `relativeUrl(path)` / `shortPath(path)` / `shortUrl(url)` | URL / path utilities |
| `codeWrap(html)` / `highlightedCodeWrap(value)` | Wrap content in `<code>` / `<pre>`, optionally Shiki-highlighted |
| `isApiSection(id)` / `isInfoSection(id)` / `isThemingSection(id)` / `isTabEnabled(navTabs, id)` | Honor user tab/section configuration |
| `computeCoverageStats(model)` | Runs the documentation-coverage analysis |

## CSS class rename cheatsheet

compodoc emitted Bootstrap classes plus ad-hoc `compodoc-` names. compodocx prefixes everything with `cdx-` and drops Bootstrap markup entirely.

| compodoc class | compodocx replacement |
|-|-|
| `.card`, `.card-block`, `.panel` | `.cdx-member-card`, `.cdx-member-body`, `.cdx-content-section` |
| `.nav.nav-tabs`, `.nav-link`, `.tab-content`, `.tab-pane` | `.cdx-tab-bar`, `.cdx-tab`, `.cdx-tab-panel` |
| `.menu`, `.chapter`, `.link`, `.collapse` | `.cdx-sidebar`, `.cdx-sidebar-chapter`, `.cdx-sidebar-link` (legacy `.menu` and `.collapse` are still emitted for the menu's accordion JS) |
| `.compodoc-icon-*` | `.cdx-icon` (Lucide-style inline SVGs) |
| Bootstrap badges (`.badge`, `.badge-primary`) | `.cdx-badge`, `.cdx-badge--<kind>` |
| `.alert` | `.cdx-callout`, `.cdx-callout--<variant>` |
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

## `compodocx migrate` CLI

Available since 0.3.0. Automates the mechanical 80% of the migration: HBS → JS template conversion, CSS class renames, project-level audit.

```text
compodocx migrate inspect <project-path>                    # audit, no writes
compodocx migrate template <file.hbs> [--out <file.js>]     # single file
compodocx migrate templates <hbs-dir> --out <js-dir>        # directory
compodocx migrate css <file-or-dir> [--aggressive]          # CSS class renames
```

Common flags: `--dry-run`, `--json`, `--no-warnings`.

### Workflow

```bash
# 1. Audit the project
compodocx migrate inspect ./my-compodoc-project

# 2. Convert templates
compodocx migrate templates ./my-compodoc-project/templates --out ./templates-js

# 3. Rewrite stylesheets (conservative)
compodocx migrate css ./src/styles

# 4. Run compodocx with the new templates dir
compodocx -p tsconfig.json -d docs --templates ./templates-js
```

### Fidelity scoring

| Score | Meaning | Exit code |
|-|-|-|
| green | Every node mapped, no warnings. Mechanical, ready to use. | 0 |
| yellow | Mapped, but at least one lossy transformation. Manual review recommended. | 1 |
| red | Unknown helper, unsupported block, or partial with no target. Output emitted with TODO comments; user MUST review before using. | 2 |

CI pipelines can fail-fast on red migrations.

### Hard limits

The CLI rejects two cases instead of emitting broken output:

1. **`page.hbs` (full-page layout).** compodocx's outer `Layout.tsx` is not overridable. Workarounds: custom CSS via `--extTheme`, analytics via `--gaID`, extra Markdown pages via `--includes`.
2. **Override names not in the wiring map.** Anything not matching the page-level / block-level lists above. Custom user partials must be inlined into the surrounding override by hand.

### CSS rewrites

Conservative mode (default) rewrites class names in `.css` / `.scss` / `.sass` only. Aggressive mode (`--aggressive`) also rewrites `.html` / `.ts` / `.tsx` / `.js` - risky against string-literal class names, so the recommended workflow is `--dry-run --aggressive` first.

`data-compodoc="<block-name>"` attributes are intentionally preserved.

### ESM-package corner case

If your project's `package.json` has `"type": "module"`, the `.js` overrides emitted by the converter will fail to load - the loader calls `require()`. Workarounds:

- Rename converted outputs to `.cjs`, OR
- Remove the `"type": "module"` declaration in the templates directory (if your overrides live in a sub-folder), OR
- Keep the templates directory outside the ESM package boundary entirely.

`compodocx migrate inspect` flags this case automatically.
