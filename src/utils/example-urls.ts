/** A scheme (`https:`, `file:`, ...) or a protocol-relative `//host`. */
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

export const isAbsoluteUrl = (url: string): boolean => ABSOLUTE_URL.test(url);

/**
 * An `<example-url>` against `exampleUrlBase`. A relative URL is appended to
 * the base by string concatenation, with one slash between them, so a hash
 * route such as `/#/forms/select` keeps the base path. Absolute URLs and
 * URLs without a base stay as written.
 */
export const resolveExampleUrl = (url: string, base: string): string => {
    if (base === '' || isAbsoluteUrl(url)) {
        return url;
    }
    return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
};

export interface RelativeExampleUrl {
    readonly name: string;
    readonly url: string;
}

const NOTICE_LIMIT = 10;

/**
 * One notice for the relative `<example-url>` tags left without a base:
 * the Example tab would load them relative to the page, which breaks on
 * `file://` and below a sub path. Empty without findings.
 */
export const formatRelativeExampleUrlNotice = (
    findings: readonly RelativeExampleUrl[]
): readonly string[] => {
    if (findings.length === 0) {
        return [];
    }
    const noun = findings.length === 1 ? 'example URL is' : 'example URLs are';
    const shown = findings.slice(0, NOTICE_LIMIT).map(f => `  ${f.name}: ${f.url}`);
    const rest = findings.length - shown.length;
    return [
        `${findings.length} ${noun} relative and no exampleUrlBase is set; the Example tab loads them relative to the page`,
        ...shown,
        ...(rest > 0 ? [`  ... and ${rest} more`] : [])
    ];
};

/** Relative URLs among the `exampleUrls` of the given entries. */
export const relativeExampleUrls = (
    entries: readonly { name?: string; exampleUrls?: readonly string[] }[]
): readonly RelativeExampleUrl[] =>
    entries.flatMap(entry =>
        (entry.exampleUrls ?? [])
            .filter(url => !isAbsoluteUrl(url))
            .map(url => ({ name: entry.name ?? '', url }))
    );
