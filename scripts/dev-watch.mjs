#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ---------- Configuration & Args ----------
const args = Object.fromEntries(
    process.argv.slice(2).map(a => {
        const [k, v] = a.replace(/^--/, '').split('=');
        return [k, v ?? true];
    })
);

const fixture = args.fixture ?? 'kitchen-sink-standalone';
// Cross-platform Temp path
const outDir = args.out ?? join(tmpdir(), `compodocx-${fixture}-docs`);
const port = args.port ?? '8081';
const reloadPort = Number(port) + 1000;
const reloadEnabled = args.reload !== 'false' && args['no-reload'] !== true;
const fixtureTsconfig = `test/fixtures/${fixture}/tsconfig.json`;

if (!existsSync(resolve(root, fixtureTsconfig))) {
    console.error(`\x1b[31m[error]\x1b[0m Fixture tsconfig not found: ${fixtureTsconfig}`);
    process.exit(1);
}

// ---------- ANSI Colors & Logging ----------
const c = {
    dim: s => `\x1b[2m${s}\x1b[0m`,
    cyan: s => `\x1b[36m${s}\x1b[0m`,
    green: s => `\x1b[32m${s}\x1b[0m`,
    yellow: s => `\x1b[33m${s}\x1b[0m`,
    red: s => `\x1b[31m${s}\x1b[0m`,
    bold: s => `\x1b[1m${s}\x1b[0m`
};

const now = () => new Date().toLocaleTimeString('en-GB', { hour12: false });

/**
 * Creates a Transform stream that labels each line.
 * This allows us to see real-time logs from subprocesses.
 */
const createLogStream = (label, colorFn) =>
    new Transform({
        transform(chunk, _encoding, callback) {
            const lines = chunk.toString().split('\n');
            const output = lines
                .filter(line => line.trim().length > 0)
                .map(line => `${c.dim(`[${now()}]`)} ${colorFn(`[${label}]`)} ${line}`)
                .join('\n');

            callback(null, output ? `${output}\n` : '');
        }
    });

// ---------- Run Helper (Streaming) ----------
const run = (cmd, args, label, colorFn = c.cyan) =>
    new Promise((resolvePromise, rejectPromise) => {
        const start = Date.now();
        // We use 'pipe' for stdout/stderr to stream them
        const child = spawn(cmd, args, {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });

        child.stdout.pipe(createLogStream(label, colorFn)).pipe(process.stdout);
        child.stderr.pipe(createLogStream(label, c.red)).pipe(process.stderr);

        child.on('close', code => {
            const ms = Date.now() - start;
            if (code === 0) {
                console.log(
                    `${c.dim(`[${now()}]`)} ${c.green(`[${label}]`)} ${c.dim(`successfully in ${ms}ms`)}`
                );
                resolvePromise();
            } else {
                rejectPromise(new Error(`${label} failed (Exit ${code})`));
            }
        });
    });

// ---------- Build Steps ----------
const buildCss = () =>
    run(
        'npx tailwindcss',
        ['-i', 'src/styles/compodocx.css', '-o', 'src/resources/styles/compodocx.css', '--minify'],
        'css',
        c.yellow
    );

const buildClient = () =>
    run('npx tsdown', ['--config', 'tsdown.client.config.ts'], 'client', c.yellow);

const buildLib = () => run('npx tsdown', [], 'lib', c.cyan);

const generateFixture = () => {
    if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true, force: true });
    }
    const cliArgs = ['-p', fixtureTsconfig, '-d', outDir];
    if (args.search !== true && args.search !== 'true') {
        cliArgs.push('--disableSearch');
    }
    const fixtureAssets = resolve(root, `test/fixtures/${fixture}/assets`);
    if (existsSync(fixtureAssets)) {
        cliArgs.push('-a', fixtureAssets);
    }
    const fixtureIncludes = `test/fixtures/${fixture}/additional-doc`;
    if (existsSync(resolve(root, fixtureIncludes))) {
        cliArgs.push('--includes', `./${fixtureIncludes}`);
    }
    // Dev-only options (e.g. showEffects); the CLI specs run without them.
    const fixtureConfig = resolve(root, `test/fixtures/${fixture}/dev.compodocxrc.json`);
    if (existsSync(fixtureConfig)) {
        cliArgs.push('-c', fixtureConfig);
    }
    return run('./bin/index-cli.js', cliArgs, 'docs', c.green);
};

// ---------- Live Reload Server (SSE) ----------
const sseClients = new Set();
let reloadServer = null;

