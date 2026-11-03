import { describe, expect, it } from 'vitest';

import { detectAiGeneratedMarker } from '../../../src/utils/ai-generated.util';

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
});
