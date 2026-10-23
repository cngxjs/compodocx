import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: {
        'index-cli': 'src/index-cli.ts',
        index: 'src/index.ts',
    },
    format: ['esm', 'cjs'],
    outDir: 'dist',
    sourcemap: 'inline',
    // Keep CJS at dist/*.js (matches main field, bin shim require resolution),
    // ESM at dist/*.mjs.
    outExtensions: ({ format }) => ({ js: format === 'cjs' ? '.js' : '.mjs' }),
    // Auto-detection covers most deps. Restate the explicit list to guard against
    // missed sub-path imports (notably `neotraverse/legacy`) and to keep parity
    // with the previous Rollup config.
    deps: {
        neverBundle: [
            'child_process',
            'crypto',
            'fs',
            'http',
            'module',
            'os',
            'path',
            '@kitajs/html',
            'chokidar',
            'commander',
            'cosmiconfig',
            'decache',
            'fast-glob',
            'fs-extra',
            'i18next',
            'marked',
            'minimist',
            'neotraverse/legacy',
            'os-name',
            'picocolors',
            'polka',
            'shiki',
            'sirv',
            'ts-morph',
            'typescript',
        ],
    },
    dts: false,
    clean: true,
    // Rolldown's default `dynamicImportInCjs: true` already preserves
    // `await import('shiki' | 'chokidar' | ...)` in CJS output without
    // rewriting it to require() — required because shiki is ESM-only.
    // Note: Rolldown's `dynamicImportInCjs` semantics are NEGATED relative to
    // classic Rollup (where false meant "preserve") — the default behavior is
    // already correct, so no override needed.
});
