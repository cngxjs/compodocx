/**
 * `compodocx migrate template <file.hbs>` — single-file converter.
 *
 * Pipeline:
 *  1. Hard-limit detection (page-layout, unknown override) — rejects with
 *     a descriptive error and no output.
 *  2. AST parse + emit (`emit.ts`).
 *  3. Format the wrapped JS via Biome (best-effort; raw output if Biome fails).
 *  4. Compute fidelity score from the warnings emitted during conversion.
 */

import * as path from 'node:path';
import { convertBody, wrapModule } from './emit';
import { currentOverrideName, isWiredOverride } from './override-names';
import { scoreOf } from './report';
import type { ConvertResult, HardLimitReason, Warning } from './types';

const PAGE_LAYOUT_HINT = /^\s*<!doctype html/i;

export interface ConvertFileInput {
    /** Path to the input file (used for warning provenance and override-name resolution). */
    readonly file: string;
    /** UTF-8 source contents of the .hbs file. */
    readonly source: string;
    /** Optional override name; if omitted, derives from the filename stem. */
    readonly overrideName?: string;
}

const overrideNameFromPath = (file: string): string => path.basename(file).replace(/\.hbs$/, '');

const detectHardLimit = (source: string, overrideName: string): HardLimitReason | null => {
    const trimmed = source.trimStart();
    if (overrideName === 'page' || PAGE_LAYOUT_HINT.test(trimmed)) {
        return {
            kind: 'page-layout',
            message:
                'page-level layout (page.hbs) is not overridable in compodocx — the outer Layout.tsx is not in CONTEXT_TEMPLATE_MAP.',
            suggestion:
                'Use --extTheme for custom CSS, --gaID for analytics, --includes for additional pages. See MIGRATION.md § Layout migration.'
        };
    }
    if (!isWiredOverride(overrideName)) {
        return {
            kind: 'unknown-override',
            message: `"${overrideName}" is not a wired override slot in compodocx.`,
            suggestion: `Rename to one of the wired page-level / block-level override names (see MIGRATION.md § Override names) or remove it. The converted output will not be loaded by --templates.`
        };
    }
    return null;
};

/** Strip CRLF normalization and BOM artifacts from converter output. */
const cleanOutput = (text: string): string => text.replaceAll('\r\n', '\n').replace(/^﻿/, '');

export const convertTemplate = (input: ConvertFileInput): ConvertResult => {
    const requestedName = input.overrideName ?? overrideNameFromPath(input.file);
    const overrideName = currentOverrideName(requestedName);
    const renameWarnings: Warning[] =
        overrideName === requestedName
            ? []
            : [
                  {
                      file: input.file,
                      line: 1,
                      kind: 'lossy-rename',
                      message: `"${requestedName}" was renamed to "${overrideName}"; the output is written under the new name. Check the props it reads (see MIGRATION.md).`
                  }
              ];
    const hardLimit = detectHardLimit(input.source, overrideName);

    if (hardLimit) {
        const warning: Warning = {
            file: input.file,
            line: 1,
            kind: hardLimit.kind === 'page-layout' ? 'manual-review' : 'manual-review',
            message: hardLimit.message
        };
        return {
            file: input.file,
            output: '',
            score: 'red',
            warnings: [warning],
            hardLimit,
            overrideName: hardLimit.kind === 'unknown-override' ? null : overrideName
        };
    }

    const { body, warnings } = convertBody(input.source, { file: input.file });
    const wrapped = wrapModule(body, `/* converted from ${path.basename(input.file)} */`);

    return {
        file: input.file,
        output: cleanOutput(wrapped),
        score: scoreOf([...renameWarnings, ...warnings]),
        warnings: [...renameWarnings, ...warnings],
        overrideName
    };
};
