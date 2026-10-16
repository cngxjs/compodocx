import { describe, expect, it } from 'vitest';

import { axisFacets, axisFilterName, BASE_FACETS } from '../../../src/client/axis-facets';

describe('axisFacets', () => {
    it('reads one facet per declared axis, labelled', () => {
        expect(
            axisFacets(
                JSON.stringify([
                    { name: 'stability', label: 'Stability' },
                    { name: 'level', label: 'Level' }
                ])
            )
        ).toEqual([
            { dim: 'axis-stability', label: 'Stability' },
            { dim: 'axis-level', label: 'Level' }
        ]);
    });

    it('falls back to the name and skips entries without one', () => {
        expect(axisFacets('[{"name":"tier"},{"label":"x"},null,7]')).toEqual([
            { dim: 'axis-tier', label: 'tier' }
        ]);
    });

    it('yields nothing for a missing or unreadable attribute', () => {
        expect(axisFacets(undefined)).toEqual([]);
        expect(axisFacets('not json')).toEqual([]);
        expect(axisFacets('{"name":"tier"}')).toEqual([]);
    });

    it('keeps the fixed facets and their filter names apart from axes', () => {
        expect(BASE_FACETS.map(facet => facet.dim)).toEqual(['kind', 'lib', 'feature', 'wcag']);
        expect(axisFilterName('kind')).toBe('axis-kind');
    });
});
