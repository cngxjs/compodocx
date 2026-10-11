import * as fs from 'node:fs';
import * as path from 'node:path';

import { logger } from '../../utils/logger';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import {
    buildStyleModel,
    discoverStyleFiles,
    formatListedNote,
    formatStyleSummary,
    type StyleFs,
    type StyleModel
} from '../styles';

/** Directory listing below `base`; a missing folder lists nothing. */
const nodeStyleFs = (base: string): StyleFs => ({
    list: dir => {
        try {
            return fs
                .readdirSync(path.resolve(base, dir), { withFileTypes: true })
                .map(entry => ({ name: entry.name, dir: entry.isDirectory() }));
        } catch {
            return [];
        }
    }
});

const slashed = (file: string): string => file.split(path.sep).join('/');

type Component = { readonly file?: unknown; readonly styleUrls?: unknown };

/** The style files components read as `styleUrl` / `styleUrls`, relative to `cwd`. */
export const componentStyleFiles = (
    components: readonly Component[],
    cwd: string
): ReadonlySet<string> => {
    const files = new Set<string>();
    for (const component of components) {
        if (typeof component.file !== 'string' || !Array.isArray(component.styleUrls)) {
            continue;
        }
        const dir = path.dirname(path.resolve(cwd, component.file));
        for (const url of component.styleUrls) {
            if (typeof url === 'string') {
                files.add(slashed(path.relative(cwd, path.resolve(dir, url))));
            }
        }
    }
    return files;
};

export interface StylesRun {
    readonly model: StyleModel;
    /** Matches that are not `.css` / `.scss`, relative to `cwd`. */
    readonly ignored: readonly string[];
    /** Matches a component already reads as its style, relative to `cwd`. */
    readonly skipped: readonly string[];
}

/**
 * Read the files the `styleFiles` globs match and build the style model.
 * Undefined when the config sets no globs.
 */
export const deriveStyles = (
    mainData: MainDataInterface,
    components: readonly Component[],
    cwd: string
): StylesRun | undefined => {
    if (mainData.styleFiles.length === 0) {
        return undefined;
    }
    const base =
        mainData.styleFilesBase || path.dirname(path.resolve(cwd, mainData.tsconfig || '.'));
    const output = slashed(path.relative(base, path.resolve(cwd, mainData.output || '.')));
    const exclude = output && !output.startsWith('..') ? [output] : [];
    const found = discoverStyleFiles(mainData.styleFiles, exclude, nodeStyleFs(base));
    const fromCwd = (file: string) => slashed(path.relative(cwd, path.resolve(base, file)));
    const own = componentStyleFiles(components, cwd);
    const files = found.files.map(fromCwd);
    const model = buildStyleModel(
        files
            .filter(file => !own.has(file))
            .map(file => ({ file, content: fs.readFileSync(path.resolve(cwd, file), 'utf8') }))
    );
    return {
        model,
        ignored: found.ignored.map(fromCwd),
        skipped: files.filter(file => own.has(file))
    };
};

/** The build log of a styles run. */
export const logStyles = (run: StylesRun): void => {
    if (run.ignored.length > 0) {
        logger.warn(
            `styleFiles: ${run.ignored.length} matched files are not .css or .scss; ignored: ` +
                run.ignored.slice(0, 5).join(', ') +
                (run.ignored.length > 5 ? ', ...' : '')
        );
    }
    for (const file of run.skipped) {
        logger.debug(`styleFiles: ${file} is a component style; shown on its Theming tab`);
    }
    logger.info(formatStyleSummary(run.model));
    const note = formatListedNote(run.model);
    if (note) {
        logger.info(note);
    }
    for (const file of run.model.listed) {
        logger.debug(`Style file without documented content: ${file}`);
    }
};
