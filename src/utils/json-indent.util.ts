/**
 * Validate the `--jsonIndent` flag (and the matching config-file field).
 *
 * Accepts an integer between 0 and 8, inclusive - same range Node's
 * `JSON.stringify(value, replacer, space)` honours before silently capping.
 * Returns a `Result` so callers (CLI, programmatic consumers, tests) decide
 * how to surface failures. The CLI in `src/index-cli.ts` exits the process
 * on `!ok`; tests assert on the message without spying on `process.exit`.
 */

import { err, ok, type Result } from '../lib';

/**
 * `source` shapes the failure message: `'flag'` for CLI invocations,
 * `'config'` for cosmiconfig file loads. The accepted value space is the
 * same in both modes.
 */
export function parseJsonIndent(raw: unknown, source: 'flag' | 'config' = 'flag'): Result<number> {
    const label = source === 'flag' ? '--jsonIndent' : 'jsonIndent in config file';

    if (typeof raw === 'number') {
        return assertInRange(raw, label);
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed === '') {
            return err(`${label} requires a value between 0 and 8`);
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || !/^-?\d+$/.test(trimmed)) {
            return err(`${label} must be an integer between 0 and 8 (got "${raw}")`);
        }
        return assertInRange(parsed, label);
    }

    return err(`${label} must be an integer between 0 and 8`);
}

function assertInRange(value: number, label: string): Result<number> {
    if (!Number.isInteger(value) || value < 0 || value > 8) {
        return err(`${label} must be an integer between 0 and 8 (got ${value})`);
    }
    return ok(value);
}
