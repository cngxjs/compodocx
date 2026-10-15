/** A palette facet dimension: the Pagefind filter name and its heading. */
export interface FacetDimension {
    readonly dim: string;
    readonly label: string;
}

/** The fixed facet dimensions, in rail order. */
export const BASE_FACETS: readonly FacetDimension[] = [
    { dim: 'kind', label: 'Kind' },
    { dim: 'lib', label: 'Library' },
    { dim: 'feature', label: 'Feature' },
    { dim: 'wcag', label: 'WCAG' }
];

/** Pagefind filter name of a classification axis. */
export const axisFilterName = (axis: string): string => `axis-${axis}`;

/**
 * The facet dimensions of the declared axes, read from the palette's
 * `data-cdx-axes` JSON (`[{ "name", "label" }]`). Anything unreadable
 * yields no axis facets.
 */
export const axisFacets = (raw: string | undefined): readonly FacetDimension[] => {
    if (!raw) {
        return [];
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.flatMap((axis: unknown): FacetDimension[] => {
            if (typeof axis !== 'object' || axis === null) {
                return [];
            }
            const { name, label } = axis as { name?: unknown; label?: unknown };
            if (typeof name !== 'string' || name === '') {
                return [];
            }
            return [{ dim: axisFilterName(name), label: typeof label === 'string' ? label : name }];
        });
    } catch {
        return [];
    }
};
