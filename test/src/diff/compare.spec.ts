import { describe, expect, it } from 'vitest';
import {
    EXPORT_SCHEMA_VERSION,
    type ExportData
} from '../../../src/app/interfaces/export-data.interface';
import { compare } from '../../../src/diff/compare';

/**
 * Compare-engine specs target the pure-functional walker — no classifier,
 * no formatters. Every assertion targets the EntityChange records emitted
 * directly out of `compare()`.
 */

const baseExport = (overrides: Partial<ExportData> = {}): ExportData => ({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    generatedAt: '2026-04-01T00:00:00.000Z',
    compodocxVersion: '0.3.0',
    components: [],
    pipes: [],
    modules: [],
    directives: [],
    injectables: [],
    guards: [],
    interceptors: [],
    classes: [],
    interfaces: [],
    ...overrides
});

describe('diff/compare — engine', () => {
    it('reports zero changes for identical inputs', () => {
        const data = baseExport({ components: [{ name: 'Foo' }] });
        const result = compare(data, data);
        expect(result.changes).toHaveLength(0);
        expect(result.unchanged).toBe(1);
    });

    it('emits component-removed when an entity disappears', () => {
        const oldData = baseExport({ components: [{ name: 'Foo' }, { name: 'Bar' }] });
        const newData = baseExport({ components: [{ name: 'Bar' }] });
        const result = compare(oldData, newData);
        expect(result.changes).toEqual([
            expect.objectContaining({ kind: 'component-removed', name: 'Foo' })
        ]);
        expect(result.unchanged).toBe(1);
    });

    it('emits component-added when a new entity appears', () => {
        const oldData = baseExport({ components: [{ name: 'Bar' }] });
        const newData = baseExport({ components: [{ name: 'Bar' }, { name: 'Baz' }] });
        const result = compare(oldData, newData);
        expect(result.changes).toEqual([
            expect.objectContaining({ kind: 'component-added', name: 'Baz' })
        ]);
        expect(result.unchanged).toBe(1);
    });

    it('emits component-changed with field-level shifts', () => {
        const oldData = baseExport({
            components: [{ name: 'Foo', selector: 'app-old', description: 'one' }]
        });
        const newData = baseExport({
            components: [{ name: 'Foo', selector: 'app-new', description: 'two' }]
        });
        const result = compare(oldData, newData);
        expect(result.changes).toHaveLength(1);
        const change = result.changes[0];
        expect(change.kind).toBe('component-changed');
        const fieldNames = change.changes.map(f => f.field).sort();
        expect(fieldNames).toEqual(['description', 'selector']);
    });

    it('walks inputsClass member shifts', () => {
        const oldData = baseExport({
            components: [
                {
                    name: 'Foo',
                    inputsClass: [
                        { name: 'value', type: 'string' },
                        { name: 'label', type: 'string' }
                    ]
                }
            ]
        });
        const newData = baseExport({
            components: [
                {
                    name: 'Foo',
                    inputsClass: [
                        { name: 'value', type: 'number' },
                        { name: 'id', type: 'string' }
                    ]
                }
            ]
        });
        const result = compare(oldData, newData);
        const change = result.changes[0];
        const sub = change.changes.map(f => `${f.kind}:${f.field}`).sort();
        expect(sub).toEqual([
            'member-added:inputsClass.id',
            'member-changed:inputsClass.value',
            'member-removed:inputsClass.label'
        ]);
    });

    it('strips volatile fields before counting unchanged', () => {
        const oldData = baseExport({
            generatedAt: '2026-04-01T00:00:00.000Z',
            compodocxVersion: '0.3.0',
            components: [{ name: 'Foo' }]
        });
        const newData = baseExport({
            generatedAt: '2026-09-01T00:00:00.000Z',
            compodocxVersion: '0.4.0',
            components: [{ name: 'Foo' }]
        });
        const result = compare(oldData, newData);
        expect(result.changes).toHaveLength(0);
        expect(result.unchanged).toBe(1);
    });

    it('does not mutate either input', () => {
        const oldData = baseExport({ components: [{ name: 'Foo' }] });
        const newData = baseExport({ components: [{ name: 'Bar' }] });
        const oldCopy = JSON.parse(JSON.stringify(oldData));
        const newCopy = JSON.parse(JSON.stringify(newData));
        compare(oldData, newData);
        expect(oldData).toEqual(oldCopy);
        expect(newData).toEqual(newCopy);
    });

    it('reports a symbol whose file moved as unchanged', () => {
        const oldData = baseExport({ classes: [{ name: 'Store', file: 'src/a/store.ts' }] });
        const newData = baseExport({ classes: [{ name: 'Store', file: 'src/b/store.ts' }] });
        const result = compare(oldData, newData);
        expect(result.changes).toHaveLength(0);
        expect(result.unchanged).toBe(1);
    });

    it('pairs same-name symbols of one kind by file', () => {
        const oldData = baseExport({
            classes: [
                { name: 'Todo', file: 'src/a/todo.ts', description: 'a' },
                { name: 'Todo', file: 'src/b/todo.ts', description: 'b' }
            ]
        });
        const newData = baseExport({
            classes: [
                { name: 'Todo', file: 'src/a/todo.ts', description: 'a' },
                { name: 'Todo', file: 'src/b/todo.ts', description: 'b2' }
            ]
        });
        const result = compare(oldData, newData);
        expect(result.changes).toEqual([
            expect.objectContaining({ kind: 'class-changed', name: 'Todo', file: 'src/b/todo.ts' })
        ]);
        expect(result.unchanged).toBe(1);
    });

    it('reports a symbol that changed kind as removed and added', () => {
        const oldData = baseExport({ classes: [{ name: 'Shape', file: 'src/shape.ts' }] });
        const newData = baseExport({ interfaces: [{ name: 'Shape', file: 'src/shape.ts' }] });
        const result = compare(oldData, newData);
        expect(result.changes).toEqual([
            expect.objectContaining({ kind: 'class-removed', name: 'Shape' }),
            expect.objectContaining({ kind: 'interface-added', name: 'Shape' })
        ]);
    });
});
