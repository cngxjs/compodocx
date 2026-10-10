/**
 * `compodocx migrate <subcommand>` — CLI dispatcher.
 *
 * Wires the five subcommands behind a small commander instance that's
 * created lazily on demand (the migrate path is rarely the user's primary
 * use-case, so we don't want to pay its setup cost on every invocation).
 *
 * Designed to be re-entrant from `src/index-cli.ts` — that file detects the
 * `migrate` first arg before commander is configured for the main CLI and
 * delegates here.
 */

import * as path from 'node:path';
import { Command } from 'commander';
import pkg from '../../package.json';
import { type CssMode, isMarkupOrCode, isStylesheet, rewriteCss } from './css';
import { realFs } from './fs-adapter';
import { inspectProject } from './inspect';
import { migrateJsdoc } from './jsdoc';
import {
    printBanner,
    printDetail,
    printError,
    printHeading,
    printLine,
    printSummary as printSummaryLine,
    shouldShowBanner,
    tagFor,
    tagForSeverity
} from './printer';
import { exitCodeOf } from './report';
import { convertTemplate } from './template';
import { convertDirectory } from './templates';
import type { ConvertResult, CssRewriteResult, InspectReport, RunSummary } from './types';

const printConvertResult = (result: ConvertResult, suppressWarnings: boolean): void => {
    const where = path.relative(process.cwd(), result.file) || result.file;
    printLine(`${tagFor(result.score)} ${where} (${result.score})`);
    if (result.hardLimit) {
        printDetail('hard-limit', result.hardLimit.message);
        printDetail('suggestion', result.hardLimit.suggestion);
    }
    if (suppressWarnings) {
        return;
    }
    for (const w of result.warnings) {
        printDetail(`${w.kind}@${w.line}`, w.message);
    }
};

const printRunSummary = (summary: RunSummary): void => {
    const { green, yellow, red } = summary.summary;
    printSummaryLine(`Summary: ${green} green, ${yellow} yellow, ${red} red.`);
};

interface CommonFlags {
    readonly dryRun?: boolean;
    readonly json?: boolean;
    /**
     * Commander's `--no-X` convention: declaring `.option('--no-warnings', …)`
     * exposes `opts.warnings === false` (NOT `opts.noWarnings === true`). The
     * field name reads inverted but matches commander's contract.
     */
    readonly warnings?: boolean;
}

const suppressWarnings = (flags: CommonFlags): boolean => flags.warnings === false;

const runTemplate = async (
    file: string,
    out: string | undefined,
    flags: CommonFlags
): Promise<number> => {
    const fs = realFs();
    if (!fs.isFile(path.resolve(file))) {
        printError(`migrate template: file not found: ${file}`);
        return 2;
    }
    const source = fs.readFile(path.resolve(file));
    const result = convertTemplate({ file: path.resolve(file), source });
    if (flags.json) {
        const payload = { ...result, output: result.output };
        console.log(JSON.stringify(payload, null, 2));
        return exitCodeOf(result.score);
    }
    printConvertResult(result, suppressWarnings(flags));
    if (!result.hardLimit && !flags.dryRun && out) {
        fs.ensureDir(path.dirname(path.resolve(out)));
        fs.writeFile(path.resolve(out), result.output);
        printDetail('wrote', path.relative(process.cwd(), path.resolve(out)));
    } else if (!result.hardLimit) {
        // No --out and no --dry-run: stream the converted source to stdout so
        // the user sees what the converter produced. Without this branch the
        // command was silent — output was computed but discarded — which read
        // as a broken tool. `cat`/`sed`/`awk` all stream-by-default, this matches.
        printLine('--- preview ---');
        process.stdout.write(`${result.output}\n`);
    }
    return exitCodeOf(result.score);
};

const runTemplates = async (
    inputDir: string,
    outDir: string,
    flags: CommonFlags
): Promise<number> => {
    const fs = realFs();
    const inputRoot = path.resolve(inputDir);
    const outputRoot = path.resolve(outDir);
    const summary = convertDirectory({
        inputRoot,
        outputRoot,
        fs,
        dryRun: flags.dryRun ?? false
    });
    if (flags.json) {
        console.log(JSON.stringify(summary, null, 2));
        return exitCodeOf(summary.score);
    }
    for (const result of summary.files) {
        printConvertResult(result, suppressWarnings(flags));
    }
    printRunSummary(summary);
    return exitCodeOf(summary.score);
};

const cssTargetFiles = (target: string): readonly string[] => {
    const fs = realFs();
    const abs = path.resolve(target);
    if (fs.isFile(abs)) {
        return [abs];
    }
    if (!fs.isDirectory(abs)) {
        return [];
    }
    const walk = (dir: string): readonly string[] =>
        fs.readdir(dir).flatMap(name => {
            const full = path.join(dir, name);
            if (fs.isDirectory(full)) {
                return ['node_modules', 'dist', '.git'].includes(name) ? [] : walk(full);
            }
            return isStylesheet(full) || isMarkupOrCode(full) ? [full] : [];
        });
    return walk(abs);
};

const printCssResult = (result: CssRewriteResult, suppressWarnings: boolean): void => {
    const where = path.relative(process.cwd(), result.file) || result.file;
    printLine(
        `${tagFor(result.score)} ${where} (${result.rewriteCount} rewrites, ${result.auditMatches.length} audit-only)`
    );
    if (suppressWarnings) {
        return;
    }
    for (const w of result.warnings) {
        printDetail(`${w.kind}@${w.line}`, w.message);
    }
};

