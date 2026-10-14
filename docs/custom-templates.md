# Custom templates

Compodocx supports custom templates via the `--templates` flag. You can override any page or the sidebar menu by providing JavaScript files that return HTML strings.

## Quick start

```bash
compodocx -p src/tsconfig.json --templates ./my-templates
```

Directory structure:

```
my-templates/
  partials/
    component.js      # overrides the component detail page
    overview.js        # overrides the overview page
    menu.js            # overrides the sidebar menu
    ...
```

## Writing a custom template

Each `.js` file exports a function that receives the page data and a helpers object:

```js
module.exports = function(data, helpers) {
    const c = data.component;
    return `
        <h1>${c.name}</h1>
        <p>${helpers.t('file')}: <code>${c.file}</code></p>
        ${c.description ? helpers.parseDescription(c.description, data.depth) : ''}
    `;
};
```

The function must return an HTML string. This string is placed inside the page layout (header, sidebar, footer are not affected unless you override `menu.js`).

## Available template names

These file names correspond to page contexts. Place them in `partials/` inside your templates directory.

| File name | Overrides |
|-|-|
| `overview.js` | Overview page |
| `component.js` | Component detail page |
| `directive.js` | Directive detail page |
| `injectable.js` | Injectable/service detail |
| `interceptor.js` | Interceptor detail |
| `guard.js` | Guard detail |
| `pipe.js` | Pipe detail |
| `class.js` | Class detail |
| `interface.js` | Interface detail |
| `entity.js` | Entity detail |
| `token.js` | `InjectionToken` / `HttpContextToken` detail page (in its feature folder) (v0.6.0+) |
| `routes.js` | Routes page, `routes.html` (generated only when there are routes). Receives the main data plus `data.routing` (the route model: `roots`, each `{ id, kind: 'router' \| 'unmounted', bootstraps, configName, arrayName, features, routes }`, every route `{ id, path, fullPath, component, childrenFrom, redirectTo, title, guards, resolve, providers, data, children, file, line }`; `count`), `data.symbols` and `data.depth` (`0`). Row anchors are `route-<id>` |
| `markdown.js` | Markdown pages (readme, changelog, etc.) |
| `additional-page.js` | Additional documentation pages |
| `coverage-report.js` | Documentation coverage report |
| `unit-test-report.js` | Unit test coverage report |
| `package-dependencies.js` | Package dependencies page |
| `package-properties.js` | Package properties page |
| `utilities.js` | Utilities landing page, `utilities.html`: functions, constants, type aliases and enumerations in four groups |
| `function.js` | Function page (in the function's feature folder). Receives `data.function` |
| `variable.js` | Constant page (in its feature folder). Receives `data.variable` |
| `typealias.js` | Type alias page (in its feature folder). Receives `data.typealias` |
| `enumeration.js` | Enumeration page (in its feature folder). Receives `data.enumeration` |
| `resolver.js` | Functional resolver page (in its feature folder). Receives `data.resolver` |
| `dependency-injection.js` | Dependency Injection landing page, `dependency-injection.html`: feature types with their providers and feature functions, other providers, tokens |
| `di-cluster.js` | Page of a feature type (`<FeatureType>.html` in its feature folder). Receives `data.cluster = { featureType, providers, features, tokens }`, each list holding the same entity objects the symbol pages get. Member sections use the anchor `<FeatureType>--<name>`. A provider without a feature type (its own page) has no override of its own |
| `feature.js` | Page of a feature, `<entry point>/<feature>/index.html` (both layouts). Receives `data.feature = { id, label, entryPoint, importPath, detector, segments, parent, readme: { file, html }, members: { components, directives, pipes, services, configuration, utilities, constants, types, classes }, subFeatures, buildsOn, extendedBy }`; members are symbol table entries (`ref.kind`, `ref.name`, `data` the engine object), `parent`, `subFeatures`, `buildsOn` and `extendedBy` are cards `{ id, label, entryPoint, segments, memberCount, summary }` |
| `style.js` | Page of a style file listed in `styleFiles`, `<file name>.html` in its feature folder (`stylesheets/` without project analysis facts). Receives the main data plus `data.style = { file, name, language, importLine?, overview, groups, mixins, themes, relatedTo, sources }` (`groups` as in `block-theming`, `mixins` as in `block-theming-mixin`, `themes` the themed symbols as `{ name, href? }[]`, `importLine` absent when no `package.json` `exports` entry maps the file), `data.styleEntry` (the file's symbol table entry) and `data.depth` |
| `design-tokens.js` | Design tokens page, `design-tokens.html` (root). Receives the main data plus `data.groups = { name, id, tokens: { id, name, type, defaultValue, description, deprecated, file, href? }[] }[]` (default group first, then by name; `id` is the anchor, `group-<slug>` / `token-<name>`, `href` links the defining file's style page) and `data.depth` (always `0`). Only generated when a style file that themes no symbol has documented tokens |
| `api-reference.js` | Single-page exhaustive symbol portal at `references.html`. Only emitted under `menuLayout: 'feature'`. Sections come from the feature model on `data.semantic.features`, one per feature, keyed by the feature's page path (`forms/select`, `forms/select/menu`) |
| `app-config.js` | Application configuration page, `app-config.html` (root). Receives the main data plus `data.appConfig = { name, file, description?, providers: { name, features }[], since?, zoneless? }[]` (one entry per `ApplicationConfig`) |
| `menu.js` | Sidebar navigation menu. Receives the main data, including `data.menuLayout`, the symbol table (`data.symbols`) and the feature model (`data.semantic.features`) |
| `version-switcher.js` | Topbar version-switcher dropdown (multi-version mode only). Receives the manifest URL and current label |

Block-level overrides replace a region inside a page rather than the whole page:

| File name | Overrides |
|-|-|
| `block-theming.js` | Whole Theming tab panel. Receives `{ groups, styleSources, overview, depth }` where `groups` is an array of `{ name, tokens }` buckets, `styleSources` is `{ file, content, language }[]`, and `overview` is the concatenated `@overview` markdown. Also receives `mixins` (`StyleMixin[]`, the documented SCSS mixins and functions) and `linked` (the style files linked with `@themes`, as `{ label, href? }[]`, `href` set when the file has a page), each only when non-empty |
| `block-theming-token.js` | Single token row inside the Theming tab. Receives `{ token, depth }` where `token` is a `ThemeToken` (`name`, `kind`, `type`, `defaultValue`, `description`, `group`, `examples`, `since`, `deprecated`, `see`, `relatedTo`, `file`, `line`). When the token has `@relatedTo`, also receives `related`, the resolved names as `{ name, href? }[]` (no `href` when the name resolves to nothing). Replace this when you want custom row chrome but the rest of the panel can stay default |
| `block-theming-mixin.js` | Single documented SCSS mixin or function in the Mixins section (Theming tab and style page). Receives `{ mixin, depth, related }` where `mixin` is a `StyleMixin` (`name`, `kind` (`'mixin'` or `'function'`), `params` (`{ name, default, description, type }[]`, names without `$`), `description`, `content` (the `@content` text, `null` without the tag), `returns`, `examples`, `since`, `deprecated`, `see`, `relatedTo`, `file`, `line`) and `related` holds its resolved `@relatedTo` names as `{ name, href? }[]` |
| `block-routed-at.js` | "Routed at" on component pages and "Mounted at" on route array variable pages. Receives `{ id, title, links }`, `links` as `{ label, href }[]` (the full path and its row on the routes page) |
| `block-method.js` | Methods section on the API tab |
| `block-property.js` | Properties section on the API tab |
| `block-input.js` | Inputs section on the API tab |
| `block-output.js` | Outputs section on the API tab |
| `block-accessors.js` | Accessors section on the API tab |
| `block-host-listener.js` / `block-host-listeners.js` | Single host listener / host listeners section |
| `block-host-bindings.js` | Host bindings section |
| `block-derived-state.js` | Derived state (`computed` / `linkedSignal`) section |
| `block-constructor.js` | Constructor section |
| `block-enum.js` | Enum members block on enumeration detail pages |
| `block-typealias.js` | Type alias definition block on typealias detail pages |
| `block-index.js` | Index grid on the API tab |
| `block-index-signatures.js` | Index signatures section |
| `block-playground.js` | Whole Playground tab panel |
| `playground-content.js` | Single playground block (one `@playground` block) inside the Playground tab |
| `referenced-by.js` | "Used by" chip list on symbol pages: the declarations that use the symbol, from the project analysis. Receives `{ entries: { name, kind, hrefPrefix }[], depth }` (v0.6.0+) |

## Available helpers

The second argument passed to your template function contains all built-in helpers:

```js
module.exports = function(data, helpers) {
    // Translation
    helpers.t('key')                    // translate an i18n key

    // Type resolution and links
    helpers.linkTypeHtml('MyService', { depth: data.depth })  // <code><a href="...">MyService</a></code>
    helpers.resolveType('MyService', undefined, data.depth)   // { href, raw, target, kind } or null

    // Descriptions with @link resolution
    helpers.parseDescription(text, depth)

    // Function/method signatures with type links
    helpers.functionSignature(methodObj, data.depth)

    // JSDoc extraction
    helpers.extractJsdocParams(jsdocTags)      // @param tags as structured objects
    helpers.extractJsdocCodeExamples(jsdocTags) // @example tags with code fence parsing
    helpers.jsdocReturnsComment(jsdocTags)      // @returns comment string
    helpers.hasJsdocParams(jsdocTags)           // boolean: has @param tags?

    // Modifier display
    helpers.modifKind(syntaxKind)       // "Private", "Static", etc.
    helpers.modifIcon(syntaxKind)       // "lock", "reset", etc.

    // Tab/section checks
    helpers.isTabEnabled(navTabs, 'info')
    helpers.isInitialTab(navTabs, 'info')
    helpers.isInfoSection('methods')

    // Utilities
    helpers.capitalize('text')
    helpers.relativeUrl(depth)
    helpers.shortUrl('src/app/foo/bar.ts')
    helpers.indexableSignature(method)
    helpers.oneParameterHas(tags, 'type')
    helpers.parseProperty(value)
};
```

## Data object

Pages sit at different depths: symbol pages live in the folder of their feature (`forms/select/SelectPanel.html` is depth 2), feature pages are `index.html` in that folder, root pages are depth 0. Build every relative link from `data.depth` (`helpers.relativeUrl(data.depth, 'index.html')`) and pass it to the type-link helpers; never assume a page is one folder deep.

The `data` object contains the full page context. Its shape depends on the page type. Common fields:

```js
data.context              // page type: 'component', 'directive', etc.
data.depth                // folder depth of the page: 0 at the root, one per folder (a page in forms/select/ is 2)
data.navTabs              // available tabs for this page
data.documentationMainName // project name
data.disableFilePath      // boolean: hide file paths?
```

Entity pages (component, directive, class, etc.) have the entity data under their type key:

```js
data.component.name       // component name
data.component.file       // source file path
data.component.selector   // CSS selector
data.component.description // description HTML
data.component.methods    // method list
data.component.properties // property list
data.component.sourceCode // source code string
// ... etc.
```

For the menu override, `data` contains the full main data with all components, directives, etc. `data.menuLayout` reflects the configured sidebar layout (`'feature'` or `'type'`); the feature model (`data.semantic.features`: features, `featureOf` by symbol, family links) drives both.

## Migrating from Handlebars templates

If you have existing `.hbs` custom templates, convert them to `.js`:

### Syntax mapping

| Handlebars | JavaScript |
|-|-|
| `{{variable}}` | `${data.variable}` |
| `{{{rawHtml}}}` | `${data.rawHtml}` |
| `{{#if x}}...{{/if}}` | `${x ? \`...\` : ''}` |
| `{{#unless x}}...{{/unless}}` | `${!x ? \`...\` : ''}` |
| `{{#each items}}...{{/each}}` | `${items.map(item => \`...\`).join('')}` |
| `{{t "key"}}` | `${helpers.t('key')}` |
| `{{> link-type type=x}}` | `${helpers.linkTypeHtml(x, { depth: data.depth })}` |
| `{{parseDescription desc depth}}` | `${helpers.parseDescription(desc, depth)}` |
| `{{{functionSignature method}}}` | `${helpers.functionSignature(method, data.depth)}` |
| `{{#compare a "===" b}}...{{/compare}}` | `${a === b ? \`...\` : ''}` |
| `{{modifKind kind}}` | `${helpers.modifKind(kind)}` |

### Step-by-step

1. Rename `.hbs` files to `.js`
2. Wrap content in `module.exports = function(data, helpers) { return \`...\`; };`
3. Replace `{{variable}}` with `${data.variable}` (or the appropriate entity key like `data.component.variable`)
4. Replace Handlebars helpers with `helpers.*` calls
5. Replace `{{#if}}` / `{{#each}}` blocks with JavaScript ternaries and `.map()`
6. Note: `component-detail.hbs` is now `component.js` (the detail partial was merged into the page)

### Example

Before (`component-detail.hbs`):
```handlebars
{{#if component.selector}}
<h3>Selector</h3>
<code>{{component.selector}}</code>
{{/if}}

{{#if component.description}}
<h3>Description</h3>
{{{parseDescription component.description depth}}}
{{/if}}
```

After (`component.js`):
```js
module.exports = function(data, helpers) {
    const c = data.component;
    let html = '';

    if (c.selector) {
        html += `<h3>Selector</h3><code>${c.selector}</code>`;
    }

    if (c.description) {
        html += `<h3>Description</h3>${helpers.parseDescription(c.description, data.depth)}`;
    }

    return html;
};
```
