import * as path from 'node:path';
import * as fs from 'fs-extra';

import { err, ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import type Configuration from '../configuration';
import FileEngine from '../engines/file.engine';
import { runPagefindIndex } from '../engines/search-indexer.engine';
import { updateVersionsManifest } from '../engines/versions-manifest.engine';
import type { AdditionalAlias, MainDataInterface } from '../interfaces/main-data.interface';
import { REDIRECTS_FILE } from '../links/layout';
import { REDIRECTS_SCHEMA_VERSION, type Redirects, type RedirectsFile } from '../links/redirects';
import { type Halt, halt } from '../run/halt';
import { aliasStubFiles, isAliasStub, staleAliasStubs } from './alias-stubs';
import { faviconImage, IMAGES_FOLDER, logoImage } from './brand-images';

const cwd = process.cwd();

/** The slice of the run context the output functions read. */
export interface OutputContext {
    readonly config: typeof Configuration;
    /** `Date.now()` at run start, for the elapsed-time log line. */
    readonly startTime: number;
}

/** Output folder relative to the process cwd when it lives below it. */
const relativeOutput = (output: string): string => {
    const testOutputDir = output.match(cwd);
    return testOutputDir && testOutputDir.length > 0
        ? output.replace(`${cwd}${path.sep}`, '')
        : output;
};

/** Copy with a success info line; logs and rejects (without a reason) on failure. */
const copyOrReject = (
    from: string,
    to: string,
    successMessage: string,
    failureMessage: string
): Promise<void> =>
    fs.copy(from, to).then(
        () => {
            logger.info(successMessage);
        },
        error => {
            logger.error(failureMessage, error);
            return Promise.reject();
        }
    );

const copyTheme = (mainData: MainDataInterface, finalOutput: string): Promise<void> => {
    if (mainData.customThemePath) {
        return copyOrReject(
            mainData.customThemePath,
            path.resolve(`${finalOutput}/styles/custom.css`),
            'Custom theme copy succeeded',
            'Error during custom theme copy '
        );
    }
    if (mainData.extTheme) {
        return copyOrReject(
            path.resolve(cwd + path.sep + mainData.extTheme),
            path.resolve(`${finalOutput}/styles/`),
            'External styling theme copy succeeded',
            'Error during external styling theme copy '
        );
    }
    return Promise.resolve();
};

const copyFavicon = (mainData: MainDataInterface, finalOutput: string): Promise<void> => {
    if (mainData.customFavicon === '') {
        return Promise.resolve();
    }
    logger.info(`Custom favicon supplied`);
    return copyOrReject(
        path.resolve(cwd + path.sep + mainData.customFavicon),
        path.resolve(finalOutput, IMAGES_FOLDER, faviconImage(mainData.customFavicon).file),
        'External custom favicon copy succeeded',
        'Error during resources copy of favicon'
    );
};

const copyLogo = (mainData: MainDataInterface, finalOutput: string): Promise<void> => {
    if (mainData.customLogo === '') {
        return Promise.resolve();
    }
    logger.info(`Custom logo supplied`);
    return copyOrReject(
        path.resolve(cwd + path.sep + mainData.customLogo),
        path.resolve(finalOutput, IMAGES_FOLDER, logoImage(mainData.customLogo)),
        'External custom logo copy succeeded',
        'Error during resources copy of logo'
    );
};

const copyLogoDark = (mainData: MainDataInterface, finalOutput: string): Promise<void> => {
    if (mainData.customLogoDark === '') {
        return Promise.resolve();
    }
    return copyOrReject(
        path.resolve(cwd + path.sep + mainData.customLogoDark),
        path.resolve(finalOutput, IMAGES_FOLDER, logoImage(mainData.customLogoDark)),
        'External custom dark logo copy succeeded',
        'Error during resources copy of dark logo'
    );
};

/** Copy the user's `--assetsFolder` into the output folder. */
export const copyAssetsFolder = async (ctx: OutputContext): Promise<void> => {
    const { mainData } = ctx.config;
    logger.info('Copy assets folder');

    if (!FileEngine.existsSync(mainData.assetsFolder)) {
        logger.error(`Provided assets folder ${mainData.assetsFolder} did not exist`);
        return;
    }

    const destination = path.join(
        relativeOutput(mainData.output),
        path.basename(mainData.assetsFolder)
    );
    await fs
        .copy(path.resolve(mainData.assetsFolder), path.resolve(destination))
        .catch(error => logger.error('Error during resources copy ', error));
};

/**
 * Copy the bundled resources (styles, scripts, images) plus the optional
 * custom theme, favicon and logo. A failed resources copy stops the run
 * without finalising the output.
 */
export const copyResources = async (ctx: OutputContext): Promise<Result<void, Halt>> => {
    const { mainData } = ctx.config;
    logger.info('Copy main resources');

    const finalOutput = relativeOutput(mainData.output);
    try {
        await fs.copy(path.resolve(`${__dirname}/../src/resources/`), path.resolve(finalOutput));
    } catch (errorCopy) {
        logger.error('Error during resources copy ', errorCopy);
        return err(halt(0, 'resources'));
    }

    await Promise.all([
        copyTheme(mainData, finalOutput),
        copyFavicon(mainData, finalOutput),
        copyLogo(mainData, finalOutput),
        copyLogoDark(mainData, finalOutput)
    ]);
    return ok(undefined);
};

/**
 * Last step after every file is on disk: Pagefind indexing, the multi-version
 * `versions.json` update and the closing log line.
 */
export const finalizeOutput = async (ctx: OutputContext): Promise<Result<void, Halt>> => {
    const { mainData } = ctx.config;

    // Run Pagefind search indexing after all HTML files are written
    if (!mainData.disableSearch) {
        runPagefindIndex(mainData.output);
    }

    // Redirect pages for old additional-page URLs; written after the
    // indexing so the search never lists them. Stubs of aliases the previous
    // run wrote and this one dropped go first.
    pruneAliasStubs(mainData.output, mainData.includesFolder, mainData.additionalAliases);
    for (const { file, content } of aliasStubFiles(mainData.additionalAliases)) {
        FileEngine.writeSync(path.join(mainData.output, file), content);
    }

    // Old page paths of earlier layouts, next to this version's pages (the
    // version switcher follows them).
    if (mainData.redirects) {
        writeRedirects(mainData.output, mainData.redirects, mainData.jsonIndent);
    }

    // Multi-version: append/update this version's entry in
    // <versionsRoot>/versions.json. Runs after Pagefind so an indexing
    // failure doesn't leave a stale manifest behind. The manifest stores a
    // URL-relative path with a trailing slash (the switcher widget
    // concatenates it with the per-page tail).
    if (mainData.multiVersion && mainData.versionsRoot) {
        try {
            updateVersionsManifest({
                versionsRoot: mainData.versionsRoot,
                label: mainData.versionLabel,
                path: `${mainData.versionLabel}/`
            });
        } catch (error) {
            logger.error(`Failed to update versions.json: ${(error as Error).message}`);
            return err(halt(1, 'versions-manifest'));
        }
    }

    logger.info(
        'Documentation generated in ' +
            mainData.output +
            ' in ' +
            (Date.now() - ctx.startTime) / 1000 +
            ' seconds using ' +
            mainData.theme +
            ' theme'
    );
    return ok(undefined);
};

/** The redirects in `output`'s `redirects.json`; `undefined` when missing, unreadable or foreign. */
const readPreviousRedirects = (output: string): Redirects | undefined => {
    const file = path.join(output, REDIRECTS_FILE);
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
        const { schemaVersion, redirects } = (parsed ?? {}) as Partial<RedirectsFile>;
        if (
            schemaVersion !== REDIRECTS_SCHEMA_VERSION ||
            !redirects ||
            typeof redirects !== 'object'
        ) {
            logger.debug(`Alias stubs: ${file} has no known schema, nothing removed`);
            return undefined;
        }
        return redirects;
    } catch {
        logger.debug(`Alias stubs: no readable ${file}, nothing removed`);
        return undefined;
    }
};

