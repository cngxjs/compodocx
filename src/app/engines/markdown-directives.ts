/**
 * Author opt-ins written as HTML comments in markdown. They are invisible on
 * GitHub and npm and only change how compodocx lays the next block out.
 *
 * `<!-- compodocx: inline -->` directly before a bullet list renders that list
 * as a wrapping row of chips (`ul.cdx-list-inline`). Only `ul`, only the list
 * right after the comment (whitespace between them), unknown values untouched;
 * the comment stays in the output.
 */

const INLINE = /<!--\s*compodocx:\s*inline\s*-->\s*<ul>/g;

/** Applies the list directives to rendered markdown HTML. */
export function applyListDirectives(html: string): string {
    return html.replace(INLINE, '<!-- compodocx: inline -->\n<ul class="cdx-list-inline">');
}