const runCss = async (target: string, mode: CssMode, flags: CommonFlags): Promise<number> => {
    const fs = realFs();
    const files = cssTargetFiles(target);
    if (files.length === 0) {
        printError(`migrate css: no css/scss/sass/html/ts files found at ${target}`);
        return 2;
    }
    const results: CssRewriteResult[] = files.map(file => {
        const source = fs.readFile(file);
        const result = rewriteCss(file, source, mode);
        if (!flags.dryRun && result.rewriteCount > 0 && result.output !== source) {
            fs.writeFile(file, result.output);
        }
        return result;
    });
    if (flags.json) {
        console.log(JSON.stringify({ mode, files: results }, null, 2));
    } else {
        for (const r of results) {
            printCssResult(r, suppressWarnings(flags));
        }
        const totalRewrites = results.reduce((sum, r) => sum + r.rewriteCount, 0);
        const totalAudits = results.reduce((sum, r) => sum + r.auditMatches.length, 0);
        printSummaryLine(
            `Summary: ${totalRewrites} rewrites${flags.dryRun ? ' (dry-run, not written)' : ''}, ${totalAudits} audit-only matches.`
        );
    }
    const worst = results.reduce<'green' | 'yellow' | 'red'>(
        (acc, r) =>
            r.score === 'red' ? 'red' : r.score === 'yellow' && acc === 'green' ? 'yellow' : acc,
        'green'
    );
    return exitCodeOf(worst);
};

const runJsdoc = async (target: string, flags: CommonFlags): Promise<number> => {
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

const printInspectReport = (report: InspectReport, suppressWarnings: boolean): void => {
    const where = path.relative(process.cwd(), report.project) || report.project;
    printHeading(`Inspect ${where}: ${report.findings.length} finding(s)`);
    for (const f of report.findings) {
        const fileLabel = path.relative(process.cwd(), f.file) || f.file;
        printLine(`${tagForSeverity(f.severity)} ${f.kind}: ${fileLabel}`);
        if (!suppressWarnings) {
            printDetail('message', f.message);
            if (f.suggestion) {
                printDetail('next-step', f.suggestion);
            }
        }
    }
    const { green, yellow, red } = report.summary;
    printSummaryLine(`Summary: ${green} info, ${yellow} warning, ${red} error.`);
};

const runInspect = async (project: string, flags: CommonFlags): Promise<number> => {
    const fs = realFs();
    const root = path.resolve(project);
    if (!fs.isDirectory(root)) {
        printError(`migrate inspect: directory not found: ${project}`);
        return 2;
    }
    const report = inspectProject(root, fs);
    if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
    } else {
        printInspectReport(report, suppressWarnings(flags));
    }
    return exitCodeOf(report.score);
};

export const runMigrateCli = async (argv: readonly string[]): Promise<number> => {
    if (shouldShowBanner(argv)) {
        printBanner(pkg.version);
    }

    const program = new Command();
    program
        .name('compodocx migrate')
        .description('Migrate compodoc Handlebars templates to compodocx JS overrides.')
        .helpOption('-h, --help', 'Show migrate CLI help');

    let exitCode = 0;

    program
        .command('template <file>')
        .description('Convert a single .hbs file to a JS override.')
        .option('--out <file>', 'Write output to <file> (default: stdout summary only)')
        .option('--dry-run', 'Preview output without writing to disk')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Suppress fidelity warnings in console output')
        .action(async (file: string, opts: CommonFlags & { out?: string }) => {
            exitCode = await runTemplate(file, opts.out, opts);
        });

    program
        .command('templates <hbs-dir>')
        .description('Convert every .hbs file in a directory to JS overrides.')
        .requiredOption('--out <dir>', 'Output directory (will be created if missing)')
        .option('--dry-run', 'Walk the input tree without writing to disk')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Suppress fidelity warnings in console output')
        .action(async (hbsDir: string, opts: CommonFlags & { out: string }) => {
            exitCode = await runTemplates(hbsDir, opts.out, opts);
        });

    program
        .command('css <file-or-dir>')
        .description('Rewrite compodoc CSS class names to compodocx equivalents.')
        .option('--aggressive', 'Also rewrite .html/.ts/.tsx (false-positive risk)')
        .option('--dry-run', 'Preview the rewrite without writing to disk')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Suppress fidelity warnings in console output')
        .action(async (target: string, opts: CommonFlags & { aggressive?: boolean }) => {
            const mode: CssMode = opts.aggressive ? 'aggressive' : 'conservative';
            exitCode = await runCss(target, mode, opts);
        });

    program
        .command('jsdoc <dir>')
        .description(
            'Remove the @category and @docsKind tags compodocx no longer reads from .ts sources.'
        )
        .option('--dry-run', 'Report the tags without writing to disk')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Accepted for symmetry; the report has no warnings')
        .action(async (dir: string, opts: CommonFlags) => {
            exitCode = await runJsdoc(dir, opts);
        });

    program
        .command('inspect <project-path>')
        .description('Audit a compodoc project for migrate-able templates and CSS classes.')
        .option('--json', 'Emit a machine-readable JSON report')
        .option('--no-warnings', 'Suppress fidelity warnings in console output')
        .action(async (project: string, opts: CommonFlags) => {
            exitCode = await runInspect(project, opts);
        });

    await program.parseAsync(argv, { from: 'user' });
    return exitCode;
};
