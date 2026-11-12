import { ts } from 'ts-morph';

/**
 * TypeScript reads every `@word` after white space in a JSDoc comment as a
 * block tag, also inside a fenced code block or an inline code span. A
 * template example with `@if`, a decorator example with `@Component` or
 * inline code like `ng add @scope/pkg` then turns into tags named `if`,
 * `Component` or `scope`, and the description (or the text of the tag
 * before them) ends there. This module finds the fenced blocks and the
 * inline code spans of a comment and repairs the parsed JSDoc nodes before
 * anyone reads their tags.
 */

/** The text of one fenced block inside a comment, as absolute offsets. */
export interface FenceRange {
    /** Start of the first line after the opening fence line. */
    readonly start: number;
    /** Start of the closing fence line. */
    readonly end: number;
}

interface CommentLine {
    readonly start: number;
    readonly text: string;
}

const LINE_MARGIN = /^\s*\*? ?/;
const FENCE_LINE = /^\s*(`{3,}|~{3,})(.*)$/;

/** Lines of a comment with their absolute start, without the `*` margin. */
const commentLines = (comment: string, offset: number): readonly CommentLine[] => {
    const lines: CommentLine[] = [];
    let start = 0;
    for (const raw of comment.split('\n')) {
        const text = raw
            .replace(/\r$/, '')
            .replace(/^\s*\/\*\*/, '')
            .replace(/\*\/\s*$/, '')
            .replace(LINE_MARGIN, '');
        lines.push({ start: offset + start, text });
        start += raw.length + 1;
    }
    return lines;
};

interface OpenFence {
    readonly char: string;
    readonly length: number;
    readonly start: number;
}

/** An opening fence; a backtick fence whose info string holds a backtick opens nothing. */
const openingFence = (line: CommentLine, next: number): OpenFence | undefined => {
    const match = FENCE_LINE.exec(line.text);
    if (!match) {
        return undefined;
    }
    const [, marker, info] = match;
    if (marker[0] === '`' && info.includes('`')) {
        return undefined;
    }
    return { char: marker[0], length: marker.length, start: next };
};

/** A closing fence: the same character, at least as long, nothing after it. */
const closesFence = (line: CommentLine, open: OpenFence): boolean => {
    const match = FENCE_LINE.exec(line.text);
    return (
        match !== null &&
        match[1][0] === open.char &&
        match[1].length >= open.length &&
        match[2].trim() === ''
    );
};

/**
 * The closed fenced blocks of one comment (` ``` ` or `~~~`, three or more,
 * indented or not, with or without an info string). A block left open at
 * the end of the comment does not count.
 */
export const fencedRanges = (comment: string, offset = 0): readonly FenceRange[] => {
    const lines = commentLines(comment, offset);
    const ranges: FenceRange[] = [];
    let open: OpenFence | undefined;
    lines.forEach((line, index) => {
        const next = lines[index + 1]?.start ?? offset + comment.length;
        if (open === undefined) {
            open = openingFence(line, next);
            return;
        }
        if (closesFence(line, open)) {
            ranges.push({ start: open.start, end: line.start });
            open = undefined;
        }
    });
    return ranges;
};

/**
 * The inline code spans of one comment, as absolute offsets of the text
 * between the backticks: a run of backticks up to the next run of the same
 * length on the same line. A run without a partner on its line and a
 * backslash-escaped backtick open nothing; a span never crosses a line
 * break, so a tag at the start of a line is never inside one.
 */
