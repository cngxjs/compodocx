import { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';

import { collectDeclarations, usedByEdges } from '../../../../../src/app/compiler/semantic';

const FILES: Record<string, string> = {
    '/p/a.ts': `
import { helper, Base, Shape, unused } from './b';
export { unused as reexported } from './b';
export function run(): number { return helper(); }
export function shaped(value: Shape): Shape { return value; }
export class Child extends Base {
    compute(): number { return helper(); }
}
export function recurse(n: number): number { return n > 0 ? recurse(n - 1) : 0; }
`,
    '/p/b.ts': `
export function helper(): number { return 1; }
export interface Shape { readonly size: number }
export class Base {}
export function unused(): void {}
`
};

let edges: ReadonlyMap<string, readonly { name: string; file: string }[]>;

const usersOf = (file: string, name: string): readonly string[] =>
    (edges.get(`${file}#${name}`) ?? []).map(key => `${key.file}#${key.name}`);

beforeAll(() => {
    const options: ts.CompilerOptions = { noLib: true, types: [], noEmit: true };
    const host = ts.createCompilerHost(options, true);
    host.fileExists = fileName => fileName in FILES;
    host.directoryExists = () => true;
    host.readFile = fileName => FILES[fileName];
    host.getSourceFile = (fileName, version) =>
        fileName in FILES
            ? ts.createSourceFile(fileName, FILES[fileName], version, true)
            : undefined;
    const program = ts.createProgram({ rootNames: Object.keys(FILES), options, host });
    const checker = program.getTypeChecker();
    const sourceFiles = Object.keys(FILES).map(
        file => program.getSourceFile(file) as ts.SourceFile
    );
    edges = usedByEdges(collectDeclarations(sourceFiles, checker, '/p'), checker);
});

describe('used-by edges', () => {
    it('records a function calling another function', () => {
        expect(usersOf('b.ts', 'helper')).toContain('a.ts#run');
    });

    it('records a type reference', () => {
        expect(usersOf('b.ts', 'Shape')).toEqual(['a.ts#shaped']);
    });

    it('records a heritage clause', () => {
        expect(usersOf('b.ts', 'Base')).toEqual(['a.ts#Child']);
    });

    it('rolls a member reference up to its class', () => {
        expect(usersOf('b.ts', 'helper')).toEqual(['a.ts#Child', 'a.ts#run']);
    });

    it('drops self edges', () => {
        expect(usersOf('a.ts', 'recurse')).toEqual([]);
    });

    it('ignores import specifiers', () => {
        expect(usersOf('b.ts', 'unused')).toEqual([]);
        expect([...edges.keys()].every(key => !key.startsWith('a.ts#'))).toBe(true);
    });
});
