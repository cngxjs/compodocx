/**
 * Validate the `--searchFacetLimit` flag (and the matching config-file field).
 *
 * Accepts an integer between 0 and 1000, inclusive: the number of chips each
 * facet dimension of the search command palette shows before a "+N more"
 * toggle. `0` shows every chip. Mirrors `parseMaxSearchResults`.
 */

import { err, ok, type Result } from '../lib';

const MAX = 1000;

export function parseSearchFacetLimit(
    raw: unknown,
    source: 'flag' | 'config' = 'flag'
): Result<number> {
    const label = source === 'flag' ? '--searchFacetLimit' : 'searchFacetLimit in config file';
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
    return parseSearchFacetLimit(Number(trimmed), source);
}
