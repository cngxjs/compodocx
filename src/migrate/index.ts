/**
 * `compodocx migrate <subcommand>` - CLI dispatcher.
 *
 * Wires the `jsdoc` subcommand (strips the `@category` / `@docsKind` tags
 * compodocx no longer reads) behind a small commander instance that's
 * created lazily on demand (the migrate path is rarely the user's primary
 * use-case, so we don't want to pay its setup cost on every invocation).
 *
 * Designed to be re-entrant from `src/index-cli.ts` - that file detects the
 * `migrate` first arg before commander is configured for the main CLI and
 * delegates here.
 */

import * as path from 'node:path';
import { Command } from 'commander';
import pkg from '../../package.json';
import { realFs } from './fs-adapter';
import { migrateJsdoc } from './jsdoc';
import {
    printBanner,
    printError,
    printLine,
    printSummary as printSummaryLine,
    shouldShowBanner
} from './printer';

interface JsdocFlags {
    readonly dryRun?: boolean;
    readonly json?: boolean;
    /**
     * Commander's `--no-X` convention: declaring `.option('--no-warnings', …)`
     * exposes `opts.warnings === false` (NOT `opts.noWarnings === true`). The
     * field name reads inverted but matches commander's contract.
     */
    readonly warnings?: boolean;
}

const runJsdoc = async (target: string, flags: JsdocFlags): Promise<number> => {
    const fs = realFs();
    const root = path.resolve(target);
    if (!fs.isDirectory(root) && !fs.isFile(root)) {
        printError(`migrate jsdoc: not found: ${target}`);
        return 2;
    }
    const result = migrateJsdoc(root, fs, flags.dryRun === true);
    if (flags.json) {
        console.log(
            JSON.stringify(
                {
                    scanned: result.scanned,
                    removed: result.removed,
                    files: result.files.map(file => ({
                        file: path.relative(process.cwd(), file.file) || file.file,
                        removed: file.removed
                    }))
                },
                null,
                2
            )
        );
        return 0;
    }
    for (const file of result.files) {
        printLine(
            `${path.relative(process.cwd(), file.file) || file.file}: ${file.removed} tag(s)`
        );
    }
    printSummaryLine(
        `Summary: ${result.removed} @category / @docsKind tags removed in ${result.files.length} of ${result.scanned} files${flags.dryRun ? ' (dry-run, not written)' : ''}.`
    );
    return 0;
};

export const runMigrateCli = async (argv: readonly string[]): Promise<number> => {
    if (shouldShowBanner(argv)) {
        printBanner(pkg.version);
    }

    const program = new Command();
    program
        .name('compodocx migrate')
        .description('Migrate sources to the current compodocx conventions.')
        .helpOption('-h, --help', 'Show migrate CLI help');

    let exitCode = 0;

    program
        .command('jsdoc <dir>')
        .description(
            'Remove the @category and @docsKind tags compodocx no longer reads from .ts sources.'
        )
        .option('--dry-run', 'Report the tags without writing to disk')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Accepted for symmetry; the report has no warnings')
        .action(async (dir: string, opts: JsdocFlags) => {
            exitCode = await runJsdoc(dir, opts);
        });

    await program.parseAsync(argv, { from: 'user' });
    return exitCode;
};
