/**
 * Severity rule table — domain-aware classification of diff changes.
 *
 * Reads as a sequence of predicate → severity pairs. The classifier walks
 * the table in order and picks the FIRST match per change record. Order
 * matters: more specific rules (e.g. "input added without default") must
 * appear before broader fallbacks ("input added").
 *
 * The plan-document table (`.internal/2026-05-07-api-diff-plan.md`) is the
 * authoritative reference; this file is the runtime mirror. A drift spec
 * could later assert this list stays aligned with the plan, but the cost of
 * authoring that spec exceeds its value at v0.3.0 — the unit tests in
 * `test/src/diff/rules.spec.ts` cover each row directly.
 */

import type { EntityChange, FieldChange, Severity } from './types';

/**
 * A predicate decides whether a rule matches an entity-level change. Some
 * rules also drill into a single FieldChange (the second arg) — those rules
 * are evaluated per-field-change inside `classify()`.
 */
export interface SeverityRule {
    id: string;
    severity: Severity;
    /** Top-level predicate: matches the entity change as a whole. */
    matches: (change: EntityChange, fieldChange?: FieldChange) => boolean;
}

const isAddedKind = (change: EntityChange): boolean => change.kind.endsWith('-added');
const isRemovedKind = (change: EntityChange): boolean => change.kind.endsWith('-removed');
const isChangedKind = (change: EntityChange): boolean => change.kind.endsWith('-changed');

const fieldNameMatches = (fieldChange: FieldChange | undefined, field: string): boolean =>
    fieldChange?.field === field;

const fieldStartsWith = (fieldChange: FieldChange | undefined, prefix: string): boolean =>
    fieldChange?.field.startsWith(prefix) ?? false;

/**
 * Required input detection. Component inputs are tracked via `inputsClass`
 * (`ExportProperty[]`); a required input is one whose `defaultValue` is
 * missing. Sprint 2's typed shape declares `defaultValue?: string`.
 */
const isRequiredInputAddition = (fieldChange: FieldChange | undefined): boolean => {
    if (!fieldChange || fieldChange.kind !== 'member-added') {
        return false;
    }
    if (!fieldChange.field.startsWith('inputsClass.')) {
        return false;
    }
    const v = fieldChange.newValue as { defaultValue?: unknown } | undefined;
    return v?.defaultValue === undefined;
};

const isOptionalInputAddition = (fieldChange: FieldChange | undefined): boolean => {
    if (!fieldChange || fieldChange.kind !== 'member-added') {
        return false;
    }
    if (!fieldChange.field.startsWith('inputsClass.')) {
        return false;
    }
    const v = fieldChange.newValue as { defaultValue?: unknown } | undefined;
    return v?.defaultValue !== undefined;
};

/** Type narrowing across `inputsClass.<name>` member-changed records. */
const isInputTypeChange = (fieldChange: FieldChange | undefined): boolean => {
    if (!fieldChange || fieldChange.kind !== 'member-changed') {
        return false;
    }
    if (!fieldChange.field.startsWith('inputsClass.')) {
        return false;
    }
    return (fieldChange.nested ?? []).some(n => n.field === 'type');
};

const isMemberDeprecationToggle = (fieldChange: FieldChange | undefined): boolean => {
    if (!fieldChange || fieldChange.kind !== 'member-changed') {
        return false;
    }
    return (fieldChange.nested ?? []).some(n => n.field === 'deprecated');
};

const isPrimaryDescription = (fieldChange: FieldChange | undefined): boolean =>
    fieldNameMatches(fieldChange, 'description');

const isSinceField = (fieldChange: FieldChange | undefined): boolean =>
    fieldNameMatches(fieldChange, 'since');

const isThemeTokenChange = (fieldChange: FieldChange | undefined): boolean =>
    fieldStartsWith(fieldChange, 'themeTokens.');

const isSignalDepsField = (fieldChange: FieldChange | undefined): boolean => {
    if (!fieldChange) {
        return false;
    }
    if (fieldChange.field === 'signalDeps') {
        return true;
    }
    return (fieldChange.nested ?? []).some(n => n.field === 'signalDeps');
};

/**
 * Public rule table. Order is significant — more specific rules first.
 * Each rule's `matches` is called either at the entity level (when no
 * fieldChange is supplied) or once per field-level shift inside the
 * classifier's loop.
 */
