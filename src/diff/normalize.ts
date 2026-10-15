/**
 * Strip volatile header fields before any byte-equal comparison.
 *
 * `VOLATILE_EXPORT_FIELDS` (sprint 2, F16) is the single source of truth for
 * which `ExportData` fields change on every run regardless of source code.
 * The diff comparator MUST iterate the constant - never duplicate the list.
 * Future fields added to the export header (e.g. random snapshot IDs) become
 * volatile by being added to `VOLATILE_EXPORT_FIELDS`; the comparator
 * automatically picks them up.
 */

import {
    type ExportData,
    VOLATILE_EXPORT_FIELDS,
    type VolatileExportField
} from '../app/interfaces/export-data.interface';

/**
 * Result of stripping volatile fields. The omitted field set is derived from
 * the runtime constant - if a future field is added to
 * `VOLATILE_EXPORT_FIELDS`, this type follows automatically (F16). Never
 * hand-write the field literal here.
 */
export type StrippedExportData = Omit<ExportData, VolatileExportField>;

/**
 * Return a shallow copy of `data` with every `VOLATILE_EXPORT_FIELDS` entry
 * removed. Original input is untouched (immutable contract).
 */
export const stripVolatileFields = (data: ExportData): StrippedExportData => {
    const copy: Record<string, unknown> = { ...(data as unknown as Record<string, unknown>) };
    for (const field of VOLATILE_EXPORT_FIELDS) {
        delete copy[field];
    }
    return copy as StrippedExportData;
};
