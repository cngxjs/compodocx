import { describe, expect, it } from 'vitest';

import { GRAPH_SCHEMA_VERSION, type GraphModel, neighbourhood } from '../../../../src/app/graph';

const node = (id: string, kind: 'component' | 'token' | 'external' = 'component') => ({
    id,
    name: id,
    kind,
    feature: 'f'
});

const MODEL: GraphModel = {
    nodes: [
        node('app'),
        node('card'),
        node('badge'),
        node('THEME', 'token'),
        node('NgClass', 'external'),
        node('other')
    ],
    edges: [
        { source: 'app', target: 'card', kind: 'imports' },
        { source: 'card', target: 'badge', kind: 'imports' },
        { source: 'card', target: 'THEME', kind: 'injects' },
        { source: 'card', target: 'NgClass', kind: 'imports' },
        { source: 'badge', target: 'other', kind: 'imports' }
    ],
    features: [{ id: 'f', label: 'f' }]
};

describe('neighbourhood', () => {
    const local = neighbourhood(MODEL, 'card');

    it('keeps every relation of the symbol, both directions and every kind, one hop', () => {
        expect(local?.schemaVersion).toBe(GRAPH_SCHEMA_VERSION);
        expect(local?.nodes.map(n => n.id).sort()).toEqual([
            'NgClass',
            'THEME',
            'app',
            'badge',
            'card'
        ]);
        expect(local?.edges).toHaveLength(4);
        expect(local?.edges.some(e => e.target === 'other')).toBe(false);
    });

    it('puts the symbol in the middle, its users left and what it uses right', () => {
        const at = new Map(local?.nodes.map(n => [n.id, n]));
        expect(at.get('card')).toMatchObject({ x: 0, y: 0 });
        expect(at.get('app')?.x).toBeLessThan(0);
        for (const id of ['badge', 'THEME', 'NgClass']) {
            expect(at.get(id)?.x).toBeGreaterThan(0);
        }
        expect((at.get('card')?.r ?? 0) > (at.get('badge')?.r ?? 0)).toBe(true);
    });

    it('draws no islands', () => {
        expect(local?.features).toEqual([]);
        expect(local?.nodes.some(n => n.feature !== undefined)).toBe(false);
    });

    it('keeps neighbours apart', () => {
        const right = (local?.nodes ?? []).filter(n => (n.x ?? 0) > 0);
        for (const [i, a] of right.entries()) {
            for (const b of right.slice(i + 1)) {
                expect(
                    Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0))
                ).toBeGreaterThan((a.r ?? 0) + (b.r ?? 0));
            }
        }
    });

    it('is undefined for a symbol without relations or an unknown id', () => {
        expect(neighbourhood({ ...MODEL, edges: [] }, 'card')).toBeUndefined();
        expect(neighbourhood(MODEL, 'missing')).toBeUndefined();
    });
});
