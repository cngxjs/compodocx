/**
 * `compodocx migrate inspect <project-path>` - audit-only project scanner.
 *
 * Walks a compodoc project directory and surfaces:
 *  - .hbs files: classified as migrate-able vs hard-limit (page.hbs / unknown).
 *  - CSS class-name matches against the rename rules.
 *  - ESM-package corner case: `"type": "module"` blocks the .js loader's
 *    require() call, so converted overrides need a `.cjs` extension.
 *
 * No writes - just a structured report. The CLI prints a console summary or
 * `--json` payload depending on flags.
 */

import * as path from 'node:path';
import { rewriteCss } from './css';
import { convertTemplate } from './template';
import type { FsAdapter } from './templates';
import { collectHbsFiles } from './templates';
import type { FidelityScore, InspectFinding, InspectReport } from './types';

const collectFilesByExt = (
    root: string,
    fs: FsAdapter,
    exts: ReadonlySet<string>,
    skip: ReadonlySet<string>
): readonly string[] => {
    if (!fs.isDirectory(root)) {
        return [];
    }
    const entries = fs.readdir(root);
    return entries.flatMap(name => {
        if (skip.has(name)) {
            return [];
        }
        const full = path.join(root, name);
        if (fs.isDirectory(full)) {
            return collectFilesByExt(full, fs, exts, skip);
        }
        const ext = path.extname(name);
        return exts.has(ext) ? [full] : [];
    });
};

const SKIP_DIRS: ReadonlySet<string> = new Set([
    'node_modules',
    'dist',
    'build',
    '.git',
    '.next',
    'coverage'
]);

const STYLESHEET_EXTS: ReadonlySet<string> = new Set(['.css', '.scss', '.sass']);

const inspectHbs = (file: string, fs: FsAdapter): InspectFinding => {
    const source = fs.readFile(file);
    const result = convertTemplate({ file, source });
    if (result.hardLimit) {
        return {
            kind:
                result.hardLimit.kind === 'page-layout' ? 'hbs-hard-limit' : 'hbs-unknown-override',
            severity: 'error',
            file,
            message: result.hardLimit.message,
            suggestion: result.hardLimit.suggestion
        };
    }
    return {
        kind: 'hbs-migrate-able',
        severity:
            result.score === 'green' ? 'info' : result.score === 'yellow' ? 'warning' : 'error',
        file,
        message: `migrate-able as override "${result.overrideName}" (${result.score})`,
        suggestion: `compodocx migrate template ${path.relative(process.cwd(), file)} --out <out.js>`
    };
};

const inspectCssFile = (file: string, fs: FsAdapter): readonly InspectFinding[] => {
    const source = fs.readFile(file);
    const result = rewriteCss(file, source, 'conservative');
    if (result.rewriteCount === 0 && result.auditMatches.length === 0) {
        return [];
    }
    return [
        {
            kind: 'css-class-rename',
            severity: 'warning',
            file,
            message: `${result.rewriteCount} class rename(s) available; ${result.auditMatches.length} audit-only`,
            suggestion: `compodocx migrate css ${path.relative(process.cwd(), file)} --dry-run`
        }
    ];
};

/**
 * CLI flags that compodoc shipped but compodocx renamed or removed.
 * Source-of-truth: MIGRATION.md § "CLI flag compatibility".
 */
const STALE_CLI_FLAGS: Readonly<Record<string, { reason: string; replacement: string }>> = {
    gaSite: {
        reason: 'Universal Analytics is end-of-life',
        replacement: 'use --gaID with a GA4 measurement ID (G-XXXXXXXXXX)'
    }
};

/** Compodocx-bundled themes - anything outside this set is a stale theme name. */
const COMPODOCX_THEMES: ReadonlySet<string> = new Set([
    'default',
    'gitbook',
    'ocean',
    'midnight',
    'nord',
    'rose-pine',
    'ember',
    'neon',
    'brutalist'
]);

const COMPODOC_THEME_HINTS: Readonly<Record<string, string>> = {
    material: 'closest replacement: default (Slate Noir) or ocean',
    original: 'closest replacement: default',
    postmark: 'closest replacement: nord',
    readthedocs: 'closest replacement: default',
    stripe: 'closest replacement: ocean',
    vagrant: 'closest replacement: midnight',
    laravel: 'closest replacement: ember'
};

const CONFIG_FILE_NAMES: readonly string[] = [
    '.compodocrc',
    '.compodocrc.json',
    '.compodocrc.yaml',
    '.compodocrc.yml',
    '.compodocxrc',
    '.compodocxrc.json',
    'compodocx.config.json',
    'compodoc.config.json'
];

