import { isErr } from '../../lib';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { createGenerators, createRunContext } from './context';
import type { Halt } from './halt';
import { generateAndServe, type Session, serveAndMaybeWatch } from './watch';

export interface RunOptions {
    /** Source files to document, as found by the caller's scan. */
    readonly files: readonly string[];
    /** `coverage` runs the documentation coverage test; default `full`. */
    readonly mode?: 'full' | 'coverage';
    /** Values for `mainData` keys; unknown keys are ignored. */
    readonly options?: Readonly<Record<string, unknown>>;
}

export type RunOutcome =
    | { readonly kind: 'generated'; readonly output: string; readonly seconds: number }
    | { readonly kind: 'serving'; readonly output: string }
    | { readonly kind: 'halted'; readonly exitCode: 0 | 1 | 2 };

/**
 * Copy run options onto `mainData`: only keys `mainData` already has, `name`
 * as the documentation title, and `silent` (which, as always, re-enables
 * logging).
 */
export const applyRunOptions = (
    mainData: MainDataInterface,
    options: Readonly<Record<string, unknown>>
): void => {
    for (const option in options) {
        if (typeof mainData[option] !== 'undefined') {
            mainData[option] = options[option];
        }
        // For documentationMainName, process it outside the loop, for handling conflict with pages name
        if (option === 'name') {
            mainData.documentationMainName = options[option] as string;
        }
        if (option === 'silent') {
            logger.silent = false;
        }
    }
};

/**
 * One session per process: the generators are created once and shared by
 * the initial run and every watch rebuild.
 */
export const createSession = (
    files: readonly string[] | undefined,
    onWatchHalt: (stopped: Halt) => void
): Session => ({
    config: Configuration,
    files,
    generators: createGenerators(),
    isWatching: false,
    onWatchHalt
});

/** Run a one-shot generation (`full` or `coverage`) in an existing session. */
export const runSession = async (
    session: Session,
    mode: 'full' | 'coverage'
): Promise<RunOutcome> => {
    const ctx = createRunContext(
        { config: session.config, files: session.files ?? [], generators: session.generators },
        mode
    );
    const result = await generateAndServe(session, ctx);
    if (isErr(result)) {
        return { kind: 'halted', exitCode: result.message.exitCode };
    }
    const output = ctx.config.mainData.output;
    return result.value === 'serving'
        ? { kind: 'serving', output }
        : { kind: 'generated', output, seconds: (Date.now() - ctx.startTime) / 1000 };
};

/** Serve an already generated folder, watching the sources when `--watch` is set. */
export const serveOnly = async (session: Session, folder: string): Promise<RunOutcome> => {
    const served = await serveAndMaybeWatch(session, folder);
    return isErr(served)
        ? { kind: 'halted', exitCode: served.message.exitCode }
        : { kind: 'serving', output: folder };
};

/**
 * Generate the documentation for an already scanned file list. With
 * `serve` (and `watch`) in the options the output is served and the sources
 * are watched; halts during watch mode are logged and do not stop the
 * process.
 *
 * @experimental The command line interface is the supported entry point.
 * This programmatic API may change before 1.0.0.
 */
export const runCompodocx = (opts: RunOptions): Promise<RunOutcome> => {
    applyRunOptions(Configuration.mainData, opts.options ?? {});
    return runSession(
        createSession(opts.files, () => undefined),
        opts.mode ?? 'full'
    );
};
