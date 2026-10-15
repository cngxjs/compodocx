/**
 * Validate the `--maxVersionsShown` flag (and the matching config-file field).
 *
 * Accepts an integer between 0 and 1000, inclusive. `0` is treated as
 * "unlimited" by the switcher widget - the upper bound exists to catch
 * typos / runaway config rather than to express a real product cap.
 *
 * Returns a `Result` so callers (CLI, programmatic consumers, tests) decide
 * how to surface failures. Mirrors `parseJsonIndent`.
 */

import { err, ok, type Result } from '../lib';

export function parseMaxVersionsShown(
    raw: unknown,
    source: 'flag' | 'config' = 'flag'
): Result<number> {
    const label = source === 'flag' ? '--maxVersionsShown' : 'maxVersionsShown in config file';

    if (typeof raw === 'number') {
        return assertInRange(raw, label);
    }

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed === '') {
            return err(`${label} requires a value between 0 and 1000`);
        }
        const parsed = Number(trimmed);
        if (!Number.isFinite(parsed) || !/^-?\d+$/.test(trimmed)) {
            return err(`${label} must be an integer between 0 and 1000 (got "${raw}")`);
        }
        return assertInRange(parsed, label);
    }

    return err(`${label} must be an integer between 0 and 1000`);
}

function assertInRange(value: number, label: string): Result<number> {
    if (!Number.isInteger(value) || value < 0 || value > 1000) {
        return err(`${label} must be an integer between 0 and 1000 (got ${value})`);
    }
    return ok(value);
}
