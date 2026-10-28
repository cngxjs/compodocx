/**
 * `compodocx migrate jsdoc` - strips the `@category` and `@docsKind` tags
 * compodocx no longer reads from TypeScript sources. Pure per file; the CLI
 * walks the tree and writes through an `FsAdapter`.
 */

import * as path from 'node:path';
import type { FsAdapter } from './fs-adapter';

export interface JsdocStripResult {
    readonly file: string;
    readonly output: string;
    /** Tags removed from the file. */
    readonly removed: number;
}

const REMOVED = /^@(category|docsKind)\b/;
/** A block tag: `@name` at the start of the text or after whitespace (`{@link}` is not one). */
const TAG_START = /(?<=^|\s)@[A-Za-z]/g;
const FENCE = /^(```|~~~)/;
const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g;
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist']);

/** Text of a comment line without its leading `*` decoration. */
const lineText = (line: string): string => line.replace(/^\s*\/?\*+\/?\s?/, '').trim();

const isBlankStarLine = (line: string): boolean => /^\s*\*\s*$/.test(line);

interface BlockResult {
    readonly text: string;
    readonly removed: number;
}

/**
 * `text` without the removed tags, each taken up to the next tag. The text
 * before the first tag and the other tags stay; trailing space is trimmed.
 */
const stripInline = (text: string): BlockResult => {
    const starts = [...text.matchAll(TAG_START)].map(match => match.index ?? 0);
    const segments = starts.map((start, i) => text.slice(start, starts[i + 1] ?? text.length));
    const kept = segments.filter(segment => !REMOVED.test(segment));
    const removed = segments.length - kept.length;
    if (removed === 0) {
        return { text, removed: 0 };
    }
    const prefix = text.slice(0, starts[0]);
    return { text: (prefix + kept.join('')).trimEnd(), removed };
};

/** The closing line of a block split into its decoration and its text. */
const CLOSING_LINE = /^(\s*(?:\*(?!\/)\s?)?)(.*?)\s*\*\/$/;

/**
 * One JSDoc block without the removed tags; `''` when nothing is left. A
 * removed tag takes only its own line: the lines below it belong to whatever
 * precedes the tag. A blank line right after a removed tag goes too when the
 * tag stood after a blank line or first in the block. On the opening and the
 * closing line, and in a single-line block, only the tag and its text go.
 * Lines inside a code fence are left alone.
 */
const stripBlock = (block: string): BlockResult => {
    if (!block.includes('\n')) {
        const result = stripInline(block.slice(3, -2).trim());
        if (result.removed === 0) {
            return { text: block, removed: 0 };
        }
        return { text: result.text === '' ? '' : `/** ${result.text} */`, removed: result.removed };
    }
    const lines = block.split('\n');
    const last = lines.length - 1;
    const kept: string[] = [];
    let removed = 0;
    let afterTag = false;
    let dropBlank = false;
    let droppedBeforeEnd = false;
    let inFence = false;

    const opening = stripInline(lines[0].slice(3).trim());
    if (opening.removed > 0) {
        removed += opening.removed;
        lines[0] = opening.text === '' ? '/**' : `/** ${opening.text}`;
        afterTag = opening.text === '';
        dropBlank = afterTag;
    }

    kept.push(lines[0]);
    for (let i = 1; i < lines.length; i++) {
        const inner = i < last;
        const text = inner ? lineText(lines[i]) : '';
        if (inner && FENCE.test(text)) {
            inFence = !inFence;
        }
        if (inner && !inFence && REMOVED.test(text)) {
            if (!afterTag) {
                dropBlank = lineText(kept[kept.length - 1]) === '';
            }
            afterTag = true;
            removed++;
            continue;
        }
        if (afterTag && inner && dropBlank && isBlankStarLine(lines[i])) {
            afterTag = false;
            droppedBeforeEnd = i === last - 1;
            continue;
        }
        if (i === last && !inFence) {
            const closing = CLOSING_LINE.exec(lines[i]);
            const result = closing ? stripInline(closing[2]) : { text: '', removed: 0 };
            if (closing && result.removed > 0) {
                removed += result.removed;
                if (result.text === '') {
                    kept.push(`${/^\s*/.exec(lines[i])?.[0] ?? ''}*/`);
                    droppedBeforeEnd = true;
                    break;
                }
                kept.push(`${closing[1]}${result.text} */`);
                break;
            }
        }
        if (i === last && afterTag) {
            droppedBeforeEnd = true;
        }
        afterTag = false;
        kept.push(lines[i]);
    }
    if (removed === 0) {
        return { text: block, removed: 0 };
    }
    if (droppedBeforeEnd) {
        while (kept.length > 2 && isBlankStarLine(kept[kept.length - 2])) {
            kept.splice(kept.length - 2, 1);
        }
    }
    const hasContent =
        lineText(kept[0]) !== '' || kept.slice(1, -1).some(line => lineText(line) !== '');
    return { text: hasContent ? kept.join('\n') : '', removed };
};

/**
 * `source` without `@category` / `@docsKind` tag lines. A JSDoc block left
 * empty is dropped with its line; everything else stays byte-identical.
 */
export const stripRemovedJsdocTags = (file: string, source: string): JsdocStripResult => {
    let removed = 0;
    let output = '';
    let cursor = 0;
    for (const match of source.matchAll(JSDOC_BLOCK)) {
        const start = match.index ?? 0;
        const result = stripBlock(match[0]);
        if (result.removed === 0) {
            continue;
        }
        removed += result.removed;
        if (result.text !== '') {
            output += source.slice(cursor, start) + result.text;
            cursor = start + match[0].length;
            continue;
        }
        // Drop the emptied block, and its whole line when nothing else is on it.
        const lineStart = source.lastIndexOf('\n', start - 1) + 1;
        const before = source.slice(lineStart, start);
        const end = start + match[0].length;
        const newline = source.indexOf('\n', end);
        const lineEnd = newline === -1 ? source.length : newline;
        const after = source.slice(end, lineEnd);
        if (before.trim() === '' && after.trim() === '') {
            output += source.slice(cursor, lineStart);
            cursor = newline === -1 ? source.length : newline + 1;
        } else if (after.trim() === '') {
            // Code before the block: drop the space between them too.
            output += source.slice(cursor, start).trimEnd();
            cursor = end;
        } else {
            // Code after the block: its leading space would double the gap.
            output += source.slice(cursor, start);
            cursor = end + (after.length - after.trimStart().length);
        }
    }
    output += source.slice(cursor);
    return { file, output: removed > 0 ? output : source, removed };
};

/** `.ts` files below `root` (declaration files, `node_modules` and `dist` skipped), sorted. */
const jsdocTargetFiles = (root: string, fs: FsAdapter): string[] => {
    if (fs.isFile(root)) {
        return root.endsWith('.ts') && !root.endsWith('.d.ts') ? [root] : [];
    }
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const name of [...fs.readdir(dir)].sort()) {
            const full = path.join(dir, name);
            if (fs.isDirectory(full)) {
                if (!SKIPPED_DIRS.has(name)) {
                    walk(full);
                }
            } else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) {
                out.push(full);
            }
        }
    };
    if (fs.isDirectory(root)) {
        walk(root);
    }
    return out;
};

export interface JsdocMigration {
    /** Files with at least one removed tag. */
    readonly files: readonly JsdocStripResult[];
    readonly scanned: number;
    readonly removed: number;
}

/** Strip the tags in every target file; nothing is written on a dry run. */
export const migrateJsdoc = (root: string, fs: FsAdapter, dryRun: boolean): JsdocMigration => {
    const targets = jsdocTargetFiles(root, fs);
    const files = targets
        .map(file => stripRemovedJsdocTags(file, fs.readFile(file)))
        .filter(result => result.removed > 0);
    if (!dryRun) {
        for (const result of files) {
            fs.writeFile(result.file, result.output);
        }
    }
    return {
        files,
        scanned: targets.length,
        removed: files.reduce((sum, result) => sum + result.removed, 0)
    };
};
