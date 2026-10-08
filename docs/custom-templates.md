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
| `token.js` | `InjectionToken` / `HttpContextToken` detail page at `tokens/<name>.html` (v0.6.0+) |
| `routes.js` | Routes page |
| `markdown.js` | Markdown pages (readme, changelog, etc.) |
| `additional-page.js` | Additional documentation pages |
| `coverage-report.js` | Documentation coverage report |
| `unit-test-report.js` | Unit test coverage report |
| `package-dependencies.js` | Package dependencies page |
| `package-properties.js` | Package properties page |
| `utilities.js` | Utilities landing page, `utilities.html`: functions, constants, type aliases and enumerations in four groups |
| `function.js` | Function page at `functions/<name>.html`. Receives `data.function` |
| `variable.js` | Constant page at `variables/<name>.html`. Receives `data.variable` |
| `typealias.js` | Type alias page at `typealiases/<name>.html`. Receives `data.typealias` |
| `enumeration.js` | Enumeration page at `enumerations/<name>.html`. Receives `data.enumeration` |
| `resolver.js` | Functional resolver page at `resolvers/<name>.html`. Receives `data.resolver` |
| `dependency-injection.js` | Dependency Injection landing page, `dependency-injection.html`: feature types with their providers and feature functions, other providers, tokens |
| `di-cluster.js` | Page of a feature type at `providers/<FeatureType>.html`. Receives `data.cluster = { featureType, providers, features, tokens }`, each list holding the same entity objects the symbol pages get. Member sections use the anchor `<FeatureType>--<name>`. A provider without a feature type (`providers/<name>.html`) has no override of its own |
| `bucket-landing.js` | Auto-generated landing page per `@category` / folder bucket at `categories/<bucket-id>.html`. Only emitted under `menuLayout: 'feature'`. Receives `data.bucketLanding = { bucket, segments, depth, items }` (v0.6.0+) |
| `api-reference.js` | Single-page exhaustive symbol portal at `references.html`. Only emitted under `menuLayout: 'feature'`. Receives `data.categorizedByFeature` (the EXHAUSTIVE per-bucket dict, not the curated primary subset) (v0.6.0+) |
| `app-config.js` | Application configuration page |
| `menu.js` | Sidebar navigation menu. Under `menuLayout: 'feature'` also receives `data.menuLayout`, `data.categorizedByFeature` (legacy flat), `data.categorizedByFeaturePrimary` (curated Features chapter), `data.categorizedByFeatureReference` (exhaustive per-bucket reference dict), `data.featuresName`, `data.referencesName` |
| `version-switcher.js` | Topbar version-switcher dropdown (multi-version mode only). Receives the manifest URL and current label |

Block-level overrides replace a region inside a page rather than the whole page:

| File name | Overrides |
|-|-|
| `block-theming.js` | Whole Theming tab panel. Receives `{ groups, styleSources, overview, depth }` where `groups` is an array of `{ name, tokens }` buckets, `styleSources` is `{ file, content, language }[]`, and `overview` is the concatenated `@overview` markdown |
| `block-theming-token.js` | Single token row inside the Theming tab. Receives `{ token, depth }` where `token` is a `ThemeToken` (`name`, `kind`, `type`, `defaultValue`, `description`, `group`, `examples`, `since`, `deprecated`, `see`, `file`, `line`). Replace this when you want custom row chrome but the rest of the panel can stay default |
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
    helpers.linkTypeHtml('MyService')   // renders <code><a href="...">MyService</a></code>
    helpers.resolveType('MyService')    // returns { href, raw, target } or null

    // Descriptions with @link resolution
    helpers.parseDescription(text, depth)

    // Function/method signatures with type links
    helpers.functionSignature(methodObj)

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

The `data` object contains the full page context. Its shape depends on the page type. Common fields:

```js
data.context              // page type: 'component', 'directive', etc.
data.depth                // nesting depth (0 = root, 1 = one level deep)
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

For the menu override, `data` contains the full main data with all modules, components, directives, etc. `data.menuLayout` reflects the configured sidebar layout (`'type'` or `'feature'`); when `'feature'`, `data.categorizedByFeature` is a `Record<string, EntityWithKind[]>` keyed by folder/`@category`, where each item carries `kind` (e.g. `'component'`, `'directive'`, `'injectable'`) and `hrefPrefix` (the URL segment for its detail page). A `menu.js` override that wants to honor the feature layout can branch on `data.menuLayout` and render either the per-kind chapters or the cross-kind feature tree.

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
| `{{> link-type type=x}}` | `${helpers.linkTypeHtml(x)}` |
| `{{parseDescription desc depth}}` | `${helpers.parseDescription(desc, depth)}` |
| `{{{functionSignature method}}}` | `${helpers.functionSignature(method)}` |
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
