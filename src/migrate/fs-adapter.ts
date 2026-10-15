/**
 * Minimal filesystem adapter - keeps `templates.ts` testable without mocks
 * by isolating every disk touch behind a small interface.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FsAdapter } from './templates';

export const realFs = (): FsAdapter => ({
    readdir: dir => fs.readdirSync(dir),
    isDirectory: p => fs.existsSync(p) && fs.statSync(p).isDirectory(),
    isFile: p => fs.existsSync(p) && fs.statSync(p).isFile(),
    readFile: p => fs.readFileSync(p, 'utf8'),
    writeFile: (p, content) => fs.writeFileSync(p, content, 'utf8'),
    ensureDir: dir => fs.mkdirSync(dir, { recursive: true })
});

/** In-memory adapter used by tests - no disk I/O. */
export interface MemoryFsContents {
    [absolutePath: string]: string;
}

export const memoryFs = (
    initial: MemoryFsContents
): {
    adapter: FsAdapter;
    state: MemoryFsContents;
} => {
    const state: MemoryFsContents = { ...initial };
    const directories = new Set<string>();
    const recordParents = (p: string): void => {
        let dir = path.dirname(p);
        while (dir && dir !== '/' && !directories.has(dir)) {
            directories.add(dir);
            dir = path.dirname(dir);
        }
    };
    for (const p of Object.keys(state)) {
        recordParents(p);
    }
    const adapter: FsAdapter = {
        readdir: dir => {
            const prefix = dir.endsWith(path.sep) ? dir : dir + path.sep;
            const entries = new Set<string>();
            for (const p of Object.keys(state)) {
                if (p.startsWith(prefix)) {
                    const rest = p.slice(prefix.length);
                    const head = rest.split(path.sep)[0];
                    if (head) {
                        entries.add(head);
                    }
                }
            }
            for (const d of directories) {
                if (d.startsWith(prefix)) {
                    const rest = d.slice(prefix.length);
                    const head = rest.split(path.sep)[0];
                    if (head) {
                        entries.add(head);
                    }
                }
            }
            return Array.from(entries).sort();
        },
        isDirectory: p => directories.has(p),
        isFile: p => Object.hasOwn(state, p),
        readFile: p => {
            const contents = state[p];
            if (contents === undefined) {
                throw new Error(`memoryFs: file not found ${p}`);
            }
            return contents;
        },
        writeFile: (p, content) => {
            state[p] = content;
            recordParents(p);
        },
        ensureDir: dir => {
            directories.add(dir);
            recordParents(dir);
        }
    };
    return { adapter, state };
};
