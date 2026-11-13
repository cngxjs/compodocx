import { linkTagsAsText } from '../../utils/link-parser';

/** Abbreviations whose trailing period does not end a sentence. */
const ABBREVIATION_BEFORE = /(?:^|[^a-z.])(?:e\.g|i\.e|etc|vs|cf)$/i;

/** Inline tags a page summary keeps (attributes dropped). */
const KEPT_TAGS = new Set(['code', 'em', 'strong']);

/** Tags whose boundary reads as whitespace (line break, block edges). */
const SPACE_TAGS = /^(?:br|p|li|ul|ol|div|h[1-6]|blockquote|pre|tr|td|th|table)$/;

const TAG = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;

/** Index just past the tag starting at `index`, or `index` when none starts there. */
const skipTag = (text: string, index: number): number => {
    if (text[index] !== '<') {
        return index;
    }
    const close = text.indexOf('>', index);
    return close < 0 ? index : close + 1;
};

const isCodeOpen = (text: string, index: number): boolean => /^<code\b/i.test(text.slice(index));

/**
 * Index of the character that ends the first sentence of `text`, or -1 when
 * it has none: `.`, `!` or `?` followed by whitespace or the end of the
 * string. A period after `e.g`, `i.e`, `etc`, `vs` or `cf` is no sentence
 * end. HTML tags are skipped and `<code>` contents never end a sentence, so
 * the same function serves plain text and summary HTML.
 */
export function sentenceEnd(text: string): number {
    let index = 0;
    while (index < text.length) {
        if (isCodeOpen(text, index)) {
            const close = text.toLowerCase().indexOf('</code>', index);
            index = close < 0 ? text.length : close + '</code>'.length;
            continue;
        }
        const afterTag = skipTag(text, index);
        if (afterTag !== index) {
            index = afterTag;
            continue;
        }
        if (isSentenceEnd(text, index)) {
            return index;
        }
        index++;
    }
    return -1;
}

const isSentenceEnd = (text: string, index: number): boolean => {
    const char = text[index];
    if (char !== '.' && char !== '!' && char !== '?') {
        return false;
    }
    let next = index + 1;
    while (text[next] === '<' && text[next + 1] === '/') {
        const afterTag = skipTag(text, next);
        if (afterTag === next) {
            break;
        }
        next = afterTag;
    }
    const followedBySpace = next >= text.length || /\s/.test(text[next]);
    if (!followedBySpace) {
        return false;
    }
    return char !== '.' || !ABBREVIATION_BEFORE.test(stripTags(text.slice(0, index)));
};

const stripTags = (html: string): string => html.replace(/<[^>]+>/g, '');

/** Keeps `<code>`, `<em>`, `<strong>` without attributes; links read as their text. */
const sanitize = (html: string): string =>
    html.replace(TAG, (_tag, slash: string, rawName: string) => {
        const name = rawName.toLowerCase();
        if (KEPT_TAGS.has(name)) {
            return `<${slash}${name}>`;
        }
        return SPACE_TAGS.test(name) ? ' ' : '';
    });

/** Appends closing tags for kept tags left open by a cut. */
const closeOpenTags = (html: string): string => {
    const open: string[] = [];
    for (const match of html.matchAll(/<(\/?)(code|em|strong)>/g)) {
        if (match[1] === '/') {
            const at = open.lastIndexOf(match[2]);
            if (at >= 0) {
                open.splice(at, 1);
            }
        } else {
            open.push(match[2]);
        }
    }
    return (
        html +
        open
            .reverse()
            .map(name => `</${name}>`)
            .join('')
    );
};

/**
 * First sentence of rendered description HTML for page lists (feature
 * members, utilities, namespaces, providers). Unlike `firstSentence` it keeps
 * inline markup (`<code>`, `<em>`, `<strong>`), turns links into their text
 * (the summary sits inside a linked row or card), drops other tags without
 * inserting spaces, and has no length cap (cards clamp with CSS).
 *
 * Returns `undefined` for empty input or input without text.
 */
export function pageSummary(html: unknown): string | undefined {
    if (typeof html !== 'string' || html.length === 0) {
        return undefined;
    }
    const clean = linkTagsAsText(sanitize(html)).replace(/\s+/g, ' ').trim();
    if (!stripTags(clean).trim()) {
        return undefined;
    }
    const end = sentenceEnd(clean);
    const cut = end < 0 ? clean : clean.slice(0, end);
    const sentence = closeOpenTags(cut.replace(/[.!?]+$/, '').trim());
    return stripTags(sentence).trim() ? sentence : clean;
}
