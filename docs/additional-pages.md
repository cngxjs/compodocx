# Additional pages

compodocx can ship hand-written Markdown pages alongside the API reference it generates from your source. These are plain `.md` files you author yourself - guides, tutorials, architecture notes, getting-started sections, migration docs, whatever - and compodocx renders them as first-class pages in the output site with their own sidebar section.

The feature is built into compodocx itself, covered by the project's MIT license. There is no separate extension, paid tier, or service involved; if you can run the CLI you already have it.

## How it works

You point the CLI at a folder of Markdown files and a table of contents (`summary.json`). For each entry in the TOC, compodocx reads the referenced Markdown file, renders it to HTML using the same Markdown pipeline as JSDoc descriptions, and writes a standalone page under `<output>/additional-documentation/<slug>.html`. The sidebar gets a new top-level group listing those pages in the order and hierarchy defined by `summary.json`.

Two CLI flags drive it:

| Flag | Purpose | Default |
|-|-|-|
| `--includes <path>` | Folder containing `summary.json` and the referenced Markdown files | - (feature off) |
| `--includesName <name>` | Sidebar group label | `Additional documentation` |
| `--includesLabels <path>` | JSON file with a sidebar label and a title per page slug (see [Labels and titles from a file](#labels-and-titles-from-a-file)) | - |

All three can also be set via the config file (`.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml`, or the `compodocx` property in `package.json`) as `includes` / `includesName` / `includesLabels`.

## File layout

Everything lives under one folder - convention is `additional-doc/` next to your `tsconfig.json`, but it can be anywhere:

```
additional-doc/
  summary.json
  getting-started.md
  guides/
    overview.md
    signals.md
    providers.md
    advanced/
      overview.md
      migration.md
  api/
    api-reference.md
```

Paths inside `summary.json` are resolved relative to the folder passed to `--includes`.

## `summary.json` schema

An ordered array of nodes. Each node has a `title` (the sidebar label and the page title shown in the browser tab) and a `file` (path to a Markdown file). The heading on the page comes from your Markdown, unless you set `heading: true` on the node. Nodes can nest via `children` up to five levels deep.

```json
[
    {
        "title": "Getting Started",
        "file": "getting-started.md"
    },
    {
        "title": "Guides",
        "file": "guides/overview.md",
        "children": [
            { "title": "Signals & Reactivity", "file": "guides/signals.md" },
            { "title": "Functional Providers", "file": "guides/providers.md" },
            {
                "title": "Advanced",
                "file": "guides/advanced/overview.md",
                "children": [
                    { "title": "Migration from NgModules", "file": "guides/advanced/migration.md" }
                ]
            }
        ]
    },
    { "title": "API Reference", "file": "api/api-reference.md" }
]
```

A node's order in the array is its order in the sidebar. The first level shows up as expandable groups; deeper levels collapse into sub-lists under their parent. A node nested deeper than 5 levels is skipped: compodocx logs `Only 5 levels of depth are supported` and the build continues without that page.

### Node fields

All fields are optional, so existing `summary.json` files keep working unchanged. A node without `file` gets no page; its slug still forms the folder of its children.

| Field | Type | Meaning | Default |
|-|-|-|-|
| `file` | string | Markdown file, relative to the `--includes` folder | none (no page) |
| `title` | string | Page title (browser tab) and the source of the derived slug | taken from the labels file; required when there is no `slug` |
| `slug` | string | The last segment of the page URL; for the node's children it is also the folder segment | the `title`, lowercased, spaces replaced by `-` |
| `label` | string | Sidebar text | the labels file, then the title |
| `heading` | boolean | `true` renders the title as an `<h1>` above the Markdown | `false` |
| `aliases` | string[] | Old page paths this page replaces, see [Renaming a page with an alias](#renaming-a-page-with-an-alias) | none |

Rules:

- A `slug` matches `^[a-z0-9][a-z0-9._-]*$`: lowercase ASCII letters, digits, `.`, `_` and `-`, starting with a letter or digit, and at most 200 characters long. It is one path segment, so it cannot contain `/`.
- The slug is the last segment of the page URL only. The slugs of the ancestors form the folder, so a page keeps its URL when its ancestors are renamed only if every ancestor has a `slug` too. A node with a `slug` whose parent has none logs a warning: `Additional pages: summary.json<path> has a slug but its parent summary.json<path> has none; renaming the parent moves this page`.
- The derived slug always comes from the node's own `title`. A title from the labels file never moves a URL.
- Two pages, or a page and an alias, that end up at the same path stop the build. Paths are compared after Unicode (NFC) normalization and lower-casing, so a title with a precomposed `é` and one with `e` plus a combining accent collide.
- An alias is a full path below `additional-documentation/` without `.html`, for example `errors/e0001-old-name`. Each segment follows the slug rules (pattern and length).

## Writing the Markdown

The files are plain Markdown rendered by [`marked`](https://marked.js.org/). You have the normal toolbox: headings, paragraphs, lists, tables, fenced code blocks with language hints (Shiki-highlighted), block quotes, inline code, links, and images. Relative image paths resolve against the generated page's directory, so referencing images is easiest via absolute or external URLs.

JSDoc-style `{@link Target}` references also work - compodocx resolves them against the project's symbol index, so a guide page can link to `{@link UserService}` and land the reader on the generated service page.

Example (trimmed from `getting-started.md`):

```markdown
# Getting Started

Welcome to the **Kitchen Sink Standalone** demo - a modern Angular app with no NgModules.

## Prerequisites

| Requirement | Version |
|-|-|
| Node.js | >= 22 |
| Angular | 21+ |

## Installation

```bash
npm install
ng serve
```
```

## Output URLs

For a node titled `Getting Started` referencing `getting-started.md`, compodocx writes:

```
<output>/additional-documentation/getting-started.html
```

The slug is the title lowercased with every space replaced by `-`; other characters are kept. Nested pages under `guides/` land at `additional-documentation/guides/signals-&-reactivity.html` (title `Signals & Reactivity`) and so on - the folder tree in output mirrors the parent titles in `summary.json`, not the source filenames.

With an explicit `slug` the URL no longer depends on the wording. A node with `"slug": "errors"` and a child with `"slug": "e0001"` is written to `additional-documentation/errors/e0001.html`, whatever the titles are.

## Examples

### Fixed URL with a slug

```json
[
    {
        "title": "Error reference",
        "slug": "errors",
        "file": "errors/index.md",
        "children": [
            { "title": "Expression changed", "slug": "e0001", "file": "errors/e0001.md" }
        ]
    }
]
```

The pages are `additional-documentation/errors.html` and `additional-documentation/errors/e0001.html`. Reword either title later and the URLs stay. The parent has a slug as well; without it the folder would follow the parent's title.

### Labels and titles from a file

When the sidebar text comes from a generated manifest, keep it out of `summary.json`. The labels file is keyed by slug:

```json
{
    "e0001": {
        "label": "E0001: Expression changed",
        "title": "Expression changed after it was checked"
    },
    "e0002": { "label": "E0002: Value changed" }
}
```

```bash
compodocx -p tsconfig.json --includes ./additional-doc --includesLabels ./labels.json
```

Or `"includesLabels": "./labels.json"` in the config file. The path is resolved like `--includes`, and the file is only read when `includes` is set. A node can then omit `title` and `label`:

```json
{ "slug": "e0001", "file": "errors/e0001.md" }
```

Precedence for both values is: the node, then the labels file, then the default (the label defaults to the title). A node with a `slug` but no title anywhere is an error. The key is the page's slug, that is the last segment of its path.

- A key that matches no page logs `Additional pages: labels file <path>: key "<key>" matches no page` and the build continues, so one manifest can serve several documentation sets.
- A key that matches several pages (the same last segment in different folders) stops the build and names all matches.

### Opt-in heading

The sidebar shows the label, the browser tab shows the title, and the page body is your Markdown. If the Markdown has no top-level heading, let compodocx render the title:

```json
{ "title": "Value changed", "label": "E0002: Value changed", "slug": "e0002", "heading": true, "file": "errors/e0002.md" }
```

The page then starts with `<h1>Value changed</h1>` (escaped) before the Markdown. Without `heading: true` nothing is added.

### Renaming a page with an alias

When a page moves, list its old path so existing links keep working:

```json
{
    "title": "Renamed page",
    "slug": "e0003",
    "aliases": ["errors/e0003-old-name"],
    "file": "errors/e0003.md"
}
```

For each alias compodocx:

- writes a small redirect page at `additional-documentation/errors/e0003-old-name.html` that points to the new page (with a `canonical` link and `noindex`),
- adds an entry for it to `redirects.json`, which the version switcher reads,
- rewrites hand-written links to the old path in your Markdown, including relative links from a page inside a redirected folder.

The redirect page is not in the sidebar and not in the search index.

### Two languages, one set of URLs

Keep one `summary.json` per language and give every node, ancestors included, the same slugs and files:

```
additional-doc/
  en/summary.json
  de/summary.json
```

```json
[
    {
        "title": "Fehlerreferenz",
        "slug": "errors",
        "file": "errors/index.md",
        "children": [
            {
                "title": "Ausdruck geaendert",
                "label": "E0001: Ausdruck geaendert",
                "slug": "e0001",
                "file": "errors/e0001.md"
            }
        ]
    }
]
```

Build once per language with `--includes ./additional-doc/de` and `--includes ./additional-doc/en`. Both builds produce the same page paths with different titles and labels. Without a slug on `errors`, the German folder would be derived from "Fehlerreferenz" and differ from the English one.

## Running it

```bash
compodocx -p tsconfig.json \
    --includes ./additional-doc \
    --includesName "Guides"
```

Config-file equivalent:

```json
{
    "includes": "./additional-doc",
    "includesName": "Guides"
}
```

compodocx logs `Additional documentation: summary.json file found` during generation and then `Process additional pages` once the Markdown files are rendered. If `summary.json` is missing or unreadable the feature is silently skipped; if it parses but references a missing file, that page is skipped with a warning. Entries that are malformed (a non-string `title` or `file`, a non-array `children`, a `null` entry) are skipped as well.

## Exports

With `--exportFormat json` the pages are written to the top-level `additionalPages` list of `documentation.json`: slug path, title, label (when it differs from the title), source file, the Markdown as written and the children. With `--exportFormat llm-md` they form one section named after `includesName`, each page under its title with its own headings moved one level below it. Aliases and page URLs are not exported, and `compodocx diff` does not compare the pages. See [Semantic fields in the JSON export](configuration.md#semantic-fields-in-the-json-export).

## Errors

These problems stop the build with exit code 1. The message names the position in `summary.json` and the file, `summary.json[1].children[0]` for example.

| Message | Cause |
|-|-|
| `Additional pages: invalid slug "<slug>" at summary.json<path> (<file>); expected one segment of at most 200 characters matching ^[a-z0-9][a-z0-9._-]*$` | The `slug` is not a string or does not match the pattern or is longer than 200 characters |
| `Additional pages: invalid alias "<alias>" at summary.json<path> (<file>); each segment must have at most 200 characters and match ^[a-z0-9][a-z0-9._-]*$` | An alias is not a string or a segment does not match the pattern or is longer than 200 characters |
| `Additional pages: alias "<alias>" at summary.json<path> (<file>) is the path of its own page` | An alias equals the path of the page it belongs to |
| `Additional pages: no title for summary.json<path> (<file>); set "title" on the node or in the labels file` | A node with a `slug` has no title on the node and none in the labels file |
| `Additional pages: "<path>.html" is claimed by summary.json<path> (<file>) and summary.json<path> (<file>)` | Two pages, or a page and an alias (the alias side is marked `as alias`), end up at the same path |
| `Additional pages: labels file <path>: <reason>` | The labels file is unreadable, not valid JSON, not an object, has an entry that is not an object, or has a `label` or `title` that is not a string |
| `Additional pages: labels file <path>: key "<key>" matches several pages: ...` | A labels key matches more than one page |

## What you cannot do

- Link to additional pages from a custom template without knowing the slug - there is no helper for resolving a title to its output URL yet. Set an explicit `slug` and the URL is known up front.
- Move the output folder - pages always live below `additional-documentation/`.
- Set a fixed URL through the labels file - it feeds label and title only, never the path.
- Change the Markdown pipeline per page - it is the same `marked` instance used for JSDoc.
- Interleave additional pages inside the API groups - they live in their own sidebar section. This holds under both `menuLayout: 'feature'` (default) and `menuLayout: 'type'`: the Features chapter only mixes code entities, never additional pages.

## Licensing

compodocx is MIT-licensed. The additional-pages feature is part of the CLI; nothing you produce with it is encumbered by compodocx, and nothing about enabling it changes the licensing of the generated site. Ship it wherever you like.
