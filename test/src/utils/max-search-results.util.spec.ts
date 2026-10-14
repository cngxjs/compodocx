import { describe, expect, it } from 'vitest';

import { limitResults } from '../../../src/client/command-palette';
import { parseMaxSearchResults } from '../../../src/utils/max-search-results.util';

describe('parseMaxSearchResults', () => {
    it.each([
        [0, 0],
        ['0', 0],
        [' 25 ', 25],
        [10000, 10000]
    ])('accepts %j', (raw, value) => {
        expect(parseMaxSearchResults(raw)).toEqual({ ok: true, value });
    });

    it.each([-1, 1.5, 10001, '', 'ten', '-3', true, undefined])('rejects %j', raw => {
        const result = parseMaxSearchResults(raw);
        expect(result.ok).toBe(false);
        expect(!result.ok && result.message).toContain('--maxSearchResults');
    });

    it('names the config key for config values', () => {
        const result = parseMaxSearchResults('x', 'config');
        expect(!result.ok && result.message).toContain('maxSearchResults in config file');
    });
});

describe('limitResults', () => {
    const results = [1, 2, 3, 4];

    it('keeps the first max results', () => {
        expect(limitResults(results, 2)).toEqual([1, 2]);
    });

    it('keeps every result for 0', () => {
        expect(limitResults(results, 0)).toEqual(results);
    });
});
