# Multi-version documentation

compodocx writes versioned HTML output by default. Each run puts the site into a folder named after the version and records that version in a `versions.json` manifest next to it. Every page carries a version switcher that reads the manifest, so several versions deployed side by side link to each other without a rewrite step.

## The default layout

```bash
npx compodocx -p tsconfig.json -d docs
```

writes:

```text
docs/                    ← deploy this folder
├── versions.json        ← manifest of every version built into docs/
└── v1.2.0/              ← this run
    ├── index.html
    ├── forms/select/    ← pages of the `forms/select` entry point
    ├── redirects.json
    └── …
```

Run it again for another version into the same `-d` folder and the new version folder lands next to the first one; `versions.json` gains an entry. Building a label that is already listed replaces its folder and its entry.

compodocx writes no `index.html` into the `-d` folder itself. Add your own landing page there, or a redirect to the version readers should see first.

Only HTML output is versioned. `--exportFormat json` and `llm-md` write a single snapshot into the output folder as before.

## Flags

| Flag | Default | Description |
|-|-|-|
| `--multiVersion` / `--no-multiVersion` | on | `--no-multiVersion` writes the site straight into the `-d` folder, without a version folder, `versions.json` or switcher |
| `--versionLabel <label>` | from `package.json` | Name of the version folder and of the manifest entry. Without the flag, compodocx reads the `version` of the nearest `package.json` above the tsconfig folder (then above the working directory) and prefixes `v` to a semver value (`1.2.0` becomes `v1.2.0`). Labels such as `main` or `next` work too. When no label can be found the run stops with exit code 2 |
| `--versionsRoot <path>` | the `-d` folder | Folder `versions.json` is read from and written to. Override it when CI builds each version in a separate job and stitches the folders together later |
| `--maxVersionsShown <n>` | `10` | Number of versions the switcher lists, `0` for all (range 0 to 1000). The manifest always keeps every version |

The same options exist as config keys (`multiVersion`, `versionLabel`, `versionsRoot`, `maxVersionsShown`).

## `versions.json`

```json
{
    "schemaVersion": 1,
    "updatedAt": "2026-10-18T14:11:20.127Z",
    "versions": [
        { "label": "v1.1.0", "path": "v1.1.0/", "builtAt": "2026-10-18T14:11:19.355Z" },
        { "label": "v1.0.0", "path": "v1.0.0/", "builtAt": "2026-10-18T14:11:18.586Z" },
        { "label": "main", "path": "main/", "builtAt": "2026-10-18T14:11:20.127Z" }
    ]
}
```

Entries are sorted by semver, highest first; labels that are not semver (`main`, `next`) follow in alphabetical order. The first entry is the newest release. The file is written after the pages, and a failed write stops the run with exit code 1.

## The version switcher

Every page has a version dropdown in the top bar. It loads `versions.json` from the folder above the version folder the first time it is opened, so the deployed tree must keep the manifest next to the version folders. With one version listed it hides itself. Opened from `file://`, where browsers block the request, it shows a short hint instead of the list.

Picking a version opens the same page in that version when it exists there, otherwise the root of that version. Pages that moved between versions are followed through `redirects.json` (below).

A `version-switcher.js` template override replaces the dropdown markup, see [custom-templates.md](custom-templates.md).

## Pages that move between versions

Page URLs follow the feature a symbol belongs to (`<entry point>/<feature>/<Name>.html`), so a page can move when a symbol moves to another feature or when an older version used an earlier layout (one folder per kind, `components/Foo.html`). Every version's output therefore holds `redirects.json`:

```json
{ "schemaVersion": 1, "redirects": { "components/Foo.html": "forms/select/Foo.html" } }
```

Keys are old page paths relative to the version folder (an anchor is allowed, for the old `miscellaneous/functions.html#name` collection anchors), values are where that page or section is now. The switcher looks the page up in the target version's map; when the target was built before maps existed, it reads the current version's map backwards to find the old path. If neither finds the page, it opens the target version's root. A web server can use the same map for HTTP redirects; compodocx writes no stub pages.

## Building several versions

Check out each version and build it into the same `-d` folder:

```bash
for v in v1.0.0 v1.1.0; do
    git checkout "$v"
    npx compodocx -p tsconfig.json -d public --versionLabel "$v" --silent
done
git checkout main
npx compodocx -p tsconfig.json -d public --versionLabel main --silent
```

`scripts/build-versioned-docs.sh` in the compodocx repository is a starting point for such a loop.

When versions are built in separate CI jobs, build each into its own folder and copy the version folders together before deploying. `versions.json` must then list all of them: either keep one manifest that every job updates (`--versionsRoot` pointing at a shared or restored folder), or build the versions one after another into the same folder as above.

## Deployment

The output uses relative URLs only, so any static host that serves a folder tree works: GitHub Pages (`actions/upload-pages-artifact` with `path: public`), Netlify or Vercel (publish directory `public/`), or a plain web server:

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/docs;       # the -d folder
    index index.html;

    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

## Tips

- **Version names in the page title.** Pass `-n "MyLib v1.1.0"` so browser tabs and search results show which version is open.
- **Search per version.** Each version has its own Pagefind index. Pass `--disableSearch` on old versions you do not expect anyone to search to keep the deploy small.
- **`@since` badges** come from the JSDoc of your sources; compodocx does not derive them from the versions it has built.
