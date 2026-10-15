import { describe, expect, it } from 'vitest';

import {
    type AxisConfig,
    type AxisSymbol,
    classifyAxes,
    formatAxesSummary,
    parseAxesConfig
} from '../../../../../src/app/compiler/semantic';

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

const symbol = (name: string, file: string, kind = 'component', tags?: AxisSymbol['tags']) => ({
    key: `${file}#${name}`,
    file,
    name,
    kind,
    ...(tags ? { tags } : {})
});

const stability: AxisConfig = {
    label: 'Stability',
    values: ['stable', 'experimental'],
    paths: { 'src/labs/**': 'experimental' },
    default: 'stable'
};
const level: AxisConfig = {
    label: 'level',
    values: ['atom', 'molecule'],
    paths: {},
    kinds: ['directive']
};

describe('classifyAxes', () => {
    it('takes the tag, else the first path rule, else the default', () => {
        const result = classifyAxes(
            [
                symbol('Tagged', 'src/labs/a.ts', 'component', [
                    { name: 'stability', value: 'stable' }
                ]),
                symbol('Lab', 'src/labs/b.ts'),
                symbol('Plain', 'src/c.ts')
            ],
            { stability }
        );
        expect(result.warnings).toEqual([]);
        const values = result.model?.valuesOf;
        expect(values?.get('src/labs/a.ts#Tagged')?.get('stability')).toBe('stable');
        expect(values?.get('src/labs/b.ts#Lab')?.get('stability')).toBe('experimental');
        expect(values?.get('src/c.ts#Plain')?.get('stability')).toBe('stable');
        expect(result.model?.axes).toEqual([
            {
                name: 'stability',
                label: 'Stability',
                values: [
                    { value: 'stable', count: 2 },
                    { value: 'experimental', count: 1 }
                ],
                classified: 3,
                unclassified: 0
            }
        ]);
    });

    it('counts only the kinds an axis applies to, unclassified without a value', () => {
        const result = classifyAxes(
            [
                symbol('Atom', 'a.ts', 'directive', [{ name: 'level', value: 'atom' }]),
                symbol('Bare', 'b.ts', 'directive'),
                symbol('Fn', 'c.ts', 'function')
            ],
            { level }
        );
        expect(result.model?.axes[0]).toMatchObject({ classified: 1, unclassified: 1 });
        expect(result.model?.valuesOf.has('c.ts#Fn')).toBe(false);
        expect(result.model?.valuesOf.has('b.ts#Bare')).toBe(false);
        expect(formatAxesSummary(result.model!)).toBe(
            'Axes: level 1/2 classified (1 unclassified)'
        );
    });

    it('reports bad tags once per problem with their locations', () => {
        const bad = (name: string, tags: AxisSymbol['tags']) =>
            symbol(name, 'x.ts', 'function', tags);
        const result = classifyAxes(
            [
                bad('A', [{ name: 'tier', value: 'core' }]),
                bad('B', [{ name: 'tier', value: 'core' }]),
                bad('C', [{ name: 'stability', value: 'beta' }]),
                bad('D', [{ name: 'stability' }]),
                bad('E', [{ name: '' }]),
                bad('F', [{ name: 'level', value: 'atom' }]),
                bad('G', [
                    { name: 'stability', value: 'experimental' },
                    { name: 'stability', value: 'stable' }
                ])
            ],
            { stability, level }
        );
        expect(result.warnings).toEqual([
            'Axes: @axis "tier" is not a declared axis (2: x.ts#A, x.ts#B)',
            'Axes: @axis stability "beta" is not a declared value (1: x.ts#C)',
            'Axes: @axis stability has no value (1: x.ts#D)',
            'Axes: @axis without an axis name (1: x.ts#E)',
            'Axes: @axis level does not apply to kind function (1: x.ts#F)',
            'Axes: @axis stability given more than once, first one kept (1: x.ts#G)'
        ]);
        expect(result.model?.valuesOf.get('x.ts#G')?.get('stability')).toBe('experimental');
        expect(result.model?.valuesOf.get('x.ts#C')?.get('stability')).toBe('stable');
    });

    it('lists at most three locations per problem', () => {
        const many = ['A', 'B', 'C', 'D', 'E'].map(name =>
            symbol(name, 'y.ts', 'component', [{ name: 'tier', value: 'x' }])
        );
        expect(classifyAxes(many, { stability }).warnings).toEqual([
            'Axes: @axis "tier" is not a declared axis (5: y.ts#A, y.ts#B, y.ts#C, ... 2 more)'
        ]);
    });

    it('has no model without declared axes and notes tags found anyway', () => {
        expect(classifyAxes([symbol('A', 'a.ts')], {})).toEqual({ warnings: [] });
        expect(
            classifyAxes([symbol('A', 'a.ts', 'component', [{ name: 'level', value: 'atom' }])], {})
        ).toEqual({
            warnings: ['Axes: 1 @axis tags found, no classificationAxes declared; ignored']
        });
    });
});
