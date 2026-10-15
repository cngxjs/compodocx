import { describe, expect, it } from 'vitest';
import { classifyChange } from '../../../src/diff/classify';
import type { EntityChange, FieldChange } from '../../../src/diff/types';

/**
 * Per-rule classification spec. One `it()` per row in the plan-document
 * severity table. Mocks minimal EntityChange shapes — never touches disk.
 */

const entityChange = (
    kind: EntityChange['kind'],
    name: string,
    changes: FieldChange[] = []
): EntityChange => ({
    kind,
    entity: kind.split('-')[0] as EntityChange['entity'],
    name,
    file: `src/${name}.ts`,
    changes,
    severity: 'docs-only'
});

describe('diff/rules — severity classification', () => {
    it('component removed → breaking', () => {
        const result = classifyChange(entityChange('component-removed', 'FooComponent'));
        expect(result.severity).toBe('breaking');
    });

    it('component added → additive', () => {
        const result = classifyChange(entityChange('component-added', 'FooComponent'));
        expect(result.severity).toBe('additive');
    });

    it('selector changed → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'selector',
                    kind: 'value-changed',
                    oldValue: 'app-old',
                    newValue: 'app-new'
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('required input added (no defaultValue) → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'inputsClass.id',
                    kind: 'member-added',
                    newValue: { name: 'id', type: 'string' }
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('optional input added (with defaultValue) → additive', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'inputsClass.label',
                    kind: 'member-added',
                    newValue: { name: 'label', type: 'string', defaultValue: "''" }
                }
            ])
        );
        expect(result.severity).toBe('additive');
    });

    it('input removed → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'inputsClass.value',
                    kind: 'member-removed',
                    oldValue: { name: 'value', type: 'string' }
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('input type changed → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'inputsClass.value',
                    kind: 'member-changed',
                    nested: [
                        {
                            field: 'type',
                            kind: 'value-changed',
                            oldValue: 'string',
                            newValue: 'number'
                        }
                    ]
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('public method added → additive', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'methodsClass.submit',
                    kind: 'member-added',
                    newValue: { name: 'submit', returnType: 'void' }
                }
            ])
        );
        expect(result.severity).toBe('additive');
    });

    it('public method removed → breaking', () => {
        const result = classifyChange(
            entityChange('class-changed', 'MyService', [
                {
                    field: 'methods.start',
                    kind: 'member-removed',
                    oldValue: { name: 'start', returnType: 'void' }
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('description-only change → docs-only', () => {
        const result = classifyChange(
            entityChange('pipe-changed', 'FormatDate', [
                { field: 'description', kind: 'value-changed', oldValue: 'old', newValue: 'new' }
            ])
        );
        expect(result.severity).toBe('docs-only');
    });

    it('@deprecated added → additive (warns, not the break itself)', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                { field: 'deprecated', kind: 'value-changed', oldValue: false, newValue: true }
            ])
        );
        expect(result.severity).toBe('additive');
    });

    it('theme token added → additive', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'themeTokens.--foo-padding',
                    kind: 'member-added',
                    newValue: { name: '--foo-padding', type: 'length' }
                }
            ])
        );
        expect(result.severity).toBe('additive');
    });

    it('theme token removed → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'themeTokens.--foo-color',
                    kind: 'member-removed',
                    oldValue: { name: '--foo-color', type: 'color' }
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('theme token type changed → breaking', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'themeTokens.--foo-color',
                    kind: 'member-changed',
                    nested: [
                        {
                            field: 'type',
                            kind: 'value-changed',
                            oldValue: 'color',
                            newValue: 'length'
                        }
                    ]
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });

    it('signalDeps shift → docs-only (internal derivation)', () => {
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                {
                    field: 'inputsClass.computed',
                    kind: 'member-changed',
                    nested: [
                        {
                            field: 'signalDeps',
                            kind: 'value-changed',
                            oldValue: ['a()'],
                            newValue: ['b()']
                        }
                    ]
                }
            ])
        );
        expect(result.severity).toBe('docs-only');
    });

    it('worst severity wins across multiple field shifts', () => {
        // FooComponent: description changed (docs-only) + input removed (breaking)
        const result = classifyChange(
            entityChange('component-changed', 'FooComponent', [
                { field: 'description', kind: 'value-changed', oldValue: 'a', newValue: 'b' },
                {
                    field: 'inputsClass.gone',
                    kind: 'member-removed',
                    oldValue: { name: 'gone' }
                }
            ])
        );
        expect(result.severity).toBe('breaking');
    });
});
