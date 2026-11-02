import { escapeHtmlText } from './escape';

/** A link over the characters `[start, end)` of the plain text Shiki highlighted. */
export type TextLink = {
    readonly start: number;
    readonly end: number;
    readonly href: string;
    readonly target: string;
};

const ENTITY = /&(?:#x([0-9a-f]+)|#(\d+)|(lt|gt|amp|quot|apos));/gi;
const NAMED: Readonly<Record<string, string>> = {
    lt: '<',
    gt: '>',
    amp: '&',
    quot: '"',
    apos: "'"
};

const decode = (html: string): string =>
    html.replace(ENTITY, (_, hex: string, dec: string, name: string) => {
        if (hex) {
            return String.fromCodePoint(Number.parseInt(hex, 16));
        }
        if (dec) {
            return String.fromCodePoint(Number(dec));
        }
        return NAMED[name.toLowerCase()];
    });

/** Positions inside `[from, to)` where a link starts or ends. */
const cutsWithin = (from: number, to: number, links: readonly TextLink[]): number[] =>
    links
        .flatMap(link => [link.start, link.end])
        .filter(cut => cut > from && cut < to)
        .sort((a, b) => a - b);

const linkAt = (offset: number, links: readonly TextLink[]): TextLink | undefined =>
    links.find(link => offset >= link.start && offset < link.end);

/** One token's text, split at link boundaries, with the linked pieces wrapped in `<a>`. */
const linkedToken = (text: string, offset: number, links: readonly TextLink[]): string => {
    const bounds = [offset, ...cutsWithin(offset, offset + text.length, links)];
    return bounds
        .map((start, i) => {
            const end = bounds[i + 1] ?? offset + text.length;
            const piece = escapeHtmlText(text.slice(start - offset, end - offset));
            const link = linkAt(start, links);
            return link ? `<a href="${link.href}" target="${link.target}">${piece}</a>` : piece;
        })
        .join('');
};

/**
 * Put links back into Shiki output. Shiki highlights plain text only, so a
 * signature with type links is highlighted as text first and the links are
 * laid over the token spans by character offset: the colour stays on the
 * span, the `<a>` goes inside it. `highlighted` is the inner HTML of Shiki's
 * `<code>`; `links` refer to offsets in the text it was made from. Pure.
 */
export const linkHighlightedTokens = (highlighted: string, links: readonly TextLink[]): string => {
    if (links.length === 0) {
        return highlighted;
    }
    let offset = 0;
    return highlighted.replace(
        /(<span[^>]*>)([^<]*)(<\/span>)/g,
        (_, open: string, html: string, close: string) => {
            const text = decode(html);
            const start = offset;
            offset += text.length;
            const touched = links.some(link => link.start < offset && link.end > start);
            return touched ? `${open}${linkedToken(text, start, links)}${close}` : _;
        }
    );
};

/**
 * Remove the first `count` characters of text from Shiki output, token by
 * token; a token left empty is dropped with its span. Used to strip a prefix
 * that only gave the grammar its context. Pure.
 */
export const dropLeadingText = (highlighted: string, count: number): string => {
    let left = count;
    return highlighted.replace(
        /(<span[^>]*>)([^<]*)(<\/span>)/g,
        (whole, open: string, html: string, close: string) => {
            if (left === 0) {
                return whole;
            }
            const text = decode(html);
            const cut = Math.min(left, text.length);
            left -= cut;
            const rest = text.slice(cut);
            return rest ? `${open}${escapeHtmlText(rest)}${close}` : '';
        }
    );
};
