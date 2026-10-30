import { describe, expect, it } from 'vitest';

import {
    axisFacets,
    axisFilterName,
    BASE_FACETS,
    facetLimit,
    limitFacetValues
} from '../../../src/client/axis-facets';

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

describe('facetLimit', () => {
    it('reads a positive integer', () => {
        expect(facetLimit('8')).toBe(8);
    });

    it('shows every chip for 0, a missing or an unreadable attribute', () => {
        expect(facetLimit('0')).toBe(0);
        expect(facetLimit(undefined)).toBe(0);
        expect(facetLimit('many')).toBe(0);
        expect(facetLimit('-2')).toBe(0);
        expect(facetLimit('2.5')).toBe(0);
    });
});

describe('limitFacetValues', () => {
    const sorted = ['select', 'tabs', 'utils', 'chart', 'menu', 'card'];

    it('keeps the first values and counts the rest', () => {
        expect(limitFacetValues(sorted, new Set(), 3, false)).toEqual({
            shown: ['select', 'tabs', 'utils'],
            hidden: 3
        });
    });

    it('keeps an active value past the limit in its sorted place', () => {
        expect(limitFacetValues(sorted, new Set(['menu']), 2, false)).toEqual({
            shown: ['select', 'tabs', 'menu'],
            hidden: 3
        });
    });

    it('shows all values when expanded, unlimited or within the limit', () => {
        expect(limitFacetValues(sorted, new Set(), 2, true)).toEqual({ shown: sorted, hidden: 0 });
        expect(limitFacetValues(sorted, new Set(), 0, false)).toEqual({ shown: sorted, hidden: 0 });
        expect(limitFacetValues(sorted, new Set(), 6, false)).toEqual({ shown: sorted, hidden: 0 });
    });
});
