# Multi-version documentation

compodocx generates a fully self-contained, statically-served site on every run. Every URL in the output uses a relative path (`./images/favicon.ico`, `../../forms/select/Foo.html`, depth-aware Pagefind loader), so multiple builds can sit side-by-side in one parent folder under different version subdirectories with no rewrite step.

This page documents the pattern. It is purely a usage convention — there are no special CLI flags. If you can run `compodocx` once, you can run it N times into N folders.

## The pattern

Build each version into its own folder under a single deploy root:

```text
public/                  ← deploy this folder
├── index.html           ← optional landing page (your own)
├── v0.2.0/
│   ├── index.html
│   ├── forms/select/    ← pages of the `forms/select` entry point
│   ├── redirects.json
│   └── …
├── v0.3.0/
│   ├── index.html
│   ├── forms/select/
│   ├── redirects.json
│   └── …
└── latest/              ← optional symlink → v0.3.0
```

You produce that layout by running compodocx once per version, each with its own `-d`:

```bash
git checkout v0.2.0
npx compodocx -p tsconfig.json -d public/v0.2.0 -n "MyLib v0.2.0"

git checkout v0.3.0
npx compodocx -p tsconfig.json -d public/v0.3.0 -n "MyLib v0.3.0"

git checkout main
ln -sfn v0.3.0 public/latest    # optional convenience pointer
```

Deploy `public/` to any static host. Each version sub-site is fully self-contained: opening `https://example.com/v0.2.0/forms/select/Foo.html` works, and so does `https://example.com/v0.3.0/forms/select/Foo.html`. Nothing in `v0.2.0/` references `v0.3.0/` and vice versa.

## Why it works

1. **All asset references are relative.** The generated HTML uses `./images/...`, `./styles/...`, `./js/...` from the index page and `../images/...` from one-level-deep entity pages. There is zero `href="/..."` or `src="/..."` in the output.
2. **Pagefind is depth-aware.** The search loader computes its path from `window.COMPODOC_CURRENT_PAGE_DEPTH` and resolves `pagefind/pagefind.js` relative to the current page, so search keeps working at any subdirectory depth.
3. **Each build owns its own assets.** `images/`, `styles/`, `js/`, `pagefind/`, `graph/` all live inside the per-version folder. Different versions can ship different bundled JS/CSS without colliding.

## Deployment recipes

Any static host that serves a directory tree works. The patterns below are tested on the most common ones.

### GitHub Pages

`actions/deploy-pages` uploads whatever is in `public/`. Loop your tags in the workflow, build each into `public/<tag>/`, then deploy:

```yaml
- name: Build versioned docs
  run: |
      for v in v0.2.0 v0.3.0; do
          git checkout "$v"
          npx compodocx -p tsconfig.json -d "public/$v" -n "MyLib $v" --silent
      done
      git checkout main
      cp landing/index.html public/index.html

- uses: actions/upload-pages-artifact@v4
  with:
      path: public
```

The site is served at `https://<user>.github.io/<repo>/v0.2.0/`, `https://<user>.github.io/<repo>/v0.3.0/`, etc.

### Netlify / Vercel

Set the publish directory to `public/`. The same shell loop in your build command produces the same layout. Both providers serve subdirectory `index.html` files directly without rewrites.

### plain nginx

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/docs;       # this is your "public/" folder
    index index.html;

    # serve subdirectory index files: /v0.2.0/ → /v0.2.0/index.html
    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

No version-specific blocks needed. Each `/v<x.y.z>/` is just a directory that nginx serves.

## A landing page

`public/index.html` is yours to write — compodocx never emits a top-level landing page when you build into a subdirectory. A minimal one that lists known versions:

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8" />
        <title>MyLib documentation</title>
        <style>
            body {
                font-family: system-ui, sans-serif;
                max-width: 40rem;
                margin: 4rem auto;
                padding: 0 1rem;
            }
            ul {
                list-style: none;
                padding: 0;
            }
            li {
                margin: 0.5rem 0;
            }
            a {
                font-size: 1.1rem;
            }
        </style>
    </head>
    <body>
        <h1>MyLib</h1>
        <p>Pick a version:</p>
        <ul>
            <li><a href="./latest/">latest</a> (currently v0.3.0)</li>
            <li><a href="./v0.3.0/">v0.3.0</a></li>
            <li><a href="./v0.2.0/">v0.2.0</a></li>
        </ul>
    </body>