/**
 * Removes the redirect pages of aliases that the previous run recorded in
 * `redirects.json` below the additional pages `folder` and this run no longer
 * has. A file goes only when it lies inside `output` and is byte-identical to
 * the stub compodocx wrote, so a page or a hand-edited file at that path stays.
 * Never throws and never removes folders. Returns the removed paths.
 */
export const pruneAliasStubs = (
    output: string,
    folder: string,
    aliases: readonly AdditionalAlias[]
): readonly string[] => {
    const previous = readPreviousRedirects(output);
    if (!previous) {
        return [];
    }
    const root = path.resolve(output);
    const removed: string[] = [];
    for (const { from, to } of staleAliasStubs(previous, aliases, folder)) {
        const file = path.resolve(root, ...from.split('/'));
        if (!file.startsWith(root + path.sep)) {
            continue;
        }
        try {
            const isFile = fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;
            if (!isFile || !isAliasStub(fs.readFileSync(file, 'utf8'), from, to)) {
                continue;
            }
            fs.unlinkSync(file);
            removed.push(from);
        } catch (error) {
            logger.warn(`Could not remove the redirect page ${from}: ${(error as Error).message}`);
        }
    }
    if (removed.length > 0) {
        logger.info(
            `Additional pages: removed ${removed.length} redirect page(s) of dropped aliases`
        );
        logger.debug(`Removed redirect pages: ${removed.join(', ')}`);
    }
    return removed;
};

/** `redirects.json` in the output folder: old page path -> current page path. */
const writeRedirects = (
    output: string,
    redirects: Readonly<Record<string, string>>,
    indent: number | undefined
): void => {
    const file: RedirectsFile = { schemaVersion: REDIRECTS_SCHEMA_VERSION, redirects };
    FileEngine.writeSync(
        path.join(output, REDIRECTS_FILE),
        `${JSON.stringify(file, null, indent ?? 0)}\n`
    );
};
