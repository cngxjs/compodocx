import { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';

import { collectDeclarations, usedByEdges } from '../../../../../src/app/compiler/semantic';
import { memoryProgram } from '../../routing/program';

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

const usersOf = (file: string, name: string, space = ''): readonly string[] =>
    (edges.get(`${space}${file}#${name}`) ?? []).map(key => `${key.file}#${key.name}`);

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
        expect(usersOf('b.ts', 'Shape', 'type:')).toEqual(['a.ts#shaped']);
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

describe('used-by edges of injectAsync', () => {
    const LOADS: Record<string, string> = {
        '/p/engine.ts':
            'export default class Engine {}\nexport class Named {}\nexport class Other {}\n',
        '/p/loader.ts': `
import { injectAsync } from '@angular/core';
export class Loader {
    readonly engine = injectAsync(() => import('./engine'));
    readonly named = injectAsync(() => import('./engine').then(m => m.Named));
}
export const route = { loadComponent: () => import('./engine').then(m => m.Other) };
`
    };
    let loadEdges: ReadonlyMap<string, readonly { name: string; file: string }[]>;
    const loadUsers = (name: string): readonly string[] =>
        (loadEdges.get(`engine.ts#${name}`) ?? []).map(key => `${key.file}#${key.name}`);

    beforeAll(() => {
        const program = memoryProgram(LOADS);
        const checker = program.getTypeChecker();
        const sourceFiles = Object.keys(LOADS).map(
            file => program.getSourceFile(file) as ts.SourceFile
        );
        loadEdges = usedByEdges(collectDeclarations(sourceFiles, checker, '/p'), checker);
    });

    it('records the class an injectAsync loader loads', () => {
        expect(loadUsers('Engine')).toEqual(['loader.ts#Loader']);
        expect(loadUsers('Named')).toEqual(['loader.ts#Loader']);
    });

    it('records no edge for another dynamic import', () => {
        expect(loadUsers('Other')).toEqual([]);
    });
});
