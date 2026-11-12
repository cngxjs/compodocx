# Contributing to compodocx

> compodocx is a fork of [compodoc](https://github.com/compodoc/compodoc) by Vincent Ogloblinsky, maintained by CNGX Christian Weiss.

Contributions are welcome. Please open an issue first for a new feature, so that it can be discussed before you work on it.

## Setup

compodocx is written in TypeScript and built with `tsdown`. It needs Node.js 22 or newer.

```shell
git clone https://github.com/<your-account>/compodocx.git
cd compodocx
npm ci
npm run build
```

More documentation is in [docs](./docs/README.md).

## Development

`npm run dev` builds the `kitchen-sink-standalone` fixture from `test/fixtures`, serves it on port 8081 and rebuilds on changes. Another fixture or port can be passed:

```shell
npm run dev -- --fixture=routing-app --port=8082
```

To run your build on your own Angular project:

```shell
node ../compodocx/bin/index-cli.js -p tsconfig.doc.json -s
```

To debug it, start with `--inspect-brk` and open `chrome://inspect` in Chrome:

```shell
node --inspect-brk ../compodocx/bin/index-cli.js -p tsconfig.doc.json
```

## Checks

Run these before you open a pull request:

| Command | What it does |
|-|-|
| `npm run lint` | Biome lint and format check (fix with `npm run lint:fix` or `npm run format:write`) |
| `npm run typecheck` | TypeScript check of the sources, the client and the schematics |
| `npm run test:unit` | Unit tests |
| `npm test` | Rebuilds `dist`, then runs the unit and CLI tests |
| `npm run test-e2e-playwright` | Browser tests with Playwright |

A new feature or a bug fix needs a test.

## Issues

Search the [issue tracker](https://github.com/cngxjs/compodocx/issues) first. A bug report needs the compodocx and Node.js versions, your tsconfig and a minimal reproduction.

## Pull requests

1. Fork the repository and create a branch from `develop`.
2. Make your change, with tests.
3. Run the checks above.
4. Open the pull request against `cngxjs/compodocx:develop`.

## Commit messages

Commits follow the format `<type>(<scope>): <subject>`. The scope is optional, the subject is in the imperative mood:

```text
fix(sidebar): wrap a long additional page title
```

| Type | Use for |
|-|-|
| `build` | Build system or dependencies |
| `chore` | Maintenance such as a release |
| `ci` | CI configuration |
| `docs` | Documentation only |
| `feat` | A new feature |
| `fix` | A bug fix |
| `perf` | A performance improvement |
| `refactor` | A code change that neither fixes a bug nor adds a feature |
| `style` | Formatting without a change in meaning |
| `test` | Adding or correcting tests |

Describe a breaking change in the commit body, starting with `BREAKING CHANGE:`, and add an entry to [MIGRATION.md](./MIGRATION.md).
