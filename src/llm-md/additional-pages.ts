/**
 * Additional pages section of the llm-md export: one `###` block per page
 * from `--includes`, children right after their parent, the Markdown as
 * written with its headings moved below the page heading.
 */

import type { ExportAdditionalPage } from '../app/interfaces/export-data.interface';
import { escapeMarkdown } from './format';

/** Headings of a page start one level below the `###` page heading. */
const FIRST_LEVEL = 4;
const MAX_LEVEL = 6;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^( {0,3})(#{1,6})(?=[ \t]|$)/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
/** A line that can be the text of a setext heading: not a block marker of its own. */
const PARAGRAPH_LINE = /^ {0,3}(?![#>|<]|[-*+][ \t]|\d+[.)][ \t]|`{3}|~{3}|-->)\S/;

interface Heading {
    readonly line: number;
    readonly level: number;
    /** Index of the setext underline; absent for ATX headings. */
    readonly underline?: number;
}

const closesFence = (line: string, fence: string): boolean =>
    new RegExp(`^ {0,3}${fence[0] === '`' ? '`' : '~'}{${fence.length},}[ \\t]*$`).test(line);

/** An HTML comment that starts on this line and does not end on it. */
const opensComment = (line: string): boolean =>
    /^ {0,3}<!--/.test(line) && !line.includes('-->', line.indexOf('<!--') + 4);

/** The headings of the text, outside fenced code and HTML comments. */
const findHeadings = (lines: readonly string[]): Heading[] => {
    const headings: Heading[] = [];
    const plain = new Set<number>();
    let fence: string | undefined;
    let comment = false;
    lines.forEach((line, index) => {
        if (fence !== undefined) {
            fence = closesFence(line, fence) ? undefined : fence;
            return;
        }
        if (comment) {
            comment = !line.includes('-->');
            return;
        }
        const open = FENCE_OPEN.exec(line);
        if (open) {
            fence = open[1];
            return;
        }
        if (opensComment(line)) {
            comment = true;
            return;
        }
        const atx = ATX.exec(line);
        if (atx) {
            headings.push({ line: index, level: atx[2].length });
            return;
        }
        const underline = SETEXT_UNDERLINE.exec(line);
        const text = index - 1;
        const startsBlock = text === 0 || lines[text - 1]?.trim() === '';
        if (underline && plain.has(text) && PARAGRAPH_LINE.test(lines[text]) && startsBlock) {
            plain.delete(text);
            headings.push({
                line: text,
                level: underline[1][0] === '=' ? 1 : 2,
                underline: index
            });
            return;
        }
        plain.add(index);
    });
    return headings;
};

/**
 * The Markdown with its headings moved down so the shallowest one is `####`
 * (never moved up, at most `######`). Fenced code and HTML comments are left
 * alone; setext headings become ATX headings. Text without headings comes
 * back unchanged.
 */
export const demoteHeadings = (markdown: string): string => {
    const lines = markdown.split(/\r?\n/);
    const headings = findHeadings(lines);
    if (headings.length === 0) {
        return markdown;
    }
    const shift = FIRST_LEVEL - Math.min(...headings.map(heading => heading.level));
    if (shift <= 0) {
        return markdown;
    }
    const hashes = (level: number): string => '#'.repeat(Math.min(MAX_LEVEL, level + shift));
    const out = [...lines];
    const dropped = new Set<number>();
    for (const heading of headings) {
        if (heading.underline === undefined) {
            out[heading.line] = lines[heading.line].replace(
                ATX,
                (_match, indent: string) => `${indent}${hashes(heading.level)}`
            );
        } else {
            out[heading.line] = `${hashes(heading.level)} ${lines[heading.line].trim()}`;
            dropped.add(heading.underline);
        }
    }
    return out.filter((_line, index) => !dropped.has(index)).join('\n');
};

const inTreeOrder = (pages: readonly ExportAdditionalPage[]): ExportAdditionalPage[] =>
    pages.flatMap(page => [page, ...inTreeOrder(page.children ?? [])]);

const pageBlock = (page: ExportAdditionalPage): string => {
    const heading = `### ${escapeMarkdown(page.title)}`;
    const body = demoteHeadings(page.markdown)
        .replace(/^(?:[ \t]*\r?\n)+/, '')
        .trimEnd();
    return body ? `${heading}\n\n${body}` : heading;
};

/** Every page and its children as `###` blocks, in tree order; '' without pages. */
export const emitAdditionalPages = (pages: ReadonlyArray<ExportAdditionalPage>): string =>
    inTreeOrder(pages).map(pageBlock).join('\n\n');
