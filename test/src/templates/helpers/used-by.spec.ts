import { describe, expect, it } from 'vitest';

import {
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey
} from '../../../../src/app/compiler/semantic/model';
import { buildDiView } from '../../../../src/app/di';
import { buildSymbolTable, KIND_FOLDER } from '../../../../src/app/links';
import { usedByEntries } from '../../../../src/templates/helpers/used-by';

const F = 'lib/a.ts';
const key = (name: string): SymbolKey => ({ name, file: F });
const facts = (name: string, extra: Partial<SymbolFacts> = {}): SymbolFacts => ({
    key: key(name),
    exportedBy: ['@lib/a'],
    notExported: false,
    usedBy: [],
    ...extra
});

const table = buildSymbolTable(
    {
        classes: [{ name: 'Store', file: F }],
        interfaces: [{ name: 'Shape', file: F }],
        miscellaneous: {
            functions: [
                { name: 'format', file: F },
                { name: 'hiddenUser', file: F }
            ]
        }
    },
    { cwd: '/' }
);
const semantic: SemanticModel = {
    ...emptyModel(),
    facts: new Map(
        [
            facts('format', {
                usedBy: [key('Store'), key('hiddenUser'), key('notDocumented'), key('format')]
            }),
            facts('hiddenUser', { notExported: true, exportedBy: [] }),
            facts('Store'),
            {
                ...facts('Shape', { usedBy: [key('format')] }),
                key: { ...key('Shape'), space: 'type' }
            }
        ].map(f => [factKey(f.key), f])
    )
};
const di = buildDiView(table, semantic);
const data = { symbols: table, semantic, di };

describe('used by entries', () => {
    it('maps the users of a symbol to their pages, sorted by name', () => {
        expect(usedByEntries(data, 'function', { name: 'format', file: F })).toEqual([
            { name: 'Store', kind: 'class', hrefPrefix: KIND_FOLDER.class }
        ]);
    });

    it('drops hidden, undocumented and self users', () => {
        const names = usedByEntries(data, 'function', { name: 'format', file: F }).map(e => e.name);
        expect(names).not.toContain('hiddenUser');
        expect(names).not.toContain('notDocumented');
        expect(names).not.toContain('format');
    });

    it('joins a type to its type-space facts', () => {
        expect(usedByEntries(data, 'interface', { name: 'Shape', file: F })).toEqual([
            { name: 'format', kind: 'function', hrefPrefix: KIND_FOLDER.function }
        ]);
    });

    it('is empty without the semantic stage', () => {
        expect(usedByEntries({ symbols: table }, 'function', { name: 'format', file: F })).toEqual(
            []
        );
    });
});
