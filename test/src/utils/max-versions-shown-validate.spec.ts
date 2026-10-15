import { describe, expect, it } from 'vitest';
import { parseMaxVersionsShown } from '../../../src/utils/max-versions-shown.util';

describe('parseMaxVersionsShown — boundary behavior', () => {
    it('accepts 0 (unlimited)', () => {
        expect(parseMaxVersionsShown(0)).toEqual({ ok: true, value: 0 });
        expect(parseMaxVersionsShown('0')).toEqual({ ok: true, value: 0 });
    });

    it('accepts 10 (default)', () => {
        expect(parseMaxVersionsShown(10)).toEqual({ ok: true, value: 10 });
    });

    it('accepts 1000 (upper boundary)', () => {
        expect(parseMaxVersionsShown(1000)).toEqual({ ok: true, value: 1000 });
    });

    it('rejects 1001 (just above upper boundary)', () => {
        const result = parseMaxVersionsShown(1001);
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/--maxVersionsShown.*0 and 1000/);
            expect(result.message).toMatch(/got 1001/);
        }
    });

    it('rejects -1 (below lower boundary)', () => {
        const result = parseMaxVersionsShown(-1);
        expect(result.ok).toBe(false);
    });

    it('rejects "ten" (non-numeric string)', () => {
        const result = parseMaxVersionsShown('ten');
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/got "ten"/);
        }
    });

    it('rejects 2.5 (non-integer)', () => {
        const result = parseMaxVersionsShown(2.5);
        expect(result.ok).toBe(false);
    });

    it('uses "config" label when source is config', () => {
        const result = parseMaxVersionsShown(99999, 'config');
        expect(result.ok).toBe(false);
        if (result.ok === false) {
            expect(result.message).toMatch(/maxVersionsShown in config file/);
        }
    });
});
