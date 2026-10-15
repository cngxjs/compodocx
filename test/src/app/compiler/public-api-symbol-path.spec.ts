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
        publicApiExports: Configuration.mainData.publicApiExports
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
        Configuration.mainData.publicApiOnly = true;
        Configuration.mainData.publicApiExports = new Map(
            ['shownFn', 'ShownEnum', 'ShownAlias'].map(name => [name, new Set([file])])
        );
        result = new AngularDependencies([file], { tsconfigDirectory: tmpDir }).getDependencies();
    });

    afterAll(() => {
        Configuration.mainData.publicApiOnly = saved.publicApiOnly;
        Configuration.mainData.publicApiExports = saved.publicApiExports;
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
