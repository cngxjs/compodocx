# Additional pages

compodocx can ship hand-written Markdown pages alongside the API reference it generates from your source. These are plain `.md` files you author yourself - guides, tutorials, architecture notes, getting-started sections, or migration notes. compodocx renders them as pages with their own sidebar section.

## How it works

You point the CLI at a folder of Markdown files and a table of contents (`summary.json`). For each entry in the TOC, compodocx reads the referenced Markdown file, renders it to HTML using the same Markdown pipeline as JSDoc descriptions, and writes a standalone page under `<output>/additional-documentation/<slug>.html`. The sidebar gets a new top-level group listing those pages in the order and hierarchy defined by `summary.json`.

Four CLI flags drive it:

| Flag | Purpose | Default |
|-|-|-|
| `--includes <path>` | Folder containing `summary.json` and the referenced Markdown files | - (feature off) |
| `--includesName <name>` | Sidebar group label | `Additional documentation` |
| `--includesLabels <path>` | JSON file with a sidebar label and a title per page slug (see [Labels and titles from a file](#labels-and-titles-from-a-file)) | - |
| `--includesTooltips` | Show each page's subtitle (or its `tooltip` key) as the tooltip of its sidebar link (see [Link tooltips](#link-tooltips)) | `false` |

All four can also be set via the config file (any name from [Configuration](configuration.md), for example `.compodocxrc.json`, `compodocx.config.js` or the `compodocx` key in `package.json`) as `includes` / `includesName` / `includesLabels` / `includesTooltips`.

## File layout

Everything lives under one folder - convention is `additional-doc/` next to your `tsconfig.json`, but it can be anywhere:

```text
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

The `--includes` folder can be absolute or relative to the working directory. Set in a config file (`includes`), a relative folder is resolved against the folder of that config file, also when it is passed with `-c` from another folder (see [Paths in a config file](configuration.md#paths-in-a-config-file)). Paths inside `summary.json` are resolved relative to the includes folder.

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

All fields are optional, so existing `summary.json` files keep working unchanged. A node without `file` gets no page; its slug still forms the folder of its children. On the first level such a node becomes a group in the sidebar: its label opens and closes the list of the pages below it, without a link. Deeper down it adds no sidebar entry, and its pages are listed under its first-level ancestor.

```json
[
    { "title": "Getting Started", "file": "getting-started.md" },
    {
        "title": "Guides",
        "children": [{ "title": "Signals", "file": "guides/signals.md" }]
    }
]
```

Here "Guides" is a group without a page, and the page is written to `additional-documentation/guides/signals.html`.

| Field | Type | Meaning | Default |
|-|-|-|-|
| `file` | string | Markdown file, relative to the `--includes` folder | none (no page) |
| `title` | string | Page title (browser tab) and the source of the derived slug | taken from the labels file; required when there is no `slug` |
| `slug` | string | The last segment of the page URL; for the node's children it is also the folder segment | the `title`, lowercased, spaces replaced by `-` |
| `label` | string | Sidebar text | the labels file, then the title |
| `heading` | boolean | `true` renders the title as an `<h1>` above the Markdown | `false` |
| `tooltip` | string | Tooltip of the sidebar link with `includesTooltips`; `""` turns it off for this node | the labels file, then the page's subtitle |
| `aliases` | string[] | Old page paths this page replaces, see [Renaming a page with an alias](#renaming-a-page-with-an-alias) | none |

Rules:

- A `slug` matches `^[a-z0-9][a-z0-9._-]*$`: lowercase ASCII letters, digits, `.`, `_` and `-`, starting with a letter or digit, and at most 200 characters long. It is one path segment, so it cannot contain `/`.
- The slug is the last segment of the page URL only. The slugs of the ancestors form the folder, so a page keeps its URL when its ancestors are renamed only if every ancestor has a `slug` too. A node with a `slug` whose parent has none logs a warning: `Additional pages: summary.json<path> has a slug but its parent summary.json<path> has none; renaming the parent moves this page`.
- The derived slug always comes from the node's own `title`. A title from the labels file never moves a URL.
- Two pages, or a page and an alias, that end up at the same path stop the build. Paths are compared after Unicode (NFC) normalization and lower-casing, so a title with a precomposed `é` and one with `e` plus a combining accent collide.
- An alias is a full path below `additional-documentation/` without `.html`, for example `errors/e0001-old-name`. Each segment follows the slug rules (pattern and length).

## Writing the Markdown

The files are plain Markdown rendered by [`marked`](https://marked.js.org/). You have the normal toolbox: headings, paragraphs, lists, tables, fenced code blocks with language hints (Shiki-highlighted), block quotes, inline code, links, and images. Relative image paths resolve against the generated page's directory, so referencing images is easiest via absolute or external URLs.

A page whose first line is `<!-- @aiGenerated -->` or `<!-- @aiGenerated <value> -->` (a model name, a date) gets a banner above its content: an "AI generated" chip and the sentence "Drafted with AI assistance (<value>).". `@ai` and `@aigen` work as well. A value of `key=value` pairs (`<!-- @aiGenerated model=example-model date=2026-05 -->`) shows its values joined by `, `. The same marker works as the first line of the root Markdown files (README, CHANGELOG, ...) and of a README next to a source file, shown in the symbol's README tab. `--hideAiGeneratedBadge` hides every banner. The `aiGeneratedNote` config key replaces the sentence, with `{value}` standing for the marker value and `{model}`, `{date}` or any other `{key}` for a field of a `key=value` value. A marker with none of the named fields gets the default sentence:

```json
{ "aiGeneratedNote": "Drafted with AI assistance ({value}) and reviewed by a maintainer." }
```

JSDoc-style `{@link Target}` references also work - compodocx resolves them against the project's symbol index, so a guide page can link to `{@link UserService}` and land the reader on the generated service page.

### Links between pages

Link to another page with a relative link to its Markdown file, as you would on GitHub: `[Signals](./signals.md)`, `[Migration](advanced/migration.md#steps)` or `[Back](../overview.md)`. The path is resolved against the folder of the file the link is written in; a link starting with `/` is resolved against the `--includes` folder. When the target is the `file` of a page in `summary.json`, the link points at that page (its current URL, also when the page has aliases), anchor kept. The README works the same way, and a page can link to `README.md`, `CHANGELOG.md` and the other root files in the working directory.

The same works in the documentation of your code. In a JSDoc comment, `{@link ./guides/signals.md}` (or `{@link ../../docs/guide.md#setup|Setup}`) is resolved against the folder of the `.ts` file, and so is a Markdown link in the README next to it (`foo.component.md`, the README tab); `/...` again starts at the `--includes` folder. Besides additional pages and the root files, a link can point at the README of another symbol (its symbol page) or of a feature folder (its feature page). The README of a feature folder works the same way, resolved against its own folder; the short summary of a sub-feature shows such a link as plain text. Pages built from several files (dependency injection clusters, overviews) resolve only links starting with `/`.

A `.md` link whose file has no page (not in `summary.json`, missing, or a group without a page) is left as written; the build continues. After all pages are written, one warning gives the count, `Markdown links: <n> links to .md files without a page (--verbose lists them)`, and `--verbose` lists each link once as `<file>: <target>`, paths relative to the working directory. External URLs and `#anchor` links are not touched.

Example (trimmed from `getting-started.md`):

````markdown
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
````

## Output URLs

For a node titled `Getting Started` referencing `getting-started.md`, compodocx writes:

```text
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
    "e0002": { "label": "E0002: Value changed", "tooltip": "A bound value changed during the check" }
}
```

```bash
compodocx -p tsconfig.json --includes ./additional-doc --includesLabels ./labels.json
```

Or `"includesLabels": "./labels.json"` in the config file. The path is resolved like `--includes`, and the file is only read when `includes` is set. A node can then omit `title` and `label`:

```json
{ "slug": "e0001", "file": "errors/e0001.md" }
```

Precedence for each value (`label`, `title` and `tooltip`) is: the node, then the labels file, then the default (the label defaults to the title, the tooltip to the subtitle, see [Link tooltips](#link-tooltips)). A node with a `slug` but no title anywhere is an error. The key is the page's slug, that is the last segment of its path.

- A key that matches no page logs `Additional pages: labels file <path>: key "<key>" matches no page` and the build continues, so one manifest can serve several documentation sets.
- A key that matches several pages (the same last segment in different folders) stops the build and names all matches.

### Opt-in heading

The sidebar shows the label, the browser tab shows the title, and the page body is your Markdown. If the Markdown has no top-level heading, let compodocx render the title:

```json
{ "title": "Value changed", "label": "E0002: Value changed", "slug": "e0002", "heading": true, "file": "errors/e0002.md" }
```

The page then starts with `<h1>Value changed</h1>` (escaped) before the Markdown. Without `heading: true` nothing is added.

### Link tooltips

With `--includesTooltips` (or `"includesTooltips": true`) each sidebar link of an additional page gets a tooltip: its subtitle, the heading that directly follows the page's first-level heading. Blank lines and HTML comments (such as the `<!-- @aiGenerated -->` marker) before the first heading and blank lines between the two headings are skipped. Inline code, emphasis and links count with their text, images and inline HTML are left out.

```markdown
# E0100

## Unknown option

The option name is not recognised.
```

The link to this page shows "Unknown option" on hover. A page with a paragraph between its first two headings, or one that does not start with a first-level heading, has no subtitle:

```markdown
# Guide

A short walk through the setup.

## Install
```

- A `tooltip` key on the node or in the labels file sets the text instead; `""` turns the tooltip off for that page.
- No tooltip is shown when its text is already part of the link text (case and spacing ignored), so `"label": "E0101: Value out of range"` with the subtitle "Value out of range" gets none.
- A heading that only starts the first section (`# API Reference` followed by `## Services`) becomes a tooltip too. Set `"tooltip": ""` on such a page.
- The tooltip is the link's `title` attribute. Browsers do not show it on keyboard focus or touch, so put the words that tell the pages apart into the `label`.
- Without the flag no tooltip is rendered, and `tooltip` keys are ignored with one line in the log: `Additional pages: <n> tooltip key(s) ignored, enable includesTooltips`.

Tooltips are not part of the JSON and llm-md exports.

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
- removes the redirect page again on the next build into the same output folder once the alias is removed or renamed, but only if the file is still exactly as compodocx wrote it; a page or a hand-edited file at that path is kept.

The redirect page is not in the sidebar and not in the search index.

### Two languages, one set of URLs

Keep one `summary.json` per language and give every node, ancestors included, the same slugs and files:

```text
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

compodocx logs `Additional documentation: summary.json file found` during generation and then `Process additional pages` once the Markdown files are rendered. If `summary.json` is missing or unreadable the feature is silently skipped; if the folder itself does not exist, compodocx warns `Additional pages: includes folder <absolute path> not found, no pages added` and the build exits with code 0. A page whose `file` does not exist is skipped with the warning `Additional pages: summary.json<path> (<file>) not found, page skipped`, together with its aliases, and the build exits with code 0; the pages below it are kept, under a group as for a node without `file` when the skipped page is on the first level. Entries that are malformed (a non-string `title` or `file`, a non-array `children`, a `null` entry) are skipped as well.

## Exports

With `--exportFormat json` the pages are written to the top-level `additionalPages` list of `documentation.json`: slug path, title, label (when it differs from the title), source file, the Markdown as written and the children. A sidebar group is not an entry of its own: its pages take its place in the list and keep the group's segment in their slug (`guides/signals`). With `--exportFormat llm-md` they form one section named after `includesName`, each page under its title with its own headings moved one level below it. Aliases and page URLs are not exported, and `compodocx diff` does not compare the pages. See [Semantic fields in the JSON export](configuration.md#semantic-fields-in-the-json-export).

## Errors

These problems stop the build with exit code 1. The message names the position in `summary.json` and the file, `summary.json[1].children[0]` for example.

| Message | Cause |
|-|-|
| `Additional pages: invalid slug "<slug>" at summary.json<path> (<file>); expected one segment of at most 200 characters matching ^[a-z0-9][a-z0-9._-]*$` | The `slug` is not a string or does not match the pattern or is longer than 200 characters |
| `Additional pages: invalid alias "<alias>" at summary.json<path> (<file>); each segment must have at most 200 characters and match ^[a-z0-9][a-z0-9._-]*$` | An alias is not a string or a segment does not match the pattern or is longer than 200 characters |
| `Additional pages: alias "<alias>" at summary.json<path> (<file>) is the path of its own page` | An alias equals the path of the page it belongs to |
| `Additional pages: no title for summary.json<path> (<file>); set "title" on the node or in the labels file` | A node with a `slug` has no title on the node and none in the labels file |
| `Additional pages: "<path>.html" is claimed by summary.json<path> (<file>) and summary.json<path> (<file>)` | Two pages, or a page and an alias (the alias side is marked `as alias`), end up at the same path |
| `Additional pages: labels file <path>: <reason>` | The labels file is unreadable, not valid JSON, not an object, has an entry that is not an object, or has a `label`, `title` or `tooltip` that is not a string |
| `Additional pages: labels file <path>: key "<key>" matches several pages: ...` | A labels key matches more than one page |

## What you cannot do

- Link to additional pages from a custom template without knowing the slug - there is no helper for resolving a title to its output URL yet. Set an explicit `slug` and the URL is known up front.
- Move the output folder - pages always live below `additional-documentation/`.
- Set a fixed URL through the labels file - it feeds label and title only, never the path.
- Change the Markdown pipeline per page - it is the same `marked` instance used for JSDoc.
- Interleave additional pages inside the API groups - they live in their own sidebar section. This holds under both `menuLayout: 'feature'` (default) and `menuLayout: 'type'`: the Features chapter only mixes code entities, never additional pages.