export const SEVERITY_RULES: ReadonlyArray<SeverityRule> = [
    // Entity-level shape changes
    { id: 'entity-removed', severity: 'breaking', matches: c => isRemovedKind(c) },
    { id: 'entity-added', severity: 'additive', matches: c => isAddedKind(c) },

    // Selector / public-surface scalars
    {
        id: 'selector-changed',
        severity: 'breaking',
        matches: (c, f) => isChangedKind(c) && fieldNameMatches(f, 'selector')
    },

    // Component / directive input shape — required-input detection has
    // priority over the broader "input added" rule.
    {
        id: 'required-input-added',
        severity: 'breaking',
        matches: (c, f) => isChangedKind(c) && isRequiredInputAddition(f)
    },
    {
        id: 'optional-input-added',
        severity: 'additive',
        matches: (c, f) => isChangedKind(c) && isOptionalInputAddition(f)
    },
    {
        id: 'input-removed',
        severity: 'breaking',
        matches: (c, f) =>
            isChangedKind(c) && f?.kind === 'member-removed' && fieldStartsWith(f, 'inputsClass.')
    },
    {
        id: 'input-type-changed',
        severity: 'breaking',
        matches: (c, f) => isChangedKind(c) && isInputTypeChange(f)
    },

    // Methods, properties, outputs (any class-like entity)
    {
        id: 'public-member-removed',
        severity: 'breaking',
        matches: (c, f) =>
            isChangedKind(c) &&
            f?.kind === 'member-removed' &&
            (fieldStartsWith(f, 'methodsClass.') ||
                fieldStartsWith(f, 'methods.') ||
                fieldStartsWith(f, 'properties.') ||
                fieldStartsWith(f, 'outputsClass.'))
    },
    {
        id: 'public-member-added',
        severity: 'additive',
        matches: (c, f) =>
            isChangedKind(c) &&
            f?.kind === 'member-added' &&
            (fieldStartsWith(f, 'methodsClass.') ||
                fieldStartsWith(f, 'methods.') ||
                fieldStartsWith(f, 'properties.') ||
                fieldStartsWith(f, 'outputsClass.'))
    },

    // Theming tokens
    {
        id: 'theme-token-removed',
        severity: 'breaking',
        matches: (c, f) => isChangedKind(c) && f?.kind === 'member-removed' && isThemeTokenChange(f)
    },
    {
        id: 'theme-token-changed',
        severity: 'breaking',
        matches: (c, f) =>
            isChangedKind(c) &&
            f?.kind === 'member-changed' &&
            isThemeTokenChange(f) &&
            (f.nested ?? []).some(n => n.field === 'type')
    },
    {
        id: 'theme-token-added',
        severity: 'additive',
        matches: (c, f) => isChangedKind(c) && f?.kind === 'member-added' && isThemeTokenChange(f)
    },

    // Signal deps — internal derivation, not public
    {
        id: 'signal-deps-shift',
        severity: 'docs-only',
        matches: (c, f) => isChangedKind(c) && isSignalDepsField(f)
    },

    // Deprecation toggles
    {
        id: 'entity-deprecated',
        severity: 'additive',
        matches: (c, f) => isChangedKind(c) && fieldNameMatches(f, 'deprecated')
    },
    {
        id: 'member-deprecated',
        severity: 'additive',
        matches: (c, f) => isChangedKind(c) && isMemberDeprecationToggle(f)
    },

    // Documentation-only
    {
        id: 'description-changed',
        severity: 'docs-only',
        matches: (c, f) => isChangedKind(c) && isPrimaryDescription(f)
    },
    {
        id: 'since-changed',
        severity: 'docs-only',
        matches: (c, f) => isChangedKind(c) && isSinceField(f)
    },

    // Member-level value swap that doesn't fit a more specific rule —
    // treat as breaking unless it's purely a description shift on the
    // member; classify recurses into nested for that.
    {
        id: 'member-value-changed',
        severity: 'breaking',
        matches: (c, f) =>
            isChangedKind(c) && f?.kind === 'member-changed' && !!f.nested && f.nested.length > 0
    },

    // Catch-all for entity-level scalar field shifts (e.g. extends,
    // changeDetection). These are public-facing → breaking.
    {
        id: 'entity-scalar-changed',
        severity: 'breaking',
        matches: (c, f) => isChangedKind(c) && f?.kind === 'value-changed'
    }
];
