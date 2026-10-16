import { describe, expect, it } from 'vitest';

import type { AxisModel, SemanticModel } from '../../../../src/app/compiler/semantic';
import type { SymbolEntry } from '../../../../src/app/links/symbol-table';
import { AxisBadges } from '../../../../src/templates/components/AxisBadges';
import { axisValuesOf } from '../../../../src/templates/helpers/axes';

const entry = (name: string) =>
    ({ ref: { kind: 'component', file: 'src/a.ts', name } }) as unknown as SymbolEntry;

const axes: AxisModel = {
    axes: [
        { name: 'stability', label: 'Stability', values: [], classified: 1, unclassified: 0 },
        { name: 'level', label: 'Level', values: [], classified: 1, unclassified: 1 }
    ],
    valuesOf: new Map([
        [
            'src/a.ts#Card',
            new Map([
                ['level', 'atom'],
                ['stability', 'stable']
            ])
        ]
    ])
};
const semantic = { axes } as unknown as SemanticModel;

describe('axisValuesOf', () => {
    it('lists the values of an entry in axis declaration order', () => {
        expect(axisValuesOf(semantic, entry('Card'))).toEqual([
            { name: 'stability', label: 'Stability', value: 'stable' },
            { name: 'level', label: 'Level', value: 'atom' }
        ]);
    });

    it('is empty without axes, entry or values', () => {
        expect(axisValuesOf(undefined, entry('Card'))).toEqual([]);
        expect(axisValuesOf(semantic, undefined)).toEqual([]);
        expect(axisValuesOf(semantic, entry('Other'))).toEqual([]);
    });
});

describe('AxisBadges', () => {
    it('renders one escaped chip per axis', () => {
        const html = AxisBadges({
            axes: [{ name: 'level', label: 'Level <x>', value: 'atom' }]
        });
        expect(html).toContain('class="cdx-badge cdx-badge--axis"');
        expect(html).toContain('data-cdx-axis="level"');
        expect(html).toContain('>Level &lt;x&gt;: atom</span>');
    });

    it('renders nothing without axes', () => {
        expect(AxisBadges({ axes: [] })).toBe('');
    });
});
