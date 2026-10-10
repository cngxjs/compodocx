#!/usr/bin/env node
/**
 * Build two version snapshots of the sample-files fixture into
 * /tmp/compodoc-multi-version and then serve the parent folder so the
 * Playwright multi-version project can exercise navigation between
 * the two builds.
 *
 * v1.0.0 builds from `tsconfig.entry.json` (a smaller subset that does
 * NOT include Bar.html). v2.0.0 builds from `tsconfig.simple.json`
 * (full file set, includes Bar.html). The page-not-in-old-version
 * fallback path of the switcher widget is exercised by clicking
 * v1.0.0 from the v2.0.0 BarComponent page.
 *
 * v0.9.0 stands in for a version built before pages moved under their
 * feature folders: a copy of v2.0.0 with every page moved back to its old
 * kind-folder path along v2.0.0's redirects.json (a `<base>` keeps its
 * assets and links resolving from where it was written) and no redirect
 * map of its own, as such versions have none.
 */

import { spawn, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const OUT = '/tmp/compodoc-multi-version';
const PORT = '4003';
const CLI = './bin/index-cli.js';

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const TOGGLE =
    'modules,components,directives,classes,injectables,interceptors,guards,pipes,interfaces,miscellaneous';

const buildV1 = spawnSync(
    'node',
    [
        CLI,
        '-p',
        './test/fixtures/sample-files/tsconfig.entry.json',
        '-d',
        OUT,
        '--versionLabel',
        'v1.0.0',
        '--disableSearch',
        '--toggleMenuItems',
        TOGGLE
    ],
    { stdio: 'inherit' }
);
if (buildV1.status !== 0) {
    process.exit(buildV1.status ?? 1);
}

const buildV2 = spawnSync(
    'node',
    [
        CLI,
        '-p',
        './test/fixtures/sample-files/tsconfig.simple.json',
        '-d',
        OUT,
        '--versionLabel',
        'v2.0.0',
        '--disableSearch',
        '--toggleMenuItems',
        TOGGLE
    ],
    { stdio: 'inherit' }
);
if (buildV2.status !== 0) {
    process.exit(buildV2.status ?? 1);
}

/** v0.9.0: v2.0.0 moved back to the layout before feature folders. */
const OLD = 'v0.9.0';
cpSync(join(OUT, 'v2.0.0'), join(OUT, OLD), { recursive: true });
const redirectsFile = join(OUT, OLD, 'redirects.json');
const { redirects } = JSON.parse(readFileSync(redirectsFile, 'utf8'));
rmSync(redirectsFile);
const relabel = html =>
    html
        .replaceAll('data-cdx-current-label="v2.0.0"', `data-cdx-current-label="${OLD}"`)
        .replaceAll('(current: v2.0.0)', `(current: ${OLD})`)
        .replaceAll(
            '<span class="cdx-version-switcher-label">v2.0.0</span>',
            `<span class="cdx-version-switcher-label">${OLD}</span>`
        );
const moved = new Map();
for (const [from, to] of Object.entries(redirects)) {
    // One old page per current page: its kind-folder path (plain, no anchor).
    const isKindFolder =
        !from.includes('#') && !/^(miscellaneous|features|categories)\//.test(from);
    if (isKindFolder && !to.includes('#') && !moved.has(to)) {
        moved.set(to, from);
    }
}
for (const [to, from] of moved) {
    const source = join(OUT, OLD, to);
    const html = readFileSync(source, 'utf8').replace(
        '<head>',
        `<head><base href="/${OLD}/${dirname(to) === '.' ? '' : `${dirname(to)}/`}">`
    );
    mkdirSync(dirname(join(OUT, OLD, from)), { recursive: true });
    writeFileSync(join(OUT, OLD, from), html);
    rmSync(source);
}
const relabelTree = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            relabelTree(full);
        } else if (entry.name.endsWith('.html')) {
            writeFileSync(full, relabel(readFileSync(full, 'utf8')));
        }
    }
};
relabelTree(join(OUT, OLD));
const manifestFile = join(OUT, 'versions.json');
const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
manifest.versions.push({ label: OLD, path: `${OLD}/`, builtAt: manifest.updatedAt });
writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 4)}\n`);
console.log(`${OLD}: ${moved.size} pages moved back to their kind folders`);

// Serve the parent (no -p, only -d + -s) — the CLI uses sirv on the folder
// and the manifest + version subdirs are reachable side-by-side.
const serve = spawn('node', [CLI, '-d', OUT, '-s', '--port', PORT, '--no-multiVersion'], {
    stdio: 'inherit'
});
serve.on('exit', code => process.exit(code ?? 0));
