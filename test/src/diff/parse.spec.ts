import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION } from '../../../src/app/interfaces/export-data.interface';
import { parseDiffInputs, parseExportFile, parseExportSource } from '../../../src/diff/parse';

/**
 * Schema-version gate is the first thing the diff CLI checks. Pre-v0.3.0
 * exports have no schemaVersion field; we exit 2 with a re-export hint.
 * The constants come from the typed ExportData contract — never duplicate
 * the literal here (drift spec from sprint 2 catches that).
 */

describe('diff/parse — schemaVersion gate', () => {
    let tmp: string;

    beforeAll(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diff-parse-'));
    });

    afterAll(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('accepts an export at the supported schemaVersion', () => {
        const file = path.join(tmp, 'good.json');
        fs.writeFileSync(
            file,
            JSON.stringify({
                schemaVersion: EXPORT_SCHEMA_VERSION,
                generatedAt: '2026-05-07T00:00:00.000Z',
                compodocxVersion: '0.3.0',
                components: []
            })
        );
        const result = parseExportFile(file);
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.value.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
        }
    });

    it('rejects a file with no schemaVersion (pre-v0.3.0 unversioned export)', () => {
        const file = path.join(tmp, 'legacy.json');
        fs.writeFileSync(file, JSON.stringify({ components: [] }));
        const result = parseExportFile(file);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/no schemaVersion/);
            expect(result.message).toContain(
                `re-export it with this compodocx version (schema ${EXPORT_SCHEMA_VERSION})`
            );
        }
    });

    it('rejects a newer-than-supported schemaVersion with an upgrade hint', () => {
        const file = path.join(tmp, 'newer-version.json');
        fs.writeFileSync(
            file,
            JSON.stringify({ schemaVersion: 99, generatedAt: '', compodocxVersion: '99.0.0' })
        );
        const result = parseExportFile(file);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/produced by a newer compodocx/);
            expect(result.message).toMatch(/upgrade compodocx to read it/);
        }
    });

    it('rejects an older schemaVersion with a re-export hint', () => {
        const file = path.join(tmp, 'older-version.json');
        fs.writeFileSync(
            file,
            JSON.stringify({ schemaVersion: EXPORT_SCHEMA_VERSION - 1, generatedAt: '' })
        );
        const result = parseExportFile(file);
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toContain(
                `schemaVersion ${EXPORT_SCHEMA_VERSION - 1} does not match supported ${EXPORT_SCHEMA_VERSION} - re-export it with this compodocx version`
            );
        }
    });

    it('rejects malformed JSON with a clear message', () => {
        const result = parseExportSource('{not-json', '<inline>');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/not valid JSON/);
        }
    });

    it('rejects a JSON array (must be an object)', () => {
        const result = parseExportSource('[]', '<inline>');
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/not a JSON object/);
        }
    });

    it('rejects a missing file path', () => {
        const result = parseExportFile(path.join(tmp, 'does-not-exist.json'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/file not found/);
        }
    });

    it('parseDiffInputs surfaces the first-failed file', () => {
        const ok = path.join(tmp, 'ok.json');
        fs.writeFileSync(
            ok,
            JSON.stringify({
                schemaVersion: EXPORT_SCHEMA_VERSION,
                generatedAt: '',
                compodocxVersion: ''
            })
        );
        const result = parseDiffInputs(ok, path.join(tmp, 'missing.json'));
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.message).toMatch(/file not found/);
        }
    });
});
