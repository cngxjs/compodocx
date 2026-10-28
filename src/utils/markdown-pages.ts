/** Root Markdown files that get a page of their own (README is the index page). */
export type MarkdownPageKey = 'changelog' | 'contributing' | 'license' | 'todo';

export const MARKDOWN_PAGE_KEYS: readonly MarkdownPageKey[] = [
    'changelog',
    'contributing',
    'license',
    'todo'
];

const isMarkdownPageKey = (value: string): value is MarkdownPageKey =>
    (MARKDOWN_PAGE_KEYS as readonly string[]).includes(value);

/**
 * `disableMarkdownPages` from the config file or the CLI. Entries are
 * trimmed and lower-cased; an unknown entry is dropped with one warning,
 * anything but a list is dropped as a whole.
 */
export const parseDisableMarkdownPages = (
    value: unknown
): { readonly pages: readonly MarkdownPageKey[]; readonly warnings: readonly string[] } => {
    if (!Array.isArray(value)) {
        return {
            pages: [],
            warnings: [
                `disableMarkdownPages: expected a list of ${MARKDOWN_PAGE_KEYS.join(', ')}; ignored`
            ]
        };
    }
    const pages: MarkdownPageKey[] = [];
    const warnings: string[] = [];
    for (const entry of value) {
        const key = String(entry).trim().toLowerCase();
        if (key === '') {
            continue;
        }
        if (!isMarkdownPageKey(key)) {
            warnings.push(
                `disableMarkdownPages: unknown page "${String(entry)}" ignored (expected ${MARKDOWN_PAGE_KEYS.join(', ')})`
            );
            continue;
        }
        if (!pages.includes(key)) {
            pages.push(key);
        }
    }
    return { pages, warnings };
};
