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

Both can also be set via the config file (`.compodocxrc`, `.compodocxrc.json`, `.compodocxrc.yaml`, or the `compodocx` property in `package.json`) as `includes` / `includesName`.

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

An ordered array of nodes. Each node has a `title` (sidebar label and page heading) and a `file` (path to a Markdown file). Nodes can nest via `children` up to five levels deep.

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

A node's order in the array is its order in the sidebar. The first level shows up as expandable groups; deeper levels collapse into sub-lists under their parent. Depth greater than 5 is rejected with an error.

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

compodocx logs `Additional documentation: summary.json file found` during generation and then `Process additional pages` once the Markdown files are rendered. If `summary.json` is missing or unreadable the feature is silently skipped; if it parses but references a missing file, that page is skipped with a warning.

## What you cannot do

- Link to additional pages from a custom template without knowing the slug - there is no helper for resolving a title to its output URL yet.
- Change the Markdown pipeline per page - it is the same `marked` instance used for JSDoc.
- Interleave additional pages inside the API groups - they live in their own sidebar section. This holds under both `menuLayout: 'feature'` (default) and `menuLayout: 'type'`: the Features chapter only mixes code entities, never additional pages.

## Licensing

compodocx is MIT-licensed. The additional-pages feature is part of the CLI; nothing you produce with it is encumbered by compodocx, and nothing about enabling it changes the licensing of the generated site. Ship it wherever you like.
