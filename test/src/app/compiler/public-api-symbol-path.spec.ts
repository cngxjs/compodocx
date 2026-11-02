import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';
import Configuration from '../../../../src/app/configuration';

/**
 * Functions, enums and type aliases are declarations with a symbol, so the
 * public API filter is applied on the one symbol path: a symbol outside the
 * public API is dropped, one inside is kept.
 */
describe('AngularDependencies - public API filter on declarations', () => {
    let tmpDir: string;
    let result: any;
    const saved = {
        publicApiOnly: Configuration.mainData.publicApiOnly,
        publicApiExports: Configuration.mainData.publicApiExports,
        publicApiDeclarations: Configuration.mainData.publicApiDeclarations
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-public-api-')));
        const file = path.join(tmpDir, 'api.ts');
        fs.writeFileSync(
            file,
            `export function shownFn(): void {}
export function hiddenFn(): void {}
export enum ShownEnum { A }
export enum HiddenEnum { B }
export type ShownAlias = string;
export type HiddenAlias = number;
`
        );
        Configuration.mainData.publicApiOnly = tmpDir;
        Configuration.mainData.publicApiExports = new Map(
            ['shownFn', 'ShownEnum', 'ShownAlias'].map(name => [name, new Set([file])])
        );
        Configuration.mainData.publicApiDeclarations = Configuration.mainData.publicApiExports;
        result = new AngularDependencies([file], { tsconfigDirectory: tmpDir }).getDependencies();
    });

    afterAll(() => {
        Configuration.mainData.publicApiOnly = saved.publicApiOnly;
        Configuration.mainData.publicApiExports = saved.publicApiExports;
        Configuration.mainData.publicApiDeclarations = saved.publicApiDeclarations;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const names = (list: any[]) => list.map(item => item.name);

    it('keeps public functions and drops the others', () => {
        expect(names(result.miscellaneous.functions)).toEqual(['shownFn']);
    });

    it('keeps public enums and drops the others', () => {
        expect(names(result.miscellaneous.enumerations)).toEqual(['ShownEnum']);
    });

    it('keeps public type aliases and drops the others', () => {
        expect(names(result.miscellaneous.typealiases)).toEqual(['ShownAlias']);
    });
});

/**
 * The filter reads the map followed to the declarations: a name recorded
 * only against a barrel is kept once the declaring file is in that map.
 */
describe('AngularDependencies - public API filter on the resolved map', () => {
    let tmpDir: string;
    let file: string;
    let barrel: string;
    const saved = {
        publicApiOnly: Configuration.mainData.publicApiOnly,
        publicApiExports: Configuration.mainData.publicApiExports,
        publicApiDeclarations: Configuration.mainData.publicApiDeclarations
    };

    const functionsWith = (declarations: Map<string, Set<string>>): string[] => {
        Configuration.mainData.publicApiDeclarations = declarations;
        const result: any = new AngularDependencies([file], {
            tsconfigDirectory: tmpDir
        }).getDependencies();
        return result.miscellaneous.functions.map((item: any) => item.name);
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-public-api-')));
        file = path.join(tmpDir, 'a.ts');
        barrel = path.join(tmpDir, 'index.ts');
        fs.writeFileSync(
            file,
            'export function pub(): void {}\nexport function other(): void {}\n'
        );
        fs.writeFileSync(barrel, "export { pub } from './a';\n");
        Configuration.mainData.publicApiOnly = tmpDir;
        Configuration.mainData.publicApiExports = new Map([['pub', new Set([barrel])]]);
    });

    afterAll(() => {
        Configuration.mainData.publicApiOnly = saved.publicApiOnly;
        Configuration.mainData.publicApiExports = saved.publicApiExports;
        Configuration.mainData.publicApiDeclarations = saved.publicApiDeclarations;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('keeps a re-exported symbol whose declaring file is in the resolved map', () => {
        expect(functionsWith(new Map([['pub', new Set([barrel, file])]]))).toEqual(['pub']);
    });

    it('drops it while only the barrel is known', () => {
        expect(functionsWith(new Map([['pub', new Set([barrel])]]))).toEqual([]);
    });
});

/**
 * A namespace member is allowed by its qualified name; a module augmentation
 * member is allowed when its file declares a public symbol.
 */
describe('AngularDependencies - public API filter on namespaces', () => {
    let tmpDir: string;
    let result: any;
    const saved = {
        publicApiOnly: Configuration.mainData.publicApiOnly,
        publicApiDeclarations: Configuration.mainData.publicApiDeclarations
    };

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-public-api-ns-')));
        const file = path.join(tmpDir, 'api.ts');
        const other = path.join(tmpDir, 'other.ts');
        fs.writeFileSync(
            file,
            `export namespace Shown { export interface Shape { id: number; } export const LIMIT = 1; }
export namespace Hidden { export interface Shape { id: number; } }
declare module 'runner' { interface Matchers<R> { toShow(): R; } }
`
        );
        fs.writeFileSync(
            other,
            `export const nothingPublic = 1;
declare module 'runner' { interface Expect { hidden: true; } }
`
        );
        Configuration.mainData.publicApiOnly = tmpDir;
        Configuration.mainData.publicApiDeclarations = new Map(
            ['Shown', 'Shown.Shape', 'Shown.LIMIT'].map(name => [name, new Set([file])])
        );
        result = new AngularDependencies([file, other], {
            tsconfigDirectory: tmpDir
        }).getDependencies();
    });

    afterAll(() => {
        Configuration.mainData.publicApiOnly = saved.publicApiOnly;
        Configuration.mainData.publicApiDeclarations = saved.publicApiDeclarations;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const qualified = (list: any[]) =>
        list.map(item => (item.namespace ? `${item.namespace}.${item.name}` : item.name));

    it('keeps the members of a public namespace and drops the rest', () => {
        expect(qualified(result.namespaces)).toEqual(['Shown']);
        expect(qualified(result.miscellaneous.variables)).toEqual(['Shown.LIMIT']);
        expect(qualified(result.interfaces)).toContain('Shown.Shape');
        expect(qualified(result.interfaces)).not.toContain('Hidden.Shape');
    });

    it('keeps an augmentation member only in a file with a public symbol', () => {
        expect(qualified(result.interfaces)).toContain('Matchers');
        expect(qualified(result.interfaces)).not.toContain('Expect');
    });
});
