import { describe, expect, it } from 'vitest';
import { parseJsonIndent } from '../../../src/utils/json-indent.util';

/**
 * `parseJsonIndent` lives behind the `--jsonIndent` CLI flag and the
 * `jsonIndent` config-file field. It returns a discriminated result so
 * callers (CLI, programmatic consumers, tests) decide how to surface
 * failures — the CLI exits the process; tests assert on the message
 * directly without spying on `process.exit`.
 *
 * F11 (CLI behavior-contract test pattern from sprint 1) calls for routing
 * through the dispatcher; here that is `parseJsonIndent` itself because the
 * function IS the validation step. The CLI behavior — what happens after a
 * failure — is covered by `test/src/utils/export-json-typed.spec.ts` which
 * spawns the CLI and asserts a non-zero exit on `--jsonIndent 9`.
 */
describe('parseJsonIndent — boundary behavior', () => {
    it('accepts 0 (default, single-line)', () => {
        expect(parseJsonIndent(0)).toEqual({ ok: true, value: 0 });
        expect(parseJsonIndent('0')).toEqual({ ok: true, value: 0 });
    });

    it('accepts 2 (human-readable)', () => {
        expect(parseJsonIndent(2)).toEqual({ ok: true, value: 2 });
        expect(parseJsonIndent('2')).toEqual({ ok: true, value: 2 });
    });

    it('accepts 8 (upper boundary)', () => {
        expect(parseJsonIndent(8)).toEqual({ ok: true, value: 8 });
        expect(parseJsonIndent('8')).toEqual({ ok: true, value: 8 });
    });

    it('rejects 9 (just above upper boundary)', () => {
        const result = parseJsonIndent(9);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/--jsonIndent.*0 and 8/);
            expect(result.message).toMatch(/got 9/);
        }
    });

    it('rejects -1 (below lower boundary)', () => {
        const result = parseJsonIndent(-1);
        expect(result.ok).toBe(false);
    });

    it('rejects "tab" (non-numeric string)', () => {
        const result = parseJsonIndent('tab');
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/got "tab"/);
        }
    });

    it('rejects 2.5 (non-integer)', () => {
        const result = parseJsonIndent(2.5);
        expect(result.ok).toBe(false);
    });

    it('rejects empty string', () => {
        const result = parseJsonIndent('');
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/requires a value/);
        }
    });

    it('rejects undefined', () => {
        const result = parseJsonIndent(undefined);
        expect(result.ok).toBe(false);
    });

    it('error message uses "config" label when source is config', () => {
        const result = parseJsonIndent(99, 'config');
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/jsonIndent in config file/);
        }
    });
});
