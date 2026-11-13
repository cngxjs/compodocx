/**
 * Lead-in convention for markdown: a paragraph or list item that opens with a
 * short bold label ending in `.` or `:` (`**Parts.** Text`) gets classes so
 * README styles can set the label in its own column. Detection is structural
 * only: the label must be the very first thing, plain text, at most 40
 * characters. Everything else renders exactly like marked's defaults.
 */

const LEAD_IN = /^<strong>([^<]{1,40}?)([.:])<\/strong>\s+([\s\S]+)$/;

/** The label and text markup shared by paragraphs and list items, or undefined. */
const leadInParts = (text: string): string | undefined => {
    const match = LEAD_IN.exec(text);
    if (!match) {
        return undefined;
    }
    const [, label, punct, rest] = match;
    return (
        `<strong class="cdx-leadin-label">${label}<span class="cdx-leadin-punct">${punct}</span></strong>` +
        ` <span class="cdx-leadin-text">${rest}</span>`
    );
};

/** `renderer.paragraph` for marked 7: lead-in paragraphs get `p.cdx-leadin`. */
export function leadInParagraph(text: string): string {
    const parts = leadInParts(text);
    return parts === undefined ? `<p>${text}</p>\n` : `<p class="cdx-leadin">${parts}</p>\n`;
}

/**
 * `renderer.listitem` for marked 7: an item of a tight list that opens with a
 * bold label gets `li.cdx-leadin`. Task items and items of loose lists (their
 * text starts with `<p>`, which `leadInParagraph` already handled) stay as
 * marked renders them.
 */
export function leadInListItem(text: string, task: boolean): string {
    const parts = task ? undefined : leadInParts(text);
    return parts === undefined ? `<li>${text}</li>\n` : `<li class="cdx-leadin">${parts}</li>\n`;
}
