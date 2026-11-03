import type { Token, Tokens } from 'marked';

import { markedAcl } from '../../utils/marked.acl';

/** Tokens before the first heading that do not count as content. */
const LEADING_SKIPPED = new Set(['space', 'html']);

/** Inline tokens whose text is a leaf of the plain text. */
const TEXT_LEAVES = new Set(['text', 'codespan', 'escape']);

/** Inline tokens that add nothing to the plain text. */
const DROPPED = new Set(['html', 'image', 'br']);

/** The escapes marked 7 writes into the `text` of inline tokens. */
const MARKED_ESCAPES: Readonly<Record<string, string>> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'"
};

const decodeMarkedEscapes = (text: string): string =>
    text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => MARKED_ESCAPES[entity]);

const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();

const flatten = (tokens: readonly Token[]): string =>
    tokens
        .map(token => {
            if (DROPPED.has(token.type)) {
                return '';
            }
            if (TEXT_LEAVES.has(token.type)) {
                return decodeMarkedEscapes((token as Tokens.Generic).text ?? '');
            }
            const nested = (token as Tokens.Generic).tokens;
            return Array.isArray(nested) ? flatten(nested) : '';
        })
        .join('');

const isHeading = (token: Token | undefined, depths: (depth: number) => boolean): boolean =>
    token?.type === 'heading' && depths((token as Tokens.Heading).depth);

/**
 * The subtitle of a Markdown page: the plain text of the heading (depth 2 to
 * 6) that directly follows the first-level heading the page starts with.
 * Blank lines and HTML comments (such as an `@aiGenerated` marker) before the
 * first heading and blank lines between the two headings are skipped; any
 * other content in between, or a page that does not start with a first-level
 * heading, gives none. Inline markup is flattened to its text, images and
 * inline HTML are dropped, whitespace is collapsed. An empty result is none.
 */
export const pageSubtitle = (raw: string): string | undefined => {
    const tokens = markedAcl.lexer(raw);
    let index = 0;
    while (index < tokens.length && LEADING_SKIPPED.has(tokens[index].type)) {
        index++;
    }
    if (!isHeading(tokens[index], depth => depth === 1)) {
        return undefined;
    }
    index++;
    while (index < tokens.length && tokens[index].type === 'space') {
        index++;
    }
    const next = tokens[index];
    if (!isHeading(next, depth => depth >= 2 && depth <= 6)) {
        return undefined;
    }
    const text = collapse(flatten((next as Tokens.Heading).tokens));
    return text === '' ? undefined : text;
};

export interface LinkTooltipInput {
    /** The `includesTooltips` switch; off gives no tooltip at all. */
    readonly enabled: boolean;
    /** Tooltip set in summary.json or the labels file; `''` turns it off. */
    readonly override: string | undefined;
    /** The Markdown of the page as written. */
    readonly raw: string;
    /** The visible text of the link. */
    readonly label: string;
}

const normalised = (text: string): string => collapse(text).toLowerCase();

/**
 * The tooltip of the sidebar link of an additional page as plain text (not
 * escaped): the override when given, else the subtitle of the page. None when
 * disabled, when the text is empty, or when the label already contains it
 * (whitespace collapsed, case-insensitive).
 */
export const linkTooltip = (input: LinkTooltipInput): string | undefined => {
    if (!input.enabled) {
        return undefined;
    }
    const text = input.override === undefined ? pageSubtitle(input.raw) : collapse(input.override);
    if (text === undefined || text === '') {
        return undefined;
    }
    return normalised(input.label).includes(normalised(text)) ? undefined : text;
};
