/**
 * Public types for the `compodocx diff` CLI.
 *
 * The diff pipeline is deliberately data-shaped — every stage takes
 * immutable inputs and returns a new record. Output formatters consume
 * `DiffResult` directly; they don't mutate it.
 */

import type { ExportData, VolatileExportField } from '../app/interfaces/export-data.interface';

/**
 * Envelope captured for each side of a diff — uses the volatile-field type
 * derived from `VOLATILE_EXPORT_FIELDS` so adding a field to the constant
 * automatically widens this shape (F16). Never hand-write the field list.
 */
export type DiffSnapshotMeta = Pick<ExportData, VolatileExportField>;

export type Severity = 'breaking' | 'additive' | 'docs-only';

/**
 * Coarse kind identifier on every change record. The first segment is the
 * entity kind (component, pipe, …); the second is what happened
 * (added, removed, changed, member-added, …). Output formatters can render
 * a human label without re-classifying.
 */
export type ChangeKind =
    | 'component-added'
    | 'component-removed'
    | 'component-changed'
    | 'directive-added'
    | 'directive-removed'
    | 'directive-changed'
    | 'pipe-added'
    | 'pipe-removed'
    | 'pipe-changed'
    | 'injectable-added'
    | 'injectable-removed'
    | 'injectable-changed'
    | 'guard-added'
    | 'guard-removed'
    | 'guard-changed'
    | 'interceptor-added'
    | 'interceptor-removed'
    | 'interceptor-changed'
    | 'class-added'
    | 'class-removed'
    | 'class-changed'
    | 'interface-added'
    | 'interface-removed'
    | 'interface-changed';

/** Coarse entity kind — drives both diff dispatch and output formatting. */
export type EntityKind =
    | 'component'
    | 'directive'
    | 'pipe'
    | 'injectable'
    | 'guard'
    | 'interceptor'
    | 'class'
    | 'interface';

/**
 * A single field-level change inside an entity. The compare engine emits
 * these; the classifier reads `field` + `kind` to pick a severity.
 */
export interface FieldChange {
    /** Stable field path inside the entity (e.g. "selector", "inputsClass.id.type"). */
    field: string;
    /** What happened to the field: added, removed, value swap, or member shift. */
    kind:
        | 'added'
        | 'removed'
        | 'value-changed'
        | 'member-added'
        | 'member-removed'
        | 'member-changed';
    /** Old value, JSON-stringifiable. Undefined for `added`. */
    oldValue?: unknown;
    /** New value, JSON-stringifiable. Undefined for `removed`. */
    newValue?: unknown;
    /** Optional sub-detail for member changes (e.g. nested field changes inside a property). */
    nested?: FieldChange[];
}

export interface EntityChange {
    kind: ChangeKind;
    entity: EntityKind;
    name: string;
    file?: string;
    /** Empty for added/removed; populated for changed. */
    changes: FieldChange[];
    severity: Severity;
}

export interface DiffSummary {
    breaking: number;
    additive: number;
    docsOnly: number;
    unchanged: number;
}

/**
 * Full diff payload produced by `compare()` and consumed by every formatter.
 * Header fields mirror `ExportData` for traceability — the volatile fields
 * (`generatedAt`, `compodocxVersion`) ARE captured here on purpose so the
 * machine-readable output can attribute the diff, but the byte-equal
 * comparator strips them via VOLATILE_EXPORT_FIELDS before computing
 * `unchanged`.
 */
export interface DiffResult {
    schemaVersion: number;
    comparedAt: string;
    from: DiffSnapshotMeta;
    to: DiffSnapshotMeta;
    summary: DiffSummary;
    changes: EntityChange[];
}

export type ParsedExport = {
    /** Always-defined post-parse — the gate fills in 0 for legacy exports. */
    schemaVersion: number;
    data: ExportData;
};
