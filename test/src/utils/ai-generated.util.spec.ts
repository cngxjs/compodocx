import { describe, expect, it } from 'vitest';

import {
    detectAiGeneratedMarker,
    isAiGeneratedTagName
} from '../../../src/utils/ai-generated.util';

describe('detectAiGeneratedMarker', () => {
    it('returns true for the bare marker', () => {
        expect(detectAiGeneratedMarker('<!-- @aiGenerated -->\n# Title')).toBe(true);
    });

    it('returns the trimmed value', () => {
        expect(detectAiGeneratedMarker('<!--   @aiGenerated 2026-05   -->')).toBe('2026-05');
    });

    it('keeps spaces inside the value', () => {
        expect(detectAiGeneratedMarker('<!-- @aiGenerated model x, reviewed -->')).toBe(
            'model x, reviewed'
        );
    });

    it('allows leading whitespace before the marker', () => {
        expect(detectAiGeneratedMarker('\n\n  <!-- @aiGenerated -->')).toBe(true);
    });

    it('returns false without a marker', () => {
        expect(detectAiGeneratedMarker('# Title\n\nText')).toBe(false);
        expect(detectAiGeneratedMarker('')).toBe(false);
        expect(detectAiGeneratedMarker(undefined)).toBe(false);
    });

    it('ignores a marker after other content', () => {
        expect(detectAiGeneratedMarker('# Title\n<!-- @aiGenerated -->')).toBe(false);
    });

    it('accepts the synonyms @ai and @aigen in any case', () => {
        expect(detectAiGeneratedMarker('<!-- @ai 2026-05 -->')).toBe('2026-05');
        expect(detectAiGeneratedMarker('<!-- @AIGEN -->')).toBe(true);
        expect(detectAiGeneratedMarker('<!-- @aigen model=x date=y -->')).toBe('model=x date=y');
    });

    it('does not read a longer tag name as a synonym', () => {
        expect(detectAiGeneratedMarker('<!-- @ai-generated -->')).toBe(false);
        expect(detectAiGeneratedMarker('<!-- @aiNotes x -->')).toBe(false);
    });
});

describe('isAiGeneratedTagName', () => {
    it('matches aiGenerated, aigen and ai in any case', () => {
        for (const name of ['aiGenerated', 'aigenerated', 'aigen', 'AI', 'ai']) {
            expect(isAiGeneratedTagName(name)).toBe(true);
        }
    });

    it('rejects other names', () => {
        for (const name of [undefined, '', 'aiNotes', 'generated', 'a']) {
            expect(isAiGeneratedTagName(name)).toBe(false);
        }
    });
});
