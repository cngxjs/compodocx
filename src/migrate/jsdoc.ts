/**
 * `compodocx migrate jsdoc` — strips the `@category` and `@docsKind` tags
 * compodocx no longer reads from TypeScript sources. Pure per file; the CLI
 * walks the tree and writes through an `FsAdapter`.
 */

import * as path from 'node:path';
import type { FsAdapter } from './templates';

export interface JsdocStripResult {
    readonly file: string;
    readonly output: string;
    /** Tags removed from the file. */
    readonly removed: number;
}

const REMOVED = /^@(category|docsKind)\b/;
const JSDOC_BLOCK = /\/\*\*[\s\S]*?\*\//g;
const SKIPPED_DIRS: ReadonlySet<string> = new Set(['node_modules', 'dist']);

/** Text of a comment line without its leading `*` decoration. */
const lineText = (line: string): string => line.replace(/^\s*\/?\*+\/?\s?/, '').trim();

const isBlankStarLine = (line: string): boolean => /^\s*\*\s*$/.test(line);

interface BlockResult {
    readonly text: string;
    readonly removed: number;
}

/** One JSDoc block without the removed tags; `''` when nothing is left. */
const stripBlock = (block: string): BlockResult => {
    if (!block.includes('\n')) {
        const inner = block.slice(3, -2).trim();
        return REMOVED.test(inner) ? { text: '', removed: 1 } : { text: block, removed: 0 };
    }
    const lines = block.split('\n');
    const last = lines.length - 1;
    const kept: string[] = [];
    let removed = 0;
    let dropping = false;
    let droppedBeforeEnd = false;
    for (let i = 0; i < lines.length; i++) {
        const text = i === 0 || i === last ? '' : lineText(lines[i]);
        if (i > 0 && i < last && REMOVED.test(text)) {
            dropping = true;
            removed++;
            continue;
        }
        if (dropping && i < last && !text.startsWith('@')) {
            continue;
        }
        if (i === last && dropping) {
            droppedBeforeEnd = true;
        }
        dropping = false;
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
    const hasContent = kept.slice(1, -1).some(line => lineText(line) !== '');
    return { text: hasContent ? kept.join('\n') : '', removed };
};

/**
 * `source` without `@category` / `@docsKind` tags (each with its continuation
 * lines up to the next tag or the end of the comment). A JSDoc block left
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
        } else {
            output += source.slice(cursor, start);
            cursor = end;
        }
    }
    output += source.slice(cursor);
    return { file, output: removed > 0 ? output : source, removed };
};

/** `.ts` files below `root` (declaration files, `node_modules` and `dist` skipped), sorted. */
export const jsdocTargetFiles = (root: string, fs: FsAdapter): string[] => {
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
