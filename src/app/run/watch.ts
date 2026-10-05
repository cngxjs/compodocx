import * as path from 'node:path';

import { err, isErr, ok, type Result } from '../../lib';
import { logger } from '../../utils/logger';
import { cleanSourcesForWatch, findMainSourceFolder } from '../../utils/utils';
import MarkdownEngine from '../engines/markdown.engine';
import { startWebServer } from '../services/serve';
import { createRunContext, type RunBase, type RunContext, type RunMode } from './context';
import { type Halt, halt } from './halt';
import { runPhases } from './phases';

const cwd = process.cwd();

/**
 * Process-wide state of one compodocx invocation: what every run shares,
 * whether chokidar is running, and who decides on a halt during watch mode.
 */
export interface Session extends Omit<RunBase, 'files'> {
    /** Undefined when only serving an existing folder (`-s` without `-p`). */
    readonly files: readonly string[] | undefined;
    isWatching: boolean;
    /** Called when a halt during watch mode ends the process. */
    readonly onWatchHalt: (stopped: Halt) => void;
}

export interface WatchHandle {
    close(): Promise<void>;
}

export type Generated = 'generated' | 'serving';

/**
 * Whether a halt during watch mode ends the process. Rebuilds of changed
 * files keep watching after a failed prepare or markdown step; a coverage
 * gate or a failed versions manifest always ends the process, and a full
 * rebuild ends it on any halt except a failed resources copy.
 */
export const haltEndsWatch = (mode: RunMode, stopped: Halt): boolean => {
    if (stopped.reason === 'coverage-gate' || stopped.reason === 'versions-manifest') {
        return true;
    }
    return mode === 'full' && stopped.reason !== 'resources';
};

const runBase = (session: Session): RunBase => ({
    config: session.config,
    files: session.files ?? [],
    generators: session.generators
});

/**
 * Run one generation, then serve the output (and start watching) when
 * `--serve` is set.
 */
export const generateAndServe = async (
    session: Session,
    ctx: RunContext
): Promise<Result<Generated, Halt>> => {
    const result = await runPhases(ctx);
    if (isErr(result)) {
        return err(result.message);
    }
    const { mainData } = ctx.config;
    if (!mainData.serve) {
        return ok('generated');
    }
    logger.info(
        `Serving documentation from ${mainData.output} at http://${mainData.hostname}:${mainData.port}`
    );
    const served = await serveAndMaybeWatch(session, mainData.output);
    return isErr(served) ? err(served.message) : ok('serving');
};

const hasTsFiles = (files: readonly string[]): boolean =>
    files.some(file => path.extname(file) === '.ts');

const hasRootMarkdownFiles = (files: readonly string[]): boolean =>
    files.some(file => path.extname(file) === '.md' && path.dirname(file) === cwd);

/** Watch the sources, root markdown files and includes; rebuild on change. */
export const startWatch = async (session: Session): Promise<WatchHandle> => {
    const files = session.files ?? [];
    let sources = [findMainSourceFolder([...files])];
    let watcherReady = false;
    let watchChangedFiles: string[] = [];

    session.isWatching = true;

    logger.info(`Watching sources in ${findMainSourceFolder([...files])} folder`);

    if (MarkdownEngine.hasRootMarkdowns()) {
        sources = sources.concat(MarkdownEngine.listRootMarkdowns());
    }

    if (session.config.mainData.includes !== '') {
        sources = sources.concat(session.config.mainData.includes);
    }

    // Check all elements of sources list exist
    sources = cleanSourcesForWatch(sources);

    const rebuild = async (
        mode: RunMode,
        updatedFiles: readonly string[] = [],
        onEmitStart?: () => void
    ) => {
        const ctx = createRunContext(runBase(session), mode, updatedFiles, onEmitStart);
        const result = await generateAndServe(session, ctx);
        if (isErr(result) && haltEndsWatch(mode, result.message)) {
            session.onWatchHalt(result.message);
        }
    };
    const clearChangedFiles = () => {
        watchChangedFiles = [];
    };

    const { default: chokidar } = await import('chokidar');
    const watcher = chokidar.watch(sources, {
        awaitWriteFinish: true,
        ignoreInitial: true,
        ignored: /(spec|\.d)\.ts/
    });
    let timerAddAndRemoveRef: ReturnType<typeof setTimeout> | undefined;
    let timerChangeRef: ReturnType<typeof setTimeout> | undefined;
    const runnerAddAndRemove = () => {
        // Re-runs with the file list of the initial scan; new files are not picked up.
        void rebuild('full');
    };
    const waiterAddAndRemove = () => {
        clearTimeout(timerAddAndRemoveRef);
        timerAddAndRemoveRef = setTimeout(runnerAddAndRemove, 1000);
    };
    const runnerChange = () => {
        const updatedFiles = [...watchChangedFiles];
        if (hasTsFiles(updatedFiles)) {
            void rebuild('diff', updatedFiles, clearChangedFiles);
        } else if (hasRootMarkdownFiles(updatedFiles)) {
            void rebuild('markdown', updatedFiles, clearChangedFiles);
        } else {
            void rebuild('includes', updatedFiles, clearChangedFiles);
        }
    };
    const waiterChange = () => {
        clearTimeout(timerChangeRef);
        timerChangeRef = setTimeout(runnerChange, 1000);
    };

    watcher.on('ready', () => {
        if (!watcherReady) {
            watcherReady = true;
            watcher
                .on('add', file => {
                    logger.debug(`File ${file} has been added`);
                    // Test extension, if ts
                    // rescan everything
                    if (path.extname(file) === '.ts') {
                        waiterAddAndRemove();
                    }
                })
                .on('change', file => {
                    logger.debug(`File ${file} has been changed`);
                    // Test extension, if ts
                    // rescan only file
                    if (
                        path.extname(file) === '.ts' ||
                        path.extname(file) === '.md' ||
                        path.extname(file) === '.json'
                    ) {
                        watchChangedFiles.push(path.join(cwd + path.sep + file));
                        waiterChange();
                    }
                })
                .on('unlink', file => {
                    logger.debug(`File ${file} has been removed`);
                    // Test extension, if ts
                    // rescan everything
                    if (path.extname(file) === '.ts') {
                        waiterAddAndRemove();
                    }
                });
        }
    });

    return {
        close: async () => {
            clearTimeout(timerAddAndRemoveRef);
            clearTimeout(timerChangeRef);
            await watcher.close();
        }
    };
};

/**
 * Serve `folder` (once per process) and start watching when `--watch` is
 * set. Watching needs the scanned sources; without them the run halts.
 */
export const serveAndMaybeWatch = async (
    session: Session,
    folder: string
): Promise<Result<void, Halt>> => {
    const { mainData } = session.config;
    if (!session.isWatching) {
        startWebServer(folder, {
            host: mainData.host || 'localhost',
            port: mainData.port,
            open: mainData.open
        });
    }
    if (mainData.watch && !session.isWatching) {
        if (typeof session.files === 'undefined') {
            logger.error('No sources files available, please use -p flag');
            return err(halt(1, 'no-sources'));
        }
        await startWatch(session);
    } else if (mainData.watch && session.isWatching) {
        const srcFolder = findMainSourceFolder([...(session.files ?? [])]);
        logger.info(`Already watching sources in ${srcFolder} folder`);
    }
    return ok(undefined);
};
