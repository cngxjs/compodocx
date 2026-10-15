/**
 * `compodocx playground:validate <docsDir>` - CLI dispatcher.
 *
 * Compiles every `@playground` embedded in a generated documentation folder
 * (`npm install` + `npm run build` per project) and prints a per-playground
 * pass/fail summary. This is the CI gate that catches a broken playground
 * before a user ever clicks Launch. Opt-in and decoupled from the docs build
 * - it reads the produced HTML, never the live pipeline.
 *
 * `src/index-cli.ts` intercepts `process.argv[2] === 'playground:validate'`
 * and delegates here. Exit codes: `0` all passed / none found, `1` at least
 * one failed, `2` fatal (bad args, unreadable docs dir).
 */

import { spawnSync } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { Command } from 'commander';
import * as fs from 'fs-extra';
import pkg from '../../package.json';
import { type ExtractedManifest, extractManifestsFromHtml } from './extract';
import {
    type BuildRunner,
    exitCodeFromResults,
    formatSummary,
    type Materializer,
    type RunOutcome,
    validateAll
} from './runner';

interface ValidateFlags {
    readonly keep?: boolean;
    readonly filter?: string;
    readonly installCmd?: string;
    readonly buildCmd?: string;
}

const listHtmlFiles = (root: string): string[] => {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.name === 'node_modules') {
                continue;
            }
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (entry.isFile() && entry.name.endsWith('.html')) {
                out.push(full);
            }
        }
    };
    walk(root);
    return out;
};

/** Read every HTML file under `docsDir` and collect its manifests. */
const collectManifests = (docsDir: string): ExtractedManifest[] => {
    const entries: ExtractedManifest[] = [];
    const seen = new Set<string>();
    for (const file of listHtmlFiles(docsDir)) {
        const rel = path.relative(docsDir, file);
        let html: string;
        try {
            html = fs.readFileSync(file, 'utf8');
        } catch {
            continue;
        }
        for (const extracted of extractManifestsFromHtml(html, rel)) {
            // The same playground may render on more than one page - dedupe by id.
            if (seen.has(extracted.id)) {
                continue;
            }
            seen.add(extracted.id);
            entries.push(extracted);
        }
    }
    return entries;
};

const makeMaterializer =
    (tmpRoot: string): Materializer =>
    (entry: ExtractedManifest): string => {
        const dir = path.join(tmpRoot, entry.id);
        fs.ensureDirSync(dir);
        for (const [rel, content] of Object.entries(entry.manifest.files)) {
            const target = path.join(dir, rel);
            fs.ensureDirSync(path.dirname(target));
            fs.writeFileSync(target, content, 'utf8');
        }
        return dir;
    };

const makeNpmRunner = (flags: ValidateFlags): BuildRunner => {
    const run = (dir: string, command: string): RunOutcome => {
        const [cmd, ...args] = command.split(' ');
        const res = spawnSync(cmd, args, {
            cwd: dir,
            encoding: 'utf8',
            shell: process.platform === 'win32'
        });
        const output = `${res.stdout ?? ''}${res.stderr ?? ''}`;
        const code = res.status ?? 1;
        return {
            ok: code === 0 && !res.error,
            code,
            output: res.error ? `${res.error.message}\n${output}` : output
        };
    };
    return {
        install: (dir: string) => run(dir, flags.installCmd ?? 'npm install --no-audit --no-fund'),
        build: (dir: string) => run(dir, flags.buildCmd ?? 'npm run build')
    };
};

const runValidate = async (docsDir: string, flags: ValidateFlags): Promise<number> => {
    const resolvedDocs = path.resolve(docsDir);
    if (!fs.existsSync(resolvedDocs)) {
        process.stderr.write(`playground:validate — docs directory not found: ${docsDir}\n`);
        return 2;
    }

    let entries = collectManifests(resolvedDocs);
    if (flags.filter) {
        const needle = flags.filter.toLowerCase();
        entries = entries.filter(
            e =>
                e.manifest.title.toLowerCase().includes(needle) ||
                e.id.toLowerCase().includes(needle) ||
                (e.sourceFile ?? '').toLowerCase().includes(needle)
        );
    }

    if (entries.length === 0) {
        process.stdout.write('playground:validate — no @playground manifests found.\n');
        return 0;
    }

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'compodocx-pg-'));
    process.stdout.write(
        `playground:validate — compiling ${entries.length} playground(s) in ${tmpRoot}\n`
    );
    try {
        const results = validateAll(entries, {
            materialize: makeMaterializer(tmpRoot),
            runner: makeNpmRunner(flags),
            onStart: (entry, index, total) => {
                process.stdout.write(`  [${index + 1}/${total}] ${entry.manifest.title} …\n`);
            }
        });
        process.stdout.write(`\n${formatSummary(results)}\n`);
        return exitCodeFromResults(results);
    } finally {
        if (!flags.keep) {
            fs.removeSync(tmpRoot);
        } else {
            process.stdout.write(`\nKept project directories in ${tmpRoot}\n`);
        }
    }
};

/** Entry point invoked from `src/index-cli.ts`. Returns a process exit code. */
export async function runPlaygroundValidateCli(argv: string[]): Promise<number> {
    const program = new Command();
    program
        .name('compodocx playground:validate')
        .description('Compile every @playground in a generated docs folder and report pass/fail')
        .version(pkg.version)
        .argument('<docsDir>', 'path to the generated documentation folder')
        .option('--filter <text>', 'only validate playgrounds whose title/id/source matches')
        .option('--keep', 'keep the temporary project directories for inspection')
        .option('--installCmd <cmd>', 'override the install command (default: npm install)')
        .option('--buildCmd <cmd>', 'override the build command (default: npm run build)')
        .allowExcessArguments(false);

    let docsDir = '';
    const flags: ValidateFlags = {};
    program.action((dir: string, opts: ValidateFlags) => {
        docsDir = dir;
        Object.assign(flags, opts);
    });

    try {
        program.parse(argv, { from: 'user' });
    } catch {
        return 2;
    }
    if (!docsDir) {
        program.outputHelp();
        return 2;
    }
    return runValidate(docsDir, flags);
}