export const codeSpans = (comment: string, offset = 0): readonly FenceRange[] => {
    const spans: FenceRange[] = [];
    let lineStart = 0;
    for (const line of comment.split('\n')) {
        const runs = [...line.matchAll(/`+/g)].map(run => {
            const escaped = run.index > 0 && line[run.index - 1] === '\\';
            return { index: run.index, length: run[0].length, escaped };
        });
        let open = 0;
        while (open < runs.length) {
            const opener = runs[open];
            const start = opener.escaped ? opener.index + 1 : opener.index;
            const length = opener.escaped ? opener.length - 1 : opener.length;
            const close =
                length === 0 ? -1 : runs.findIndex((run, i) => i > open && run.length === length);
            if (close === -1) {
                open += 1;
                continue;
            }
            spans.push({
                start: offset + lineStart + start + length,
                end: offset + lineStart + runs[close].index
            });
            open = close + 1;
        }
        lineStart += line.length + 1;
    }
    return spans;
};

const insideRange = (ranges: readonly FenceRange[], position: number): boolean =>
    ranges.some(range => position >= range.start && position < range.end);

/**
 * Comment text between two offsets, the way TypeScript joins it: margins
 * removed (indentation after the margin kept), outer blank space trimmed.
 * Inline links stay as written.
 */
const textBetween = (source: string, from: number, to: number): string => {
    const [first, ...rest] = source.slice(from, to).split('\n');
    const lines = [first.trimStart(), ...rest.map(line => line.replace(LINE_MARGIN, ''))];
    return lines
        .map(line => line.replace(/\s+$/, ''))
        .join('\n')
        .trim();
};

const COMMENT_KINDS = new Set<ts.SyntaxKind>([
    ts.SyntaxKind.JSDocText,
    ts.SyntaxKind.JSDocLink,
    ts.SyntaxKind.JSDocLinkCode,
    ts.SyntaxKind.JSDocLinkPlain
]);

/** Where the text of a tag starts: after its name, type and parameter name. */
const tagTextStart = (tag: ts.JSDocTag): number => {
    let start = tag.tagName.end;
    const take = (node: ts.Node): void => {
        if (!COMMENT_KINDS.has(node.kind)) {
            start = Math.max(start, node.end);
        }
    };
    ts.forEachChild(tag, take, nodes => {
        for (const node of nodes) {
            take(node);
        }
    });
    return start;
};

type MutableJSDoc = { -readonly [K in keyof ts.JSDoc]: ts.JSDoc[K] };
type MutableTag = { -readonly [K in keyof ts.JSDocTag]: ts.JSDocTag[K] };

/**
 * Removes the tags TypeScript found inside fenced blocks or inline code
 * spans of one JSDoc and
 * rebuilds the text they cut off: the description when the first tag is
 * such a tag, and the text of each real tag directly followed by one.
 * Returns whether anything changed; a JSDoc without such a tag is untouched.
 */
export const repairJSDoc = (doc: ts.JSDoc, source: string): boolean => {
    const tags = doc.tags;
    if (!tags || tags.length === 0) {
        return false;
    }
    const comment = source.slice(doc.pos, doc.end);
    const ranges = [...fencedRanges(comment, doc.pos), ...codeSpans(comment, doc.pos)];
    const fenced = tags.map(tag => insideRange(ranges, tag.pos));
    if (!fenced.includes(true)) {
        return false;
    }
    const textEnd = source.slice(doc.end - 2, doc.end) === '*/' ? doc.end - 2 : doc.end;
    const real = tags.filter((_, index) => !fenced[index]);
    const nextRealStart = (index: number): number => {
        const next = tags.findIndex((_, i) => i > index && !fenced[i]);
        return next === -1 ? textEnd : tags[next].pos;
    };

    const mutable = doc as MutableJSDoc;
    if (fenced[0]) {
        const description = textBetween(source, doc.pos + 3, nextRealStart(-1));
        mutable.comment = description === '' ? undefined : description;
    }
    tags.forEach((tag, index) => {
        if (fenced[index] || !fenced[index + 1]) {
            return;
        }
        const text = textBetween(source, tagTextStart(tag), nextRealStart(index));
        (tag as MutableTag).comment = text === '' ? undefined : text;
    });
    mutable.tags =
        real.length === 0 ? undefined : ts.setTextRange(ts.factory.createNodeArray(real), tags);
    return true;
};

const repaired = new WeakSet<ts.SourceFile>();
/** Files without a backtick or a tilde fence have nothing to repair. */
const MAY_NEED_REPAIR = /`|~~~/;

/**
 * Repairs every JSDoc of a source file once (see `repairJSDoc`). Must run
 * before the first `ts.getJSDocTags` call on its nodes: TypeScript caches
 * the tags per node.
 */
export const repairFencedTags = <T extends ts.SourceFile | undefined>(sourceFile: T): T => {
    if (!sourceFile || repaired.has(sourceFile)) {
        return sourceFile;
    }
    repaired.add(sourceFile);
    const source = sourceFile.text;
    if (!MAY_NEED_REPAIR.test(source)) {
        return sourceFile;
    }
    const visit = (node: ts.Node): void => {
        for (const doc of (node as { jsDoc?: readonly ts.JSDoc[] }).jsDoc ?? []) {
            repairJSDoc(doc, source);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return sourceFile;
};
