import { describe, expect, it } from 'vitest';

import { type GraphModel, relationsByFeature } from '../../../../src/app/graph';

const MODEL: GraphModel = {
    nodes: [
        { id: 'card', name: 'CardComponent', kind: 'component', feature: 'ui' },
        { id: 'badge', name: 'BadgeComponent', kind: 'component', feature: 'ui' },
        { id: 'ripple', name: 'RippleDirective', kind: 'directive', feature: 'ui' },
        { id: 'theme', name: 'ThemeService', kind: 'service', feature: 'core' },
        { id: 'THEME', name: 'THEME', kind: 'token', feature: 'core' },
        { id: 'provide', name: 'provideTheme', kind: 'provider', feature: 'core' },
        { id: 'loose', name: 'LoosePipe', kind: 'pipe' },
        { id: 'external:NgClass', name: 'NgClass', kind: 'external' }
    ],
    edges: [
        { source: 'card', target: 'external:NgClass', kind: 'imports' },
        { source: 'card', target: 'badge', kind: 'imports' },
        { source: 'card', target: 'ripple', kind: 'composes' },
        { source: 'card', target: 'theme', kind: 'injects' },
        { source: 'theme', target: 'THEME', kind: 'injects' },
        { source: 'provide', target: 'THEME', kind: 'provides' },
        { source: 'loose', target: 'theme', kind: 'injects' }
    ],
    features: [
        { id: 'core', label: 'core' },
        { id: 'ui', label: 'ui' }
    ]
};

describe('relationsByFeature', () => {
    const groups = relationsByFeature(MODEL);

    it('groups the symbols with relations by feature, the ones without a feature last', () => {
        expect(groups.map(g => g.feature)).toEqual(['core', 'ui', undefined]);
        expect(groups[0].symbols.map(s => s.name)).toEqual(['provideTheme', 'ThemeService']);
        expect(groups[1].symbols.map(s => s.name)).toEqual(['CardComponent']);
        expect(groups[2].symbols.map(s => s.name)).toEqual(['LoosePipe']);
    });

    it('covers every relation kind, in a fixed order, targets by name', () => {
        expect(groups[1].symbols[0].relations).toEqual([
            { kind: 'imports', targets: ['BadgeComponent', 'NgClass'] },
            { kind: 'composes', targets: ['RippleDirective'] },
            { kind: 'injects', targets: ['ThemeService'] }
        ]);
        expect(groups[0].symbols[0].relations).toEqual([{ kind: 'provides', targets: ['THEME'] }]);
    });

    it('lists nothing for a graph without edges', () => {
        expect(relationsByFeature({ ...MODEL, edges: [] })).toEqual([]);
    });
});
