#!/usr/bin/env node

// Generation benchmark: wall time and peak RSS of the CLI for JSON and HTML
// output on a project directory. Local tool, not part of CI.
//
//   npm run bench
//   npm run bench -- --project ../some-lib --modes json --runs 5
//   npm run bench -- --check

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cliEntry = join(root, 'bin', 'index-cli.js');
const probe = join(root, 'scripts', 'bench-probe.mjs');
const budgetFile = join(root, 'scripts', 'bench-budget.json');

const CONFIG_FILES = [
    '.compodocxrc',
    '.compodocxrc.json',
    '.compodocxrc.yaml',
    '.compodocxrc.yml',
    '.compodocrc',
    '.compodocrc.json',
    '.compodocrc.yaml',
    '.compodocrc.yml'
];

const MODE_ARGS = {
    json: outDir => ['-e', 'json', '-d', outDir],
    html: outDir => ['-d', outDir, '--disableSearch', '--no-multiVersion']
};

const MB = 1024 * 1024;

const fail = (message, code = 1) => {
    console.error(`bench: ${message}`);
    process.exit(code);
};

const { values: opts } = parseArgs({
    options: {
        project: { type: 'string', default: 'test/fixtures/kitchen-sink-standalone' },
        tsconfig: { type: 'string' },
        runs: { type: 'string', default: '3' },
        modes: { type: 'string', default: 'json,html' },
        check: { type: 'boolean', default: false },
        json: { type: 'boolean', default: false }
    }
});

if (!existsSync(join(root, 'dist', 'index-cli.js'))) {
    fail('dist/ not found - run "npm run build" first', 2);
}

const projectDir = resolve(opts.project);
if (!existsSync(projectDir)) {
    fail(`project directory not found: ${projectDir}`);
}

const runs = Number.parseInt(opts.runs, 10);
if (!Number.isInteger(runs) || runs < 1) {
    fail(`--runs must be a positive integer, got "${opts.runs}"`);
}

const modes = opts.modes
    .split(',')
    .map(m => m.trim())
    .filter(Boolean);
const unknownModes = modes.filter(m => !(m in MODE_ARGS));
if (modes.length === 0 || unknownModes.length > 0) {
    fail(`--modes accepts a subset of ${Object.keys(MODE_ARGS).join(',')}, got "${opts.modes}"`);
}

const hasPackageJsonConfig = dir => {
    const pkgPath = join(dir, 'package.json');
    if (!existsSync(pkgPath)) {
        return false;
    }
    try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        return Boolean(pkg.compodocx ?? pkg.compodoc);
    } catch {
        return false;
    }
};

const hasConfig = dir =>
    CONFIG_FILES.some(name => existsSync(join(dir, name))) || hasPackageJsonConfig(dir);

// -p is passed only when asked for, or when the project has no config file to
// name its own tsconfig.
const tsconfigArgs = () => {
    if (opts.tsconfig) {
        return ['-p', opts.tsconfig];
    }
    return hasConfig(projectDir) ? [] : ['-p', 'tsconfig.json'];
};

const runOnce = mode =>
    new Promise((resolvePromise, rejectPromise) => {
        const workDir = mkdtempSync(join(tmpdir(), 'cdx-bench-'));
        const outDir = join(workDir, 'out');
        const resultPath = join(workDir, 'probe.json');
        const args = ['--import', probe, cliEntry, ...tsconfigArgs(), ...MODE_ARGS[mode](outDir)];
        const child = spawn(process.execPath, args, {
            cwd: projectDir,
            env: { ...process.env, CDX_BENCH_OUT: resultPath },
            stdio: ['ignore', 'ignore', 'pipe']
        });
        let stderr = '';
        child.stderr.on('data', chunk => {
            stderr += chunk;
        });
        child.on('error', rejectPromise);
        child.on('close', code => {
            try {
                if (code !== 0) {
                    rejectPromise(
                        new Error(`${mode} run exited with ${code}\n${stderr.slice(-2000)}`)
                    );
                    return;
                }
                if (!existsSync(resultPath)) {
                    rejectPromise(new Error(`${mode} run produced no probe result`));
                    return;
                }
                resolvePromise(JSON.parse(readFileSync(resultPath, 'utf8')));
            } finally {
                rmSync(workDir, { recursive: true, force: true });
            }
        });
    });

const median = values => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const measureMode = async mode => {
    const samples = [];
    for (let i = 0; i < runs; i++) {
        samples.push(await runOnce(mode));
    }
    return {
        mode,
        wallMs: Math.round(median(samples.map(s => s.wallMs))),
        rssBytes: Math.max(...samples.map(s => s.maxRssBytes)),
        samples
    };
};

const loadBudget = key => {
    if (!existsSync(budgetFile)) {
        return undefined;
    }
    return JSON.parse(readFileSync(budgetFile, 'utf8'))[key];
};

const checkBudget = (results, budget) =>
    results.flatMap(r => {
        const limit = budget[r.mode];
        if (!limit) {
            return [];
        }
        const overWall =
            r.wallMs > limit.wallMs ? [`${r.mode}: wall ${r.wallMs} ms > ${limit.wallMs} ms`] : [];
        const overRss =
            r.rssBytes > limit.rssBytes
                ? [
                      `${r.mode}: peak RSS ${(r.rssBytes / MB).toFixed(1)} MB > ${(limit.rssBytes / MB).toFixed(1)} MB`
                  ]
                : [];
        return [...overWall, ...overRss];
    });

const printTable = (key, results) => {
    console.log(`project: ${key} (${projectDir}), runs per mode: ${runs}`);
    console.log('| mode | median wall ms | peak RSS MB |');
    console.log('|-|-|-|');
    for (const r of results) {
        console.log(`| ${r.mode} | ${r.wallMs} | ${(r.rssBytes / MB).toFixed(1)} |`);
    }
};

const main = async () => {
    const key = basename(projectDir);
    const results = [];
    for (const mode of modes) {
        results.push(await measureMode(mode));
    }

    if (opts.json) {
        console.log(JSON.stringify({ project: key, projectDir, runs, results }, null, 2));
    } else {
        printTable(key, results);
    }

    if (!opts.check) {
        return;
    }
    const budget = loadBudget(key);
    if (!budget) {
        console.log(`bench: no budget entry for "${key}" in scripts/bench-budget.json`);
        return;
    }
    const violations = checkBudget(results, budget);
    if (violations.length > 0) {
        console.error('bench: budget exceeded');
        for (const v of violations) {
            console.error(`  ${v}`);
        }
        process.exit(1);
    }
    console.log('bench: within budget');
};

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
