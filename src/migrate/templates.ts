/**
 * `compodocx migrate templates <hbs-dir> --out <js-dir>` — directory walker.
 *
 * Walks a compodoc-style template directory looking for `.hbs` partials,
 * converts each one via `convertTemplate`, and writes the result to the
 * mirrored path under `--out`. Hard limits (page.hbs, unknown overrides)
 * are surfaced in the run summary, not silently skipped.
 */

import * as path from 'node:path';
import { currentOverrideName } from './override-names';
import { summarize } from './report';
import { convertTemplate } from './template';
import type { ConvertResult, RunSummary } from './types';

export interface FsAdapter {
    readdir: (dir: string) => readonly string[];
    isDirectory: (filePath: string) => boolean;
    isFile: (filePath: string) => boolean;
    readFile: (filePath: string) => string;
    writeFile: (filePath: string, content: string) => void;
    ensureDir: (dir: string) => void;
}

export const collectHbsFiles = (root: string, fs: FsAdapter): readonly string[] => {
    if (!fs.isDirectory(root)) {
        return [];
    }
    const entries = fs.readdir(root);
    return entries.flatMap(name => {
        const full = path.join(root, name);
        if (fs.isDirectory(full)) {
            return collectHbsFiles(full, fs);
        }
        return name.endsWith('.hbs') ? [full] : [];
    });
};

export interface ConvertDirectoryOptions {
    readonly inputRoot: string;
    readonly outputRoot: string;
    readonly fs: FsAdapter;
    readonly dryRun?: boolean;
}

const targetPathFor = (file: string, opts: ConvertDirectoryOptions): string => {
    const rel = path.relative(opts.inputRoot, file);
    const name = currentOverrideName(path.basename(rel).replace(/\.hbs$/, ''));
    return path.resolve(opts.outputRoot, path.dirname(rel), `${name}.js`);
};

export const convertDirectory = (opts: ConvertDirectoryOptions): RunSummary => {
    const files = collectHbsFiles(opts.inputRoot, opts.fs);
    const results: ConvertResult[] = files.map(file => {
        const source = opts.fs.readFile(file);
        const result = convertTemplate({ file, source });
        if (!opts.dryRun && result.output) {
            const targetPath = targetPathFor(file, opts);
            opts.fs.ensureDir(path.dirname(targetPath));
            opts.fs.writeFile(targetPath, result.output);
        }
        return result;
    });
    return summarize(results);
};
