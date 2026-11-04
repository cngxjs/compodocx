import { describe, expect, it } from 'vitest';
import {
    documentedNamespaces,
    namespacesWithContent
} from '../../../../src/app/compiler/angular-dependencies/namespace-content';

const ns = (name: string, members: string[], extra: Record<string, unknown> = {}) => ({
    name,
    members,
    ...extra
});

describe('namespace content', () => {
    it('counts a member or an alias as content', () => {
        const withContent = namespacesWithContent([
            ns('Geometry', ['Geometry.Point']),
            ns('Api', [], { aliases: [{ name: 'Point' }] }),
            ns('Empty', [])
        ]);
        expect([...withContent].sort()).toEqual(['Api', 'Geometry']);
    });

    it('leaves out a namespace whose only members are empty namespaces', () => {
        const withContent = namespacesWithContent([
            ns('Outer', ['Outer.Middle']),
            ns('Middle', ['Outer.Middle.Inner'], { namespace: 'Outer' }),
            ns('Inner', [], { namespace: 'Outer.Middle' })
        ]);
        expect(withContent.size).toBe(0);
    });

    it('keeps an outer namespace when a nested one has content', () => {
        const withContent = namespacesWithContent([
            ns('Outer', ['Outer.Inner']),
            ns('Inner', ['Outer.Inner.Deep'], { namespace: 'Outer' })
        ]);
        expect([...withContent].sort()).toEqual(['Outer', 'Outer.Inner']);
    });

    it('treats a missing member list as empty and survives a cycle', () => {
        const withContent = namespacesWithContent([
            { name: 'Bare' },
            ns('A', ['B']),
            ns('B', ['A'])
        ]);
        expect(withContent.size).toBe(0);
    });

    it('filters the list in its order', () => {
        const list = [ns('Z', ['Z.x']), ns('Empty', []), ns('A', ['A.y'])];
        expect(documentedNamespaces(list).map(entry => entry.name)).toEqual(['Z', 'A']);
        expect(documentedNamespaces(undefined)).toEqual([]);
    });
});
