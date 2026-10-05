import { isErr } from '../../lib';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import type { MainDataInterface } from '../interfaces/main-data.interface';
import { createGenerators, createRunContext } from './context';
import { runPhases } from './phases';

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
 * Generate the documentation for an already scanned file list.
 *
 * @experimental The command line interface is the supported entry point.
 * This programmatic API may change before 1.0.0.
 */
export const runCompodocx = async (opts: RunOptions): Promise<RunOutcome> => {
    applyRunOptions(Configuration.mainData, opts.options ?? {});
    const ctx = createRunContext(
        { config: Configuration, files: opts.files, generators: createGenerators() },
        opts.mode ?? 'full'
    );
    const result = await runPhases(ctx);
    if (isErr(result)) {
        return { kind: 'halted', exitCode: result.message.exitCode };
    }
    return {
        kind: 'generated',
        output: ctx.config.mainData.output,
        seconds: (Date.now() - ctx.startTime) / 1000
    };
};
