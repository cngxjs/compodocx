/**
 * Console formatting for the migrate CLI.
 *
 * Mirrors the visual rhythm of the main compodocx logger
 * (`src/utils/logger.ts`):
 *   - gray `[HH:MM:SS]` timestamp prefix on every line
 *   - level-coloured tag (green / yellow / red) via picocolors
 *   - 15-char right-padded `key            : value` for detail lines
 *
 * Pure functions: every printer here returns a string. `printLine` is the
 * only side-effecting helper (writes to stdout).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import c from 'picocolors';

const KEY_PAD = 15;

const timestamp = (): string => c.gray(`[${new Date().toLocaleTimeString()}]`);

const padRight = (s: string, len: number = KEY_PAD): string =>
    s + ' '.repeat(Math.max(0, len - s.length));

/** Top-level result line: `[14:23:01] [OK]   <message>`. */
export const printLine = (parts: string): void => {
    process.stdout.write(`${timestamp()} ${parts}\n`);
};

/** Indented detail line: `[14:23:01]        key            : value`. */
export const printDetail = (key: string, value: string): void => {
    process.stdout.write(`${timestamp()} ${' '.repeat(7)}${c.dim(padRight(key))}: ${value}\n`);
};

/** Plain summary line, no tag, just the message. */
export const printSummary = (msg: string): void => {
    process.stdout.write(`${timestamp()} ${c.bold(msg)}\n`);
};

/** Error message routed to stderr to match Node convention. */
export const printError = (msg: string): void => {
    process.stderr.write(`${timestamp()} ${c.red(msg)}\n`);
};

/**
 * Resolve `src/banner` from either dev-tree (`__dirname/../../src/banner`)
 * or the published tarball (`__dirname/../src/banner` per the `files` whitelist).
 * Returns null if the asset is missing - callers fall back to a plain version
 * line so the migrate CLI never crashes on a corrupted install.
 */
const resolveBannerPath = (): string | null => {
    const candidates = [
        path.join(__dirname, '..', '..', 'src', 'banner'),
        path.join(__dirname, '..', 'src', 'banner')
    ];
    return candidates.find(p => fs.existsSync(p)) ?? null;
};

/**
 * Print the compodocx banner + version + Node info - same block the main CLI
 * shows when a doc-generation run starts. Migrate uses the same block so
 * `compodocx migrate ...` carries the same visual identity as `compodocx -p ...`.
 *
 * Caller decides when to show this - typically `process.stdout.isTTY && !json`.
 */
export const printBanner = (version: string): void => {
    const bannerPath = resolveBannerPath();
    if (bannerPath) {
        process.stdout.write(`${fs.readFileSync(bannerPath).toString()}\n`);
    }
    process.stdout.write(`${version}\n\n`);
    process.stdout.write(`Node.js version : ${process.version}\n\n`);
};

/**
 * Detect whether to show the banner for a given `migrate` invocation:
 *  - stdout is a TTY (the user is reading directly, not piping/CI)
 *  - the user did NOT pass `--json` (machine-readable output stays clean)
 *  - the user did NOT pass `--help`/`-h` (help text stays terse)
 *  - argv is non-empty (no banner before the bare-`migrate` help)
 */
export const shouldShowBanner = (argv: readonly string[]): boolean => {
    if (!process.stdout.isTTY) {
        return false;
    }
    if (argv.length === 0) {
        return false;
    }
    if (argv.includes('--json')) {
        return false;
    }
    if (argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
        return false;
    }
    return true;
};
