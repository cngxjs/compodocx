/**
 * Machine-readable JSON formatter for `compodocx diff --json`.
 *
 * The JSON envelope matches the plan-document specimen:
 *   { schemaVersion, comparedAt, from, to, summary, changes[] }
 *
 * Output is `JSON.stringify` with 2-space indent - matches `--jsonIndent 2`
 * default style used by the migrate CLI's `--json` mode.
 */

import type { DiffResult } from '../types';

export const renderJson = (result: DiffResult): string => JSON.stringify(result, null, 2);
