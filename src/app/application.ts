import * as path from 'node:path';

import { isErr } from '../lib';
import { logger } from '../utils/logger';
import { cleanSourcesForWatch, findMainSourceFolder } from '../utils/utils';
import Configuration from './configuration';
import MarkdownEngine from './engines/markdown.engine';
import {
    generationPromise,
    rejectGenerationPromise,
    resolveGenerationPromise
} from './generation-promise';
import { createGenerators, createRunContext, type Generators, type RunMode } from './run/context';
import type { Halt } from './run/halt';
import { runPhases } from './run/phases';
import { applyRunOptions } from './run/run-compodocx';
import { startWebServer } from './services/serve';

const cwd = process.cwd();

/**
 * Whether a halt during watch mode ends the process. Rebuilds of changed
 * files keep watching after a failed prepare or markdown step; a coverage
 * gate or a failed versions manifest always ends the process, and a full
 * rebuild ends it on any halt except a failed resources copy.
 */
const haltEndsWatch = (mode: RunMode, stopped: Halt): boolean => {
    if (stopped.reason === 'coverage-gate' || stopped.reason === 'versions-manifest') {
        return true;
    }
    return mode === 'full' && stopped.reason !== 'resources';
};

export class Application {
    /**
     * Files processed during initial scanning
     */
    public files: Array<string>;
    /**
     * Files processed during watch scanning
     */
    public updatedFiles: Array<string>;
    /**
     * Files changed during watch scanning
     */
    public watchChangedFiles: Array<string> = [];
    /**
     * Boolean for watching status
     * @type {boolean}
     */
    public isWatching: boolean = false;

    private readonly generators: Generators = createGenerators();

    /**
     * Create a new compodocx application instance.
     *
     * @param options An object containing the options that should be used.
     */
    constructor(options?: Readonly<Record<string, unknown>>) {
        applyRunOptions(Configuration.mainData, options ?? {});
    }

    /**
     * Start compodocx process
     */
    protected generate(): Promise<{}> {
        process.on('unhandledRejection', this.unhandledRejectionListener);
        process.on('uncaughtException', this.uncaughtExceptionListener);

        this.run('full');
        return generationPromise;
    }

    private endCallback() {
        process.removeListener('unhandledRejection', this.unhandledRejectionListener);
        process.removeListener('uncaughtException', this.uncaughtExceptionListener);
    }

    private unhandledRejectionListener(err, p) {
        console.log('Unhandled Rejection at:', p, 'reason:', err);
        logger.error(
            'Sorry, but there was a problem during parsing or generation of the documentation. Please fill an issue on github. (https://github.com/cngxjs/compodocx/issues/new)'
        ); // tslint:disable-line
        process.exit(1);
    }

    private uncaughtExceptionListener(err) {
        logger.error(err);
        logger.error(
            'Sorry, but there was a problem during parsing or generation of the documentation. Please fill an issue on github. (https://github.com/cngxjs/compodocx/issues/new)'
        ); // tslint:disable-line
        process.exit(1);
    }

    /**
     * Start compodocx documentation coverage
     */
    protected testCoverage() {
        this.run('coverage');
    }

    /**
     * Run one generation through the phases of `mode`, then serve the output
     * or settle the generation promise.
     */
    private run(mode: RunMode): void {
        const isWatchRebuild = mode === 'diff' || mode === 'markdown' || mode === 'includes';
        const ctx = createRunContext(
            { config: Configuration, files: this.files, generators: this.generators },
            mode,
            isWatchRebuild ? [...this.updatedFiles] : [],
            isWatchRebuild ? () => this.clearUpdatedFiles() : undefined
        );
        runPhases(ctx).then(result => {
            if (isErr(result)) {
                if (!this.isWatching || haltEndsWatch(mode, result.message)) {
                    process.exit(result.message.exitCode);
                }
                return;
            }
            if (Configuration.mainData.serve) {
                logger.info(
                    `Serving documentation from ${Configuration.mainData.output} at http://${Configuration.mainData.hostname}:${Configuration.mainData.port}`
                );
                this.serveAndStartWatch(Configuration.mainData.output);
            } else {
                resolveGenerationPromise(true);
                this.endCallback();
            }
        });
    }

