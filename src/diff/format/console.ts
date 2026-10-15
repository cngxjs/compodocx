/**
 * Human-readable console formatter.
 *
 * Reuses the migrate CLI's printer helpers (timestamp, padded keys,
 * picocolors tags) so `compodocx migrate` and `compodocx diff` carry the
 * same visual identity. The TTY-aware banner is up to the caller (the diff
 * dispatcher checks `shouldShowDiffBanner` from this file before printing).
 */

import c from 'picocolors';
import { printDetail, printLine, printSummary as printSummaryLine } from '../../migrate/printer';
import type { DiffResult, EntityChange, Severity } from '../types';

const tagFor = (severity: Severity): string => {
    switch (severity) {
        case 'breaking':
            return c.red('[BREAKING]');
        case 'additive':
            return c.yellow('[ADDITIVE]');
        case 'docs-only':
            return c.dim('[DOCS]    ');
    }
};

const labelFor = (change: EntityChange): string => {
    if (change.kind.endsWith('-added')) {
        return `${change.entity} ${change.name}: new`;
    }
    if (change.kind.endsWith('-removed')) {
        return `${change.entity} ${change.name}: removed`;
    }
    const sample = change.changes[0];
    if (!sample) {
        return `${change.entity} ${change.name}: changed`;
    }
    return `${change.entity} ${change.name}.${sample.field}: ${sample.kind.replace('-', ' ')}`;
};

const SEVERITY_RANK: Record<Severity, number> = {
    breaking: 0,
    additive: 1,
    'docs-only': 2
};

/**
 * Console output for a `DiffResult`. Side-effecting - writes via
 * `printLine`/`printSummary`. Returns nothing; caller decides exit code.
 */
export const renderConsole = (result: DiffResult, suppressNonBreaking: boolean): void => {
    const sorted = [...result.changes].sort(
        (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    );
    for (const change of sorted) {
        if (suppressNonBreaking && change.severity !== 'breaking') {
            continue;
        }
        printLine(`${tagFor(change.severity)} ${labelFor(change)}`);
        if (change.severity === 'breaking' && change.changes.length > 1) {
            for (const fc of change.changes.slice(1)) {
                printDetail(fc.field, fc.kind);
            }
        }
    }
    const { breaking, additive, docsOnly, unchanged } = result.summary;
    printSummaryLine(
        `Summary: ${breaking} breaking, ${additive} additive, ${docsOnly} docs-only, ${unchanged} unchanged.`
    );
};

/**
 * TTY-aware banner gate (F10 - same shape as the migrate CLI). Banner
 * suppressed for `--json`, `--md`, `--help`, and any non-TTY (CI / pipe).
 */
export const shouldShowDiffBanner = (argv: readonly string[]): boolean => {
    if (!process.stdout.isTTY) {
        return false;
    }
    if (argv.length === 0) {
        return false;
    }
    if (argv.includes('--json') || argv.includes('--md')) {
        return false;
    }
    if (argv.includes('--help') || argv.includes('-h') || argv[0] === 'help') {
        return false;
    }
    return true;
};
