import { describe, expect, it } from 'vitest';

import { parseAxesConfig } from '../../../../../src/app/compiler/semantic';

const anyKind = (kind: string) => ['component', 'directive', 'function'].includes(kind);

describe('parseAxesConfig', () => {
    it('keeps a valid axis, label defaulting to the name', () => {
        const result = parseAxesConfig(
            { level: { values: ['atom', 'molecule', 'atom'], kinds: ['directive'] } },
            anyKind
        );
        expect(result.warnings).toEqual([]);
        expect(result.axes).toEqual({
            level: { label: 'level', values: ['atom', 'molecule'], paths: {}, kinds: ['directive'] }
        });
    });

    it('rejects a non-object config', () => {
        for (const raw of [null, [], 'x']) {
            const result = parseAxesConfig(raw, anyKind);
            expect(result.axes).toEqual({});
            expect(result.warnings).toHaveLength(1);
        }
    });

    it('drops an axis with a bad name, no object or no valid values', () => {
        const result = parseAxesConfig(
            {
                Stability: { values: ['a'] },
                plain: 'x',
                empty: { values: [] },
                missing: {},
                spaced: { values: ['two words'] }
            },
            anyKind
        );
        expect(result.axes).toEqual({});
        expect(result.warnings).toEqual([
            'classificationAxes: ignoring "Stability" (expected one segment [a-z0-9][a-z0-9-]*)',
            'classificationAxes: "plain" expected an object; axis ignored',
            'classificationAxes: "empty" has no valid values; axis ignored',
            'classificationAxes: "missing" needs a list of values; axis ignored',
            'classificationAxes: "spaced" ignores value "two words" (expected one word)',
            'classificationAxes: "spaced" has no valid values; axis ignored'
        ]);
    });

    it('drops undeclared path values and defaults, unknown kinds and an empty label', () => {
        const result = parseAxesConfig(
            {
                tier: {
                    label: ' ',
                    values: ['core', 'extra'],
                    paths: { 'a/**': 'extra', 'b/**': 'other' },
                    default: 'none',
                    kinds: ['pipe']
                }
            },
            anyKind
        );
        expect(result.axes).toEqual({
            tier: { label: 'tier', values: ['core', 'extra'], paths: { 'a/**': 'extra' } }
        });
        expect(result.warnings).toEqual([
            'classificationAxes: "tier.label" expected a non-empty string; ignored',
            'classificationAxes: "tier.paths" ignores "b/**": "other" is not a declared value',
            'classificationAxes: "tier.default" "none" is not a declared value; ignored',
            'classificationAxes: "tier.kinds" ignores "pipe" (not a symbol kind)'
        ]);
    });
});
