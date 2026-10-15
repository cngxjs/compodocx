/**
 * Fidelity scoring + warning aggregation.
 *
 * Per-file score:
 * - `green`  - every node mapped via `rename` or `inline`, zero warnings.
 * - `yellow` - every node mapped, but at least one lossy/aggressive warning.
 * - `red`    - at least one unknown helper, unsupported block, or partial
 *              with no target. Output emitted with TODO comments; user MUST
 *              review before using.
 *
 * Exit codes per subcommand: 0 if all green, 1 if any yellow, 2 if any red.
 */

import type { ConvertResult, FidelityScore, RunSummary, Warning, WarningKind } from './types';

const RED_KINDS: ReadonlySet<WarningKind> = new Set([
    'unknown-helper',
    'unsupported-block',
    'partial-no-target',
    'manual-review'
]);

const YELLOW_KINDS: ReadonlySet<WarningKind> = new Set([
    'removed-construct',
    'lossy-rename',
    'aggressive-rewrite',
    'css-audit-only'
]);

export const scoreOf = (warnings: readonly Warning[]): FidelityScore => {
    if (warnings.some(w => RED_KINDS.has(w.kind))) {
        return 'red';
    }
    if (warnings.some(w => YELLOW_KINDS.has(w.kind))) {
        return 'yellow';
    }
    return 'green';
};

export const exitCodeOf = (score: FidelityScore): 0 | 1 | 2 => {
    switch (score) {
        case 'green':
            return 0;
        case 'yellow':
            return 1;
        case 'red':
            return 2;
    }
};

const worstScore = (a: FidelityScore, b: FidelityScore): FidelityScore => {
    if (a === 'red' || b === 'red') {
        return 'red';
    }
    if (a === 'yellow' || b === 'yellow') {
        return 'yellow';
    }
    return 'green';
};

export const summarize = (files: readonly ConvertResult[]): RunSummary => {
    const counts = files.reduce((acc, f) => ({ ...acc, [f.score]: acc[f.score] + 1 }), {
        green: 0,
        yellow: 0,
        red: 0
    } as Record<FidelityScore, number>);
    const score = files.reduce<FidelityScore>((acc, f) => worstScore(acc, f.score), 'green');
    return {
        files: [...files],
        summary: counts,
        score
    };
};