const startReloadServer = () => {
    reloadServer = createServer((req, res) => {
        if (req.url !== '/reload') {
            res.writeHead(404).end();
            return;
        }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write('retry: 1000\n\n');
        sseClients.add(res);
        req.on('close', () => sseClients.delete(res));
    });
    reloadServer.listen(reloadPort);
};

const broadcastReload = () => {
    for (const client of sseClients) {
        try {
            client.write('data: reload\n\n');
        } catch {
            sseClients.delete(client);
        }
    }
};

const RELOAD_MARKER = 'data-cdx-dev-reload';
const reloadSnippet = `<script ${RELOAD_MARKER}>(function(){try{var es=new EventSource('http://localhost:${reloadPort}/reload');es.onmessage=function(){location.reload();};}catch(e){}})();</script>`;

const injectReloadScript = () => {
    if (!reloadEnabled || !existsSync(outDir)) {
        return;
    }

    const walk = dir => {
        for (const entry of readdirSync(dir)) {
            const p = join(dir, entry);
            if (statSync(p).isDirectory()) {
                walk(p);
            } else if (entry.endsWith('.html')) {
                const html = readFileSync(p, 'utf8');
                if (!html.includes(RELOAD_MARKER)) {
                    // Robusterer Case-Insensitive Replace
                    const newHtml = html.replace(/<\/body>/i, `${reloadSnippet}</body>`);
                    writeFileSync(p, newHtml);
                }
            }
        }
    };
    walk(outDir);
};

// ---------- Orchestration ----------
const queue = new Set();
let running = false;

const schedule = step => {
    queue.add(step);
    if (!running) {
        flush();
    }
};

const flush = async () => {
    if (queue.size === 0 || running) {
        return;
    }
    running = true;

    const steps = new Set(queue);
    queue.clear();

    try {
        const tasks = [];
        if (steps.has('css')) {
            tasks.push(buildCss());
        }
        if (steps.has('client')) {
            tasks.push(buildClient());
        }
        if (steps.has('lib')) {
            tasks.push(buildLib());
        }

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }

        await generateFixture();
        injectReloadScript();
        broadcastReload();
        console.log(`\n${c.cyan('[ready]')} ${c.bold(`http://localhost:${port}`)}\n`);
    } catch (err) {
        console.error(`\n${c.red('[error]')} Pipeline failed: ${err.message}\n`);
    } finally {
        running = false;
        if (queue.size > 0) {
            flush();
        }
    }
};

// ---------- Start ----------
console.log(c.bold(c.cyan('\n  compodocx dev watch')));
console.log(`  fixture : ${c.yellow(fixture)}`);
console.log(`  out     : ${c.yellow(outDir)}`);
console.log(`  port    : ${c.yellow(port)} (Reload: :${reloadPort})\n`);

try {
    await buildLib();
    await Promise.all([buildClient(), buildCss()]);
    await generateFixture();
    if (reloadEnabled) {
        startReloadServer();
        injectReloadScript();
    }
} catch (_err) {
    console.error(c.red('\n[cold] Initial build failed.'));
    process.exit(1);
}

const sirv = spawn('npx sirv-cli', [outDir, '--port', port, '--dev', '--quiet', '--single'], {
    cwd: root,
    stdio: 'inherit',
    shell: true
});

// ---------- Watchers ----------
const watchOptions = {
    cwd: root,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 100 }
};

const watch = (paths, exts, step, _label) => {
    const filter = p => exts.some(e => p.endsWith(e));
    chokidar.watch(paths, watchOptions).on('all', (_evt, p) => {
        if (filter(p)) {
            console.log(`${c.dim(`[${now()}]`)} ${c.yellow(`[change]`)} ${p}`);
            schedule(step);
        }
    });
};

watch(['src/styles'], ['.css'], 'css', 'css');
watch(['src/client'], ['.ts'], 'client', 'client');
watch(['src/app', 'src/templates', 'src/utils', 'src/index.ts'], ['.ts', '.tsx'], 'lib', 'lib');
watch(
    [`test/fixtures/${fixture}`],
    ['.ts', '.tsx', '.md', '.scss', '.css', '.html', '.json'],
    'docs',
    'fixture'
);

// ---------- Cleanup ----------
const shutdown = () => {
    console.log(`\n${c.cyan('[exit]')} Shutting down processes...`);
    sirv.kill();
    if (reloadServer) {
        reloadServer.close();
    }
    process.exit();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
