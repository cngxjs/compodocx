import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION } from '../../../src/app/interfaces/export-data.interface';

/**
 * Schema-version drift detection.
 *
 * `EXPORT_SCHEMA_VERSION` is the single source of truth for the
 * `documentation.json` schema version. Every code path that writes
 * `schemaVersion: <number>` must import the constant — never inline a numeric
 * literal, otherwise downstream consumers can silently observe two different
 * versions in the wild.
 *
 * This spec re-derives the constant from disk and walks `src/` looking for
 * any other place that writes the schema version with a literal. If you bump
 * the constant, this spec also reminds you to record the change in
 * `MIGRATION.md` (otherwise `compodocx diff` and `--export llm-md` consumers
 * will not know the contract changed).
 */

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SRC_DIR = path.join(REPO_ROOT, 'src');
const INTERFACE_FILE = path.join(SRC_DIR, 'app/interfaces/export-data.interface.ts');

const readSchemaVersionFromSource = (): number => {
    const source = fs.readFileSync(INTERFACE_FILE, 'utf8');
    const match = source.match(/export\s+const\s+EXPORT_SCHEMA_VERSION\s*=\s*(\d+)\s*as\s+const/);
    if (!match) {
        throw new Error(
            `Could not parse EXPORT_SCHEMA_VERSION literal from ${INTERFACE_FILE}. ` +
                'If you renamed or restructured the constant, update this spec to match.'
        );
    }
    return Number(match[1]);
};

/**
 * Walk every `.ts`/`.tsx` file under `src/` (skipping the interface file
 * itself, which legitimately holds the literal) and collect every line that
 * looks like a schemaVersion write — `schemaVersion: 1`, `schemaVersion: 2`,
 * etc. The interface declaration `schemaVersion: ExportSchemaVersion` and the
 * engine line `schemaVersion: EXPORT_SCHEMA_VERSION` are both expected NOT to
 * match this regex (they reference the type/constant, not a literal).
 */
const findLiteralSchemaVersionWrites = (): Array<{ file: string; line: number; text: string }> => {
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' || entry.name === 'resources') {
                    continue;
                }
                walk(full);
                continue;
            }
            if (!/\.(ts|tsx)$/.test(entry.name)) {
                continue;
            }
            if (full === INTERFACE_FILE) {
                continue;
            }
            const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
            lines.forEach((text, idx) => {
                if (/schemaVersion\s*:\s*\d/.test(text)) {
                    offenders.push({ file: full, line: idx + 1, text: text.trim() });
                }
            });
        }
    };
    walk(SRC_DIR);
    return offenders;
};

describe('export-json schema-version drift detection', () => {
    it('EXPORT_SCHEMA_VERSION constant matches the imported value', () => {
        const literal = readSchemaVersionFromSource();
        expect(literal).toBe(EXPORT_SCHEMA_VERSION);
    });

    it('no other file in src/ writes a numeric schemaVersion literal', () => {
        const offenders = findLiteralSchemaVersionWrites();
        // Build a friendly diagnostic in case the spec fails — the violator
        // either needs to import EXPORT_SCHEMA_VERSION or move the literal
        // into the interface file alongside the constant.
        const message = offenders
            .map(o => {
                const rel = path.relative(REPO_ROOT, o.file).split(path.sep).join('/');
                return `${rel}:${o.line}  ${o.text}`;
            })
            .join('\n');
        expect(offenders, message).toEqual([]);
    });
});
