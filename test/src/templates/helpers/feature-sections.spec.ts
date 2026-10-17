import { describe, expect, it } from 'vitest';

import { type DiView, emptyDiView, type Placement } from '../../../../src/app/di/model';
import { symbolId, type TableKind } from '../../../../src/app/links/symbol-id';
import type { SymbolEntry } from '../../../../src/app/links/symbol-table';
import { sectionOf } from '../../../../src/templates/helpers/feature-sections';

const entry = (kind: TableKind, name = 'Foo'): SymbolEntry => {
    const ref = { kind, file: 'src/foo.ts', name };
    return {
        id: symbolId(ref),
        ref,
        data: {},
        folder: [],
        fileName: name,
        overloads: 0
    };
};

const viewWith = (e: SymbolEntry, placement: Placement): DiView => ({
    ...emptyDiView(),
    placement: new Map([[e.id, placement]])
});

describe('sectionOf', () => {
    const own: [TableKind, string][] = [
        ['component', 'components'],
        ['directive', 'directives'],
        ['pipe', 'pipes'],
        ['injectable', 'services'],
        ['token', 'configuration'],
        ['variable', 'constants'],
        ['interface', 'types'],
        ['typealias', 'types'],
        ['enumeration', 'types'],
        ['class', 'classes'],
        ['entity', 'classes'],
        ['function', 'utilities'],
        ['guard', 'utilities'],
        ['interceptor', 'utilities'],
        ['resolver', 'utilities']
    ];

    for (const [kind, section] of own) {
        it(`puts an own ${kind} into ${section}`, () => {
            expect(sectionOf(entry(kind), undefined)).toBe(section);
            expect(sectionOf(entry(kind), emptyDiView())).toBe(section);
        });
    }

    it('leaves style files out', () => {
        expect(sectionOf(entry('style'), undefined)).toBeUndefined();
    });

    it('leaves hidden symbols out', () => {
        const e = entry('function');
        expect(sectionOf(e, viewWith(e, { type: 'hidden' }))).toBeUndefined();
    });

    const placed: Placement[] = [
        { type: 'provider' },
        { type: 'cluster', owner: symbolId({ kind: 'interface', file: 'src/f.ts', name: 'F' }) },
        { type: 'cluster-owner' }
    ];
    for (const placement of placed) {
        it(`puts a ${placement.type} placement into configuration whatever its kind`, () => {
            for (const kind of ['function', 'interface', 'typealias'] as const) {
                const e = entry(kind);
                expect(sectionOf(e, viewWith(e, placement))).toBe('configuration');
            }
        });
    }

    const owner = symbolId({ kind: 'interface', file: 'src/f.ts', name: 'F' });
    const accessorView = (e: SymbolEntry): DiView => ({
        ...emptyDiView(),
        accessors: new Map([[e.id, [owner]]])
    });

    it('puts a config accessor function into configuration', () => {
        const e = entry('function', 'injectFoo');
        expect(sectionOf(e, accessorView(e))).toBe('configuration');
    });

    it('puts a config accessor const into configuration, not constants', () => {
        const e = entry('variable', 'injectFoo');
        expect(sectionOf(e, accessorView(e))).toBe('configuration');
    });

    it('keeps a function that is no config accessor in utilities', () => {
        const other = entry('function', 'injectBar');
        expect(sectionOf(other, accessorView(entry('function', 'injectFoo')))).toBe('utilities');
    });
});
