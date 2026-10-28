import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Only declarations a file exports are documented: the `export` keyword,
 * `export { a as b }` and `export default a` count, file-local helpers do
 * not. A script file (no import or export) keeps all of its declarations.
 */
describe('AngularDependencies - file-local declarations', () => {
    let tmpDir: string;
    let result: any;

    const names = (list: any[]): string[] => list.map(item => item.name);

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-file-local-')));
        fs.writeFileSync(
            path.join(tmpDir, 'module.ts'),
            `import { InjectionToken } from '@angular/core';

export function exportedFn(): void {}
function localFn(): void {}

export const exportedVar = 1;
const localVar = 2;

export interface ExportedShape { id: number; }
interface LocalShape { id: number; }

export type ExportedAlias = string;
type LocalAlias = string;

export enum ExportedEnum { A }
enum LocalEnum { A }

export const EXPORTED_TOKEN = new InjectionToken<string>('exported');
const LOCAL_TOKEN = new InjectionToken<string>('local');

export const [exportedFirst] = [1];
const [localFirst] = [1];

function listedFn(): void {}
const renamedVar = 3;
interface ListedShape { id: number; }
type ListedAlias = number;
enum ListedEnum { B }
function defaultFn(): void {}

export { listedFn, renamedVar as publicVar, ListedShape, ListedAlias, ListedEnum };
export default defaultFn;
`
        );
        fs.writeFileSync(
            path.join(tmpDir, 'script.ts'),
            `function scriptFn(): void {}
const scriptVar = 1;
`
        );
        const deps = new AngularDependencies(
            [path.join(tmpDir, 'module.ts'), path.join(tmpDir, 'script.ts')],
            { tsconfigDirectory: tmpDir }
        );
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('keeps exported and drops file-local functions', () => {
        const functions = names(result.miscellaneous.functions);
        expect(functions).toEqual(
            expect.arrayContaining(['exportedFn', 'listedFn', 'defaultFn', 'scriptFn'])
        );
        expect(functions).not.toContain('localFn');
    });

    it('keeps exported and drops file-local variables', () => {
        const variables = names(result.miscellaneous.variables);
        expect(variables).toEqual(
            expect.arrayContaining(['exportedVar', 'renamedVar', 'exportedFirst', 'scriptVar'])
        );
        expect(variables).not.toContain('localVar');
        expect(variables).not.toContain('localFirst');
    });

    it('keeps exported and drops file-local interfaces', () => {
        const interfaces = names(result.interfaces);
        expect(interfaces).toEqual(expect.arrayContaining(['ExportedShape', 'ListedShape']));
        expect(interfaces).not.toContain('LocalShape');
    });

    it('keeps exported and drops file-local type aliases', () => {
        const aliases = names(result.miscellaneous.typealiases);
        expect(aliases).toEqual(expect.arrayContaining(['ExportedAlias', 'ListedAlias']));
        expect(aliases).not.toContain('LocalAlias');
    });

    it('keeps exported and drops file-local enums', () => {
        const enums = names(result.miscellaneous.enumerations);
        expect(enums).toEqual(expect.arrayContaining(['ExportedEnum', 'ListedEnum']));
        expect(enums).not.toContain('LocalEnum');
    });

    it('keeps exported and drops file-local tokens', () => {
        const tokens = names(result.tokens);
        expect(tokens).toContain('EXPORTED_TOKEN');
        expect(tokens).not.toContain('LOCAL_TOKEN');
    });
});