    /**
     * Store files for initial processing
     * @param  {Array<string>} files Files found during source folder and tsconfig scan
     */
    public setFiles(files: Array<string>) {
        this.files = files;
    }

    /**
     * Store files for watch processing
     * @param  {Array<string>} files Files found during source folder and tsconfig scan
     */
    public setUpdatedFiles(files: Array<string>) {
        this.updatedFiles = files;
    }

    /**
     * Return a boolean indicating presence of one TypeScript file in updatedFiles list
     * @return {boolean} Result of scan
     */
    public hasWatchedFilesTSFiles(): boolean {
        let result = false;

        this.updatedFiles.forEach(file => {
            if (path.extname(file) === '.ts') {
                result = true;
            }
        });

        return result;
    }

    /**
     * Return a boolean indicating presence of one root markdown files in updatedFiles list
     * @return {boolean} Result of scan
     */
    public hasWatchedFilesRootMarkdownFiles(): boolean {
        let result = false;

        this.updatedFiles.forEach(file => {
            if (path.extname(file) === '.md' && path.dirname(file) === cwd) {
                result = true;
            }
        });

        return result;
    }

    /**
     * Clear files for watch processing
     */
    public clearUpdatedFiles(): void {
        this.updatedFiles = [];
        this.watchChangedFiles = [];
    }

    public serveAndStartWatch(folder: string): void {
        if (!this.isWatching) {
            startWebServer(folder, {
                host: Configuration.mainData.host || 'localhost',
                port: Configuration.mainData.port,
                open: Configuration.mainData.open
            });
        }
        this.startWatchIfRequested();
    }

    private startWatchIfRequested(): void {
        if (Configuration.mainData.watch && !this.isWatching) {
            if (typeof this.files === 'undefined') {
                logger.error('No sources files available, please use -p flag');
                rejectGenerationPromise();
                process.exit(1);
            } else {
                this.runWatch();
            }
        } else if (Configuration.mainData.watch && this.isWatching) {
            const srcFolder = findMainSourceFolder(this.files);
            logger.info(`Already watching sources in ${srcFolder} folder`);
        }
    }

    public async runWatch() {
        let sources = [findMainSourceFolder(this.files)];
        let watcherReady = false;

        this.isWatching = true;

        logger.info(`Watching sources in ${findMainSourceFolder(this.files)} folder`);

        if (MarkdownEngine.hasRootMarkdowns()) {
            sources = sources.concat(MarkdownEngine.listRootMarkdowns());
        }

        if (Configuration.mainData.includes !== '') {
            sources = sources.concat(Configuration.mainData.includes);
        }

        // Check all elements of sources list exist
        sources = cleanSourcesForWatch(sources);

        const { default: chokidar } = await import('chokidar');
        const watcher = chokidar.watch(sources, {
            awaitWriteFinish: true,
            ignoreInitial: true,
            ignored: /(spec|\.d)\.ts/
        });
        let timerAddAndRemoveRef;
        let timerChangeRef;
        const runnerAddAndRemove = () => {
            this.generate();
        };
        const waiterAddAndRemove = () => {
            clearTimeout(timerAddAndRemoveRef);
            timerAddAndRemoveRef = setTimeout(runnerAddAndRemove, 1000);
        };
        const runnerChange = () => {
            this.setUpdatedFiles(this.watchChangedFiles);
            if (this.hasWatchedFilesTSFiles()) {
                this.run('diff');
            } else if (this.hasWatchedFilesRootMarkdownFiles()) {
                this.run('markdown');
            } else {
                this.run('includes');
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
                            this.watchChangedFiles.push(path.join(cwd + path.sep + file));
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
    }

    /**
     * Return the application / root component instance.
     */
    get application(): Application {
        return this;
    }

    get isCLI(): boolean {
        return false;
    }
}
