/**
 * Texts the browser scripts write into the page. The server renders them in
 * the page language as JSON into `body[data-cdx-text]`; the client reads them
 * through {@link clientText}. A page without the attribute (an older custom
 * `Layout` override) gets these English defaults.
 *
 * Placeholders are `{name}`. Pure module, shared with the client bundle.
 */
export const CLIENT_TEXT = {
    'source-code': 'Source code',
    'show-all-lines': 'Show all {count} lines',
    'show-less': 'Show less',
    'search-start': 'Start typing to see results',
    'search-unavailable': 'Search unavailable (requires HTTP server)',
    'search-no-results': 'No results for "{query}"',
    'facet-kind': 'Kind',
    'facet-library': 'Library',
    'facet-feature': 'Feature',
    'facet-more': '+{count} more',
    'reset-filters': 'Reset filters',
    shortcuts: 'Keyboard shortcuts',
    'shortcuts-navigation': 'Navigation',
    'shortcuts-page': 'Page',
    'shortcuts-search': 'Search',
    'previous-entity': 'Previous entity',
    'next-entity': 'Next entity',
    'next-member': 'Next member',
    'previous-member': 'Previous member',
    'open-search': 'Open search',
    'this-dialog': 'This dialog',
    'version-label': 'Documentation version: {label}',
    'versions-loading': 'Loading…',
    'versions-none': 'No other versions known',
    'versions-file': 'Open over http to switch versions.',
    'versions-showing': 'Showing {shown} of {total} versions',
    'versions-manifest': 'see versions.json',
    'dom-tree': 'Component DOM tree'
} as const;

export type ClientTextKey = keyof typeof CLIENT_TEXT;
export type ClientTexts = Readonly<Record<ClientTextKey, string>>;

/** Fills `{name}` placeholders; unknown placeholders stay as written. */
export const fillText = (text: string, vars: Readonly<Record<string, string | number>> = {}) =>
    text.replace(/\{(\w+)\}/g, (whole, name: string) =>
        Object.hasOwn(vars, name) ? String(vars[name]) : whole
    );

/**
 * The texts from a `data-cdx-text` value over the English defaults: keys
 * that are missing, not strings or empty keep the default; unreadable JSON
 * yields the defaults.
 */
export const parseClientText = (raw: string | undefined): ClientTexts => {
    if (!raw) {
        return CLIENT_TEXT;
    }
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null) {
            return CLIENT_TEXT;
        }
        const given = parsed as Record<string, unknown>;
        const keys = Object.keys(CLIENT_TEXT) as ClientTextKey[];
        return Object.fromEntries(
            keys.map(key => {
                const value = given[key];
                return [key, typeof value === 'string' && value !== '' ? value : CLIENT_TEXT[key]];
            })
        ) as ClientTexts;
    } catch {
        return CLIENT_TEXT;
    }
};