const inspectConfigFile = (file: string, fs: FsAdapter): readonly InspectFinding[] => {
    let parsed: Record<string, unknown> | null = null;
    try {
        parsed = JSON.parse(fs.readFile(file)) as Record<string, unknown>;
    } catch {
        // YAML is not parsed (no js-yaml dep) - bail with a hint instead of crashing.
        if (file.endsWith('.yaml') || file.endsWith('.yml')) {
            return [
                {
                    kind: 'stale-cli-flag',
                    severity: 'info',
                    file,
                    message: 'YAML config detected — flag/theme audit not implemented for YAML',
                    suggestion:
                        'Re-run inspect after migrating to .compodocrc.json, or audit flags by hand against MIGRATION.md'
                }
            ];
        }
        return [];
    }
    if (!parsed) {
        return [];
    }

    const findings: InspectFinding[] = [];

    // Stale CLI flag detection
    for (const [flag, info] of Object.entries(STALE_CLI_FLAGS)) {
        if (Object.hasOwn(parsed, flag)) {
            findings.push({
                kind: 'stale-cli-flag',
                severity: 'error',
                file,
                message: `"${flag}" was removed in compodocx — ${info.reason}.`,
                suggestion: info.replacement
            });
        }
    }

    // Stale theme name detection
    const themeValue = parsed.theme;
    if (typeof themeValue === 'string' && !COMPODOCX_THEMES.has(themeValue)) {
        const hint = COMPODOC_THEME_HINTS[themeValue];
        findings.push({
            kind: 'stale-theme-name',
            severity: 'warning',
            file,
            message: `theme "${themeValue}" is not a compodocx-bundled theme.`,
            suggestion: hint
                ? `${hint}. Or supply your own CSS via --extTheme.`
                : `Pick one of: ${Array.from(COMPODOCX_THEMES).sort().join(', ')}, or supply your own CSS via --extTheme.`
        });
    }

    return findings;
};

const inspectPackageJson = (file: string, fs: FsAdapter): InspectFinding | null => {
    try {
        const content = JSON.parse(fs.readFile(file)) as { type?: string };
        if (content.type === 'module') {
            return {
                kind: 'esm-package',
                severity: 'warning',
                file,
                message:
                    'package.json declares "type": "module" — converted .js overrides will not load via require().',
                suggestion:
                    'Rename converted outputs to .cjs, OR remove the type field in the templates dir, OR keep the templates dir outside the ESM package boundary.'
            };
        }
    } catch {
        // ignore unreadable / non-JSON package.json - not a migrate concern
    }
    return null;
};

const worstSeverityToScore = (findings: readonly InspectFinding[]): FidelityScore => {
    if (findings.some(f => f.severity === 'error')) {
        return 'red';
    }
    if (findings.some(f => f.severity === 'warning')) {
        return 'yellow';
    }
    return 'green';
};

const summaryFor = (findings: readonly InspectFinding[]) =>
    findings.reduce(
        (acc, f) => ({
            ...acc,
            [f.severity === 'error' ? 'red' : f.severity === 'warning' ? 'yellow' : 'green']:
                acc[
                    f.severity === 'error' ? 'red' : f.severity === 'warning' ? 'yellow' : 'green'
                ] + 1
        }),
        { green: 0, yellow: 0, red: 0 }
    );

export const inspectProject = (root: string, fs: FsAdapter): InspectReport => {
    const hbsFindings = collectHbsFiles(root, fs).map(file => inspectHbs(file, fs));

    const cssFiles = collectFilesByExt(root, fs, STYLESHEET_EXTS, SKIP_DIRS);
    const cssFindings = cssFiles.flatMap(file => inspectCssFile(file, fs));

    const configFindings = CONFIG_FILE_NAMES.flatMap(name => {
        const cfgPath = path.join(root, name);
        return fs.isFile(cfgPath) ? inspectConfigFile(cfgPath, fs) : [];
    });

    const packageFinding = (() => {
        const pkgPath = path.join(root, 'package.json');
        return fs.isFile(pkgPath) ? inspectPackageJson(pkgPath, fs) : null;
    })();

    const findings: InspectFinding[] = [
        ...hbsFindings,
        ...cssFindings,
        ...configFindings,
        ...(packageFinding ? [packageFinding] : [])
    ];

    return {
        project: root,
        findings,
        summary: summaryFor(findings),
        score: worstSeverityToScore(findings)
    };
};
