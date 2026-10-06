<p align="center">
  <img src="docs/assets/compodocx-mark.svg" width="120" height="120" alt="compodocx"/>
</p>

<h1 align="center">compodocx</h1>

<p align="center">
  Static documentation generator for modern Angular projects. Reads your TypeScript source, component templates, and (S)CSS, and emits a self-contained HTML site.
</p>

<p align="center">
  <a href="https://github.com/cngxjs/compodocx/actions"><img src="https://github.com/cngxjs/compodocx/workflows/CI/badge.svg" alt="CI"/></a>
  <a href="https://www.npmjs.com/package/@cngxjs/compodocx"><img src="https://img.shields.io/npm/v/@cngxjs/compodocx.svg" alt="npm"/></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-brightgreen.svg" alt="License: MIT"/></a>
</p>

<p align="center">
  <strong>Documentation:</strong> <a href="https://compodocx.dev">compodocx.dev</a>
</p>

## Why compodocx

A fork of [compodoc](https://github.com/compodoc/compodoc) focused on modern Angular only. Replaces the rendering layer (JSX templates, Tailwind v4, Pagefind, D3) and adds first-class support for signals, `inject()`, structured `host` metadata, and a Theming tab driven by JSDoc/SassDoc-style comments above your CSS / SCSS tokens. CLI flags and config-file shape stay backwards-compatible with compodoc, so most projects switch with a one-line `package.json` edit.

## Requirements

- Node.js 22 or newer
- An Angular project with a `tsconfig.json` (Angular 21+, standalone code; tested against 21)

## Install

```bash
npm install --save-dev @cngxjs/compodocx
```

Inside an Angular workspace, the schematic seeds `tsconfig.doc.json`, registers npm scripts, and (if you are coming from `@compodoc/compodoc`) migrates existing artefacts in one pass:

```bash
ng add @cngxjs/compodocx
```

## Quick start

```bash
# Generate static documentation into ./docs
npx compodocx -p tsconfig.app.json -d docs

# Generate, serve, open in browser
npx compodocx -p tsconfig.app.json -d docs -s -o

# Watch + rebuild on every change
npx compodocx -p tsconfig.app.json -d docs -s -w

# Coverage check that fails CI under 70%
npx compodocx -p tsconfig.app.json -d docs --coverageTest 70 --coverageTestThresholdFail
```

The CLI is also exposed as `compodoc` for drop-in compatibility with existing npm scripts.

## Configuration

Drop a `.compodocrc.json` (or `.yaml`, `.js`) into your project root:

```json
{
    "tsconfig": "./tsconfig.app.json",
    "output": "./docs",
    "theme": "ocean"
}
```

Full reference for every CLI flag and config key: [`docs/configuration.md`](docs/configuration.md) or [compodocx.dev/guides/options](https://compodocx.dev/guides/options/).

## Documentation

| Topic | File |
|-|-|
| Configuration reference | [`docs/configuration.md`](docs/configuration.md) |
| Custom JS template overrides | [`docs/custom-templates.md`](docs/custom-templates.md) |
| Theme tokens in SCSS / CSS | [`docs/theming-tokens-authoring-guide.md`](docs/theming-tokens-authoring-guide.md) |
| Additional Markdown pages | [`docs/additional-pages.md`](docs/additional-pages.md) |
| Multi-version output | [`docs/versioned-docs.md`](docs/versioned-docs.md) |
| Internationalization | [`docs/i18n.md`](docs/i18n.md) |
| Migrating from compodoc | [`MIGRATION.md`](MIGRATION.md) |
| Releasing | [`docs/RELEASING.md`](docs/RELEASING.md) |

## Development

```bash
git clone https://github.com/cngxjs/compodocx.git
cd compodocx
npm ci
npm run build
npm run test:all
```

| Task | Command |
|-|-|
| Unit tests | `npm run test:unit` |
| CLI integration tests | `npm run test:cli` |
| Playwright e2e | `npm run test-e2e-playwright` |
| Lint / Format | `npm run lint` / `npm run format:write` |

The dev watcher rebuilds the docs site for one of the bundled fixtures whenever a source file changes:

```bash
npm run dev          # standalone fixture, port 8081
npm run dev:module   # legacy NgModule fixture (legacy notice only), port 8080
```

Issues and pull requests welcome at [github.com/cngxjs/compodocx](https://github.com/cngxjs/compodocx).

## Acknowledgments

compodocx is a fork of [compodoc](https://github.com/compodoc/compodoc) by Vincent Ogloblinsky and contributors. The compiler, JSDoc tag handling, and route-graph layout are the foundation everything here builds on.

## License

MIT. See [`LICENSE`](LICENSE).
