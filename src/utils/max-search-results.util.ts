/**
 * Validate the `--maxSearchResults` flag (and the matching config-file field).
 *
 * Accepts an integer between 0 and 10000, inclusive. `0` shows every result
 * in the search command palette. Mirrors `parseMaxVersionsShown`.
 */

import { err, ok, type Result } from '../lib';

const MAX = 10000;

export function parseMaxSearchResults(
    raw: unknown,
    source: 'flag' | 'config' = 'flag'
): Result<number> {
    const label = source === 'flag' ? '--maxSearchResults' : 'maxSearchResults in config file';
    const range = `an integer between 0 and ${MAX}`;

    if (typeof raw === 'number') {
        return Number.isInteger(raw) && raw >= 0 && raw <= MAX
            ? ok(raw)
            : err(`${label} must be ${range} (got ${raw})`);
    }
    if (typeof raw !== 'string') {
        return err(`${label} must be ${range}`);
    }
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
        return err(`${label} must be ${range} (got "${raw}")`);
    }
    return parseMaxSearchResults(Number(trimmed), source);
}
