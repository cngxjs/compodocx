import { describe, expect, it } from 'vitest';
import { factKey, relativeFile } from '../../../src/app/compiler/semantic';
import { parseSymbolId, symbolFile, symbolId, toSymbolKey } from '../../../src/app/links/symbol-id';
import { isErr, isOk } from '../../../src/lib';

describe('symbol ids', () => {
    it('round-trips through parseSymbolId', () => {
        const ref = { kind: 'class', file: 'src/a/foo.ts', name: 'Foo' } as const;
        const id = symbolId(ref);
        expect(id).toBe('class:src/a/foo.ts#Foo');
        const parsed = parseSymbolId(id);
        expect(isOk(parsed) && parsed.value).toEqual(ref);
    });

    it('rejects malformed ids', () => {
        expect(isErr(parseSymbolId('Foo'))).toBe(true);
        expect(isErr(parseSymbolId('class:src/foo.ts'))).toBe(true);
        expect(isErr(parseSymbolId('class:src/foo.ts#'))).toBe(true);
        expect(isErr(parseSymbolId('widget:src/foo.ts#Foo'))).toBe(true);
    });

    it('gives overloads of one function the same id', () => {
        const a = symbolId({ kind: 'function', file: 'src/fill.ts', name: 'fill' });
        const b = symbolId({ kind: 'function', file: 'src/fill.ts', name: 'fill' });
        expect(a).toBe(b);
    });

    it('gives a const and a type of one name in one file two ids', () => {
        const value = symbolId({ kind: 'variable', file: 'src/row.ts', name: 'Row' });
        const type = symbolId({ kind: 'typealias', file: 'src/row.ts', name: 'Row' });
        expect(value).not.toBe(type);
    });

    it('normalises a file outside cwd the same from both formats', () => {
        const cwd = '/work/repo';
        const crawler = '/work/shared/util.ts';
        const semantic = relativeFile(cwd, crawler);
        expect(symbolFile(crawler, cwd)).toBe('../shared/util.ts');
        expect(symbolFile(semantic, cwd)).toBe('../shared/util.ts');
        expect(symbolFile('src\\app\\foo.ts', cwd)).toBe('src/app/foo.ts');
    });

    it('joins a semantic fact through toSymbolKey', () => {
        const ref = { kind: 'injectable', file: 'src/data.service.ts', name: 'Data' } as const;
        expect(factKey(toSymbolKey(ref))).toBe('src/data.service.ts#Data');
    });
});
