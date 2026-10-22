/**
 * Public types for the llm-md emitter.
 *
 * The emitter is purpose-built for AI context windows: pure-functional, every
 * stage takes immutable inputs and returns a new string. Header fields
 * captured here mirror the volatile-export convention so a single change to
 * `VOLATILE_EXPORT_FIELDS` widens both the JSON snapshot header and the
 * llm-md preamble line at once.
 */

import type { ExportData, VolatileExportField } from '../app/interfaces/export-data.interface';

/**
 * Subset of `ExportData` reused for the llm-md preamble line. Derived from the
 * runtime constant via `(typeof VOLATILE_EXPORT_FIELDS)[number]` so adding a
 * new volatile field automatically widens this shape - never hand-spell the
 * field literal here.
 */
export type LlmMdSnapshotMeta = Pick<ExportData, VolatileExportField>;

/** Internal options threaded through every per-entity emit function. */
export interface LlmMdEmitOptions {
    /** Documentation title. Falls back to a neutral value when absent. */
    readonly projectName: string;
    /** Optional one-line description from package.json. */
    readonly projectDescription?: string;
    /** Heading of the additional pages section (`includesName`); "Additional documentation" when absent. */
    readonly additionalPagesName?: string;
}

/**
 * Top-level shape consumed by `emitLlmMd()`. Built once by the dispatcher
 * before any per-entity walk runs.
 */
export interface LlmMdInput {
    readonly meta: LlmMdSnapshotMeta;
    readonly options: LlmMdEmitOptions;
    readonly data: ExportData;
}
