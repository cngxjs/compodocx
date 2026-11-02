import { describe, expect, it } from 'vitest';
import { mergeOverloads } from '../../../../src/app/compiler/angular/deps/helpers/class-helper/overloads';

const method = (name: string, line: number) => ({ name, line });

describe('mergeOverloads', () => {
    it('keeps a method without overloads as it is', () => {
        expect(mergeOverloads([{ method: method('a', 1), hasBody: true }])).toEqual([
            method('a', 1)
        ]);
    });

    it('makes the overload signatures one entry and drops the implementation', () => {
        expect(
            mergeOverloads([
                { method: method('select', 1), hasBody: false },
                { method: method('select', 2), hasBody: false },
                { method: method('select', 3), hasBody: true }
            ])
        ).toEqual([{ ...method('select', 1), overloads: [method('select', 2)] }]);
    });

    it('keeps every signature of an interface method', () => {
        expect(
            mergeOverloads([
                { method: method('on', 1), hasBody: false },
                { method: method('on', 2), hasBody: false }
            ])
        ).toEqual([{ ...method('on', 1), overloads: [method('on', 2)] }]);
    });
});
