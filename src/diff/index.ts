/**
 * `compodocx diff <flags>` - CLI dispatcher.
 *
 * Surface mirrors the migrate CLI: a small commander instance lazily
 * configured on the first invocation, returning a process exit code.
 * `src/index-cli.ts` intercepts `process.argv[2] === 'diff'` BEFORE the
 * main commander parses the doc-generation surface and delegates here.
 *
 * Exit code semantics (matches plan):
 *   0 - no breaking, no additive
 *   1 - additive only (warning territory)
 *   2 - at least one breaking, OR a fatal error (parse failure, schemaVersion mismatch, missing flag)
 */

import { Command } from 'commander';
import pkg from '../../package.json';
import { printBanner, printError } from '../migrate/printer';
import { classifyAll, exitCodeFromSummary, summarize } from './classify';
import { compare } from './compare';
import { renderConsole, shouldShowDiffBanner } from './format/console';
import { renderJson } from './format/json';
import { renderMarkdown } from './format/markdown';
import { parseDiffInputs } from './parse';
import type { DiffResult, DiffSnapshotMeta } from './types';

interface DiffFlags {
    readonly old: string;
    readonly new: string;
    readonly json?: boolean;
    readonly md?: boolean;
    /**
     * Commander `--no-warnings` convention: declaring `.option('--no-warnings', …)`
     * exposes `opts.warnings === false` (NOT `opts.noWarnings === true`). The
     * field reads inverted but matches commander's contract (F1).
     */
    readonly warnings?: boolean;
}

const suppressNonBreaking = (flags: DiffFlags): boolean => flags.warnings === false;

const buildDiffResult = (
    fromVersion: DiffSnapshotMeta,
    toVersion: DiffSnapshotMeta,
    schemaVersion: number,
    classified: ReturnType<typeof classifyAll>,
    unchanged: number
): DiffResult => {
    const summary = summarize(classified, unchanged);
    return {
        schemaVersion,
        comparedAt: new Date().toISOString(),
        from: fromVersion,
        to: toVersion,
        summary,
        changes: classified
    };
};

const runDiff = async (flags: DiffFlags): Promise<number> => {
    if (!flags.old || !flags.new) {
        printError('diff: both --old and --new are required');
        return 2;
    }
    const parsed = parseDiffInputs(flags.old, flags.new);
    if (parsed.ok === false) {
        printError(parsed.message);
        return 2;
    }
    const { from, to } = parsed.value;
    const { changes, unchanged } = compare(from.data, to.data);
    const classified = classifyAll(changes);
    const result = buildDiffResult(
        {
            generatedAt: from.data.generatedAt ?? '',
            compodocxVersion: from.data.compodocxVersion ?? ''
        },
        {
            generatedAt: to.data.generatedAt ?? '',
            compodocxVersion: to.data.compodocxVersion ?? ''
        },
        from.schemaVersion,
        classified,
        unchanged
    );

    if (flags.json) {
        process.stdout.write(`${renderJson(result)}\n`);
    } else if (flags.md) {
        process.stdout.write(renderMarkdown(result));
    } else {
        renderConsole(result, suppressNonBreaking(flags));
    }

    return exitCodeFromSummary(result.summary);
};

export const runDiffCli = async (argv: readonly string[]): Promise<number> => {
    if (shouldShowDiffBanner(argv)) {
        printBanner(pkg.version);
    }

    const program = new Command();
    program
        .name('compodocx diff')
        .description(
            'Compare two compodocx documentation.json snapshots and report added / removed / changed symbols.'
        )
        .helpOption('-h, --help', 'Show diff CLI help')
        .requiredOption('--old <file>', 'Path to the older documentation.json snapshot')
        .requiredOption('--new <file>', 'Path to the newer documentation.json snapshot')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--md', 'Emit a markdown table for changelog automation')
        .option(
            '--no-warnings',
            'Suppress non-breaking entries in console output (breaking changes still shown)'
        );

    let exitCode = 0;
    program.action(async (opts: DiffFlags) => {
        exitCode = await runDiff(opts);
    });

    try {
        await program.parseAsync(argv, { from: 'user' });
    } catch (err) {
        printError(`diff: ${(err as Error).message}`);
        return 2;
    }
    return exitCode;
};