</html>
```

## A drop-in version switcher

If you want a version dropdown rendered on every page of the docs, the simplest path is a small inline script injected via compodocx's `--extTheme` (a CSS file can `@import` nothing, but you can lean on `--customLogo` together with the trick below). The cleanest cross-version solution today is post-processing: walk the per-version folders after every build and prepend a tiny snippet into each `<body>` tag.

```bash
# scripts/inject-version-switcher.sh — run once, after building all versions
SWITCHER='<div style="position:fixed;top:0.5rem;right:1rem;z-index:9999;font:14px system-ui">'
SWITCHER+='Version: <select onchange="if(this.value)location.href=this.value">'
SWITCHER+='<option value="">switch…</option>'
SWITCHER+='<option value="/v0.3.0/">v0.3.0</option>'
SWITCHER+='<option value="/v0.2.0/">v0.2.0</option>'
SWITCHER+='</select></div>'

find public/v* -name '*.html' | while read -r f; do
    [ -f "$f" ] || continue
    grep -q "switch…" "$f" && continue   # idempotent
    sed -i.bak "s|<body[^>]*>|&${SWITCHER}|" "$f" && rm -f "$f.bak"
done
```

A native version-switcher component (built into the template, picking up an external `versions.json`) is on the roadmap for a future release. Until then, post-processing or a separate landing page is the recommended approach.

## Pages that move between versions

Page URLs follow the feature a symbol belongs to (`<entry point>/<feature>/<Name>.html`), so a page can move when a symbol moves to another feature or when an older version used an earlier layout (one folder per kind, `components/Foo.html`). Every version's output therefore holds `redirects.json`:

```json
{ "schemaVersion": 1, "redirects": { "components/Foo.html": "forms/select/Foo.html" } }
```

Keys are old page paths relative to the version folder (an anchor is allowed, for the old `miscellaneous/functions.html#name` collection anchors), values are where that page or section is now. The built-in version switcher uses it: switching from a page looks the page up in the target version's map; when the target was built before maps existed, it reads the current version's map backwards to find the old path. If neither finds the page, it opens the target version's root. A web server can use the same map for HTTP redirects; compodocx writes no stub pages.

## Conventions worth following

- **One subfolder per version, never mixed layouts.** Don't build `v0.2.0/` into a flat `public/` and then build `v0.3.0/` alongside it — the assets will collide.
- **A `latest/` pointer.** A symlink (or a copy on platforms without symlinks) saves users from memorising the highest published number.
- **Version names in the page title.** Pass `-n "MyLib v0.3.0"` so browser tabs and search results show which version is open.
- **Disable search if you build many versions.** Pagefind indexes are ~hundreds of KB per version. If you publish ten releases, that adds up. Pass `--disableSearch` on older versions you don't expect anyone to search.

## Limitations today

- **The built-in switcher needs multi-version output.** With `--multiVersion` (the default) every page carries a switcher fed by `versions.json`; the drop-in snippet above is only for sites built with `--no-multiVersion`.
- **No automatic cross-version linking.** A symbol that exists in v0.2.0 and v0.3.0 has no automatic "see this in vX" link. Each per-version site is independent.
- **Template Playground and the live `--serve` mode use absolute URLs.** Both are runtime-only conveniences, not part of the static output you deploy. They are unaffected by the multi-version layout, but they cannot themselves run from a subdirectory.
- **Per-symbol `@since` badges.** compodocx renders `@since` tags from JSDoc when authors include them in their source — it does not infer them from a multi-version diff.

## Verifying it works

A two-line smoke test against the included sample fixture:

```bash
mkdir -p /tmp/multi-version-smoke
node ./bin/index-cli.js -p test/fixtures/sample-files/tsconfig.simple.json \
    -d /tmp/multi-version-smoke/v0.2.0 --silent --disableSearch -n "v0.2.0"
node ./bin/index-cli.js -p test/fixtures/sample-files/tsconfig.simple.json \
    -d /tmp/multi-version-smoke/v0.3.0 --silent --disableSearch -n "v0.3.0"

npx sirv-cli /tmp/multi-version-smoke --port 4500 &
sleep 2

curl -s http://localhost:4500/v0.2.0/index.html | grep -o '<title>[^<]*</title>'
curl -s http://localhost:4500/v0.3.0/index.html | grep -o '<title>[^<]*</title>'

kill %1
```

You should see two distinct titles, one per version, both served as HTTP 200 from the same parent folder.

## Future

Items deferred past v0.3.0, with no commitment to ship:

- An in-page version switcher widget driven by a `versions.json` file at the deploy root.
- A `compodocx multi-version` convenience command that reads a tag list and runs the loop.
- Per-symbol "added in vX" / "removed in vX" badges synthesised from a multi-version snapshot diff.
- Cross-version "view this symbol in vX" links inside entity pages.

If any of these matters to your project, open an issue on the [compodocx repo](https://github.com/cngxjs/compodocx) — pattern adoption from real users is what drives prioritisation.
