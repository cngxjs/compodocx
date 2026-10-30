import { describe, expect, it } from 'vitest';

import { parseSearchFacetLimit } from '../../../src/utils/search-facet-limit.util';

describe('parseSearchFacetLimit', () => {
    it.each([
        [0, 0],
        ['0', 0],
        [' 8 ', 8],
        [1000, 1000]
    ])('accepts %j', (raw, value) => {
        expect(parseSearchFacetLimit(raw)).toEqual({ ok: true, value });
    });

    it.each([-1, 1.5, 1001, '', 'eight', '-3', true, undefined])('rejects %j', raw => {
        const result = parseSearchFacetLimit(raw);
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.message).toContain('--searchFacetLimit');
    });

    it('names the config key for config values', () => {
        const result = parseSearchFacetLimit('x', 'config');
        expect(result.ok === false && result.message).toContain('searchFacetLimit in config file');
    });
});
