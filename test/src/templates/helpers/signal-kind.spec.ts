import { describe, expect, it } from 'vitest';
import { isEffectKind } from '../../../../src/templates/helpers/signal-kind';

describe('isEffectKind', () => {
    it('counts every effect factory as an effect', () => {
        for (const kind of [
            'effect',
            'after-render-effect',
            'after-every-render',
            'after-next-render'
        ]) {
            expect(isEffectKind(kind)).toBe(true);
        }
    });

    it('does not count signals or plain members', () => {
        expect(isEffectKind('signal')).toBe(false);
        expect(isEffectKind(undefined)).toBe(false);
    });
});
