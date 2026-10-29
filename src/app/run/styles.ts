import * as fs from 'node:fs';
import * as path from 'node:path';

import { err, ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { lookupName, type SymbolTable } from '../links';
import {
    buildStyleModel,
    discoverStyleFiles,
    formatListedNote,
    formatListedThemes,
    formatStyleSummary,
    formatThemeProblem,
    resolveThemes,
    type StyleFs,
    type StyleModel,
    type ThemeHit,
    type ThemeMiss,
    type ThemeProblem
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

const THEMED_KINDS: ReadonlySet<string> = new Set(['component', 'directive']);

/** A `@themes` name as a component or directive of the table (`{@link}` tie-break). */
export const themeResolver =
    (table: SymbolTable) =>
    (name: string): Result<ThemeHit, ThemeMiss> => {
        const id = lookupName(table, name, 'doc-link');
        if (id === undefined) {
            return err(table.byName.has(name) ? 'wrong-kind' : 'not-found');
        }
        const kind = table.byId.get(id)?.ref.kind;
        if (kind === undefined || !THEMED_KINDS.has(kind)) {
            return err('wrong-kind');
        }
        const themed = new Set(
            (table.byName.get(name) ?? []).filter(other =>
                THEMED_KINDS.has(table.byId.get(other)?.ref.kind ?? '')
            )
        );
        return ok({ id, ambiguous: themed.size > 1 });
    };

export interface StylesRun {
    readonly model: StyleModel;
    /** Files with `@themes` names that did not resolve. */
    readonly problems: readonly ThemeProblem[];
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
    table: SymbolTable,
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
    const built = buildStyleModel(
        files
            .filter(file => !own.has(file))
            .map(file => ({ file, content: fs.readFileSync(path.resolve(cwd, file), 'utf8') })),
        mainData.themingPrivatePrefix
    );
    const { model, problems } = resolveThemes(built, themeResolver(table));
    return {
        model,
        problems,
        ignored: found.ignored.map(fromCwd),
        skipped: files.filter(file => own.has(file))
    };
};

/** The build log of a styles run; `sections` = `themingTabSections`. */
export const logStyles = (run: StylesRun, sections: readonly string[] | undefined): void => {
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
    for (const problem of run.problems) {
        logger.warn(formatThemeProblem(problem));
    }
    for (const listed of run.model.listedThemes) {
        logger.warn(formatListedThemes(listed));
    }
    logger.info(formatStyleSummary(run.model, sections));
    const note = formatListedNote(run.model);
    if (note) {
        logger.info(note);
    }
    for (const file of run.model.listed) {
        logger.debug(`Style file without documented content: ${file}`);
    }
};
