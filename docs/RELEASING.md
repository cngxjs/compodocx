# Releasing a new version

A release is two steps: [release-it](https://github.com/release-it/release-it) bumps the version and pushes a tag from your machine, then the `Release` GitHub workflow publishes that tag to npm. Nothing is published from a local machine.

## Before you start

- Work on `develop`, with a clean working tree and an upstream branch (release-it refuses to run otherwise).
- Move the `## [Unreleased]` notes in `CHANGELOG.md` under a heading for the new version (`## [x.y.z] - YYYY-MM-DD`) and merge that change first. release-it does not edit the changelog. `develop` is protected, so this goes through a branch and a pull request like any other change.
- Pull `develop` after that merge, so the release commit sits on top of it.

## 1. Bump and tag with release-it

```bash
npx release-it            # asks for the increment
npx release-it minor      # or name it: patch, minor, major, or an exact version
npx release-it patch --ci # without prompts
```

What `.release-it.json` makes it do:

- Runs `npm run lint` and `npm run test:unit` first (`before:init` hook).
- Writes the new version into `package.json` and `package-lock.json`.
- Commits as `chore: release v<version>` and creates the annotated tag `v<version>` (`Release <version>`).
- Pushes the commit and the tag (`--follow-tags`) straight to `develop`. This needs an account that may push past the branch protection.
- Does not publish to npm (`npm.publish: false`) and does not create a GitHub release (`github.release: false`).

## 2. Publish from GitHub Actions

Pushing a `v*` tag starts `.github/workflows/release.yml`, which:

1. Waits until the CI workflow has succeeded on the tagged commit.
2. Installs with `npm ci` on Node.js 24, then runs `npm run lint`, `npm run build` and `npm run test:unit`.
3. Checks that the tag matches the `version` in `package.json`.
4. Shows the package contents (`npm pack --dry-run`).
5. Publishes with `npm publish --access public --provenance`. Authentication uses npm trusted publishing (OIDC) for this repository's workflow; there is no npm token.
6. Notifies the website repository so it picks up the new version. This uses the `WEBSITE_DISPATCH_TOKEN` secret, a fine-grained token for `cngxjs/compodocx-website` that expires and has to be renewed.

If a step before the publish fails, nothing is published. Fix the cause, then release a new patch version; a published version cannot be published again. If only the website step fails, the package is out: renew the token and start the website build by hand.

## 3. After the publish

npm needs a while before the new version shows up. Until then `npm view @cngxjs/compodocx@<version>` and the tarball URL answer with 404; this took between a few minutes and almost an hour so far. Do not publish again in that window. Check that `latest` points at the new version:

```bash
npm view @cngxjs/compodocx dist-tags.latest
```

When the release changes theme files, the website copies them separately: run `npm run sync:tokens -- --ref=v<version>` in `compodocx-website` and open a pull request there.
