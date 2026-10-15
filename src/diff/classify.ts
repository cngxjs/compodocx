/**
 * Apply the severity rule table to compare-engine output.
 *
 * Pure-functional: takes a list of EntityChange records emitted by
 * `compare()` and returns a new list with `severity` populated. The
 * highest-severity field-level rule wins for each entity:
 *
 *   breaking > additive > docs-only
 *
 * For added/removed entities the predicate runs at the entity level (no
 * field changes); for changed entities the classifier evaluates each
 * FieldChange against the rule table and picks the worst severity across
 * all matched rules.
 */

import { SEVERITY_RULES } from './rules';
import type { EntityChange, FieldChange, Severity } from './types';

const SEVERITY_RANK: Record<Severity, number> = {
    'docs-only': 0,
    additive: 1,
    breaking: 2
};

const worse = (a: Severity, b: Severity): Severity =>
    SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

const ruleSeverity = (
    change: EntityChange,
    fieldChange: FieldChange | undefined
): Severity | undefined => {
    for (const rule of SEVERITY_RULES) {
        if (rule.matches(change, fieldChange)) {
            return rule.severity;
        }
    }
    return undefined;
};

export const classifyChange = (change: EntityChange): EntityChange => {
    // Entity-level shape changes (added/removed) match without a fieldChange.
    if (!change.kind.endsWith('-changed')) {
        const sev = ruleSeverity(change, undefined) ?? 'docs-only';
        return { ...change, severity: sev };
    }
    // For changed entities, fold over field-level shifts.
    let severity: Severity = 'docs-only';
    for (const field of change.changes) {
        const matched = ruleSeverity(change, field);
        if (matched) {
            severity = worse(severity, matched);
        }
    }
    return { ...change, severity };
};

export const classifyAll = (changes: ReadonlyArray<EntityChange>): EntityChange[] =>
    changes.map(classifyChange);

export const summarize = (
    changes: ReadonlyArray<EntityChange>,
    unchanged: number
): { breaking: number; additive: number; docsOnly: number; unchanged: number } => {
    let breaking = 0;
    let additive = 0;
    let docsOnly = 0;
    for (const change of changes) {
        if (change.severity === 'breaking') {
            breaking++;
        } else if (change.severity === 'additive') {
            additive++;
        } else {
            docsOnly++;
        }
    }
    return { breaking, additive, docsOnly, unchanged };
};

/**
 * Exit-code mapping for the CLI dispatcher.
 *
 *   0 - no breaking, no additive (pure docs-only or unchanged)
 *   1 - at least one additive but no breaking (warning territory)
 *   2 - at least one breaking (CI fail-fast)
 */
export const exitCodeFromSummary = (summary: { breaking: number; additive: number }): 0 | 1 | 2 => {
    if (summary.breaking > 0) {
        return 2;
    }
    if (summary.additive > 0) {
        return 1;
    }
    return 0;
};
