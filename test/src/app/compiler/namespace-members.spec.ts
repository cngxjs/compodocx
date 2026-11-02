import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * Namespace members keep the chain of their namespaces; inside a namespace
 * only exported members are documented, the namespace itself follows the
 * file rule.
 */
describe('AngularDependencies - namespace members', () => {
    let tmpDir: string;
    let result: any;

    const scoped = (list: any[]): string[] =>
        list.map(item => (item.namespace ? `${item.namespace}.${item.name}` : item.name));

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-namespaces-')));
        fs.writeFileSync(
            path.join(tmpDir, 'module.ts'),
            `/** The outer namespace. */
export namespace Outer {
    export interface Shape { id: number; }
    interface Hidden { id: number; }
    export const VALUE = 1;
    const local = 2;
    export namespace Inner { export type Deep = string; }
    export function read(): number { return local; }
    export class Box {}
    class HiddenBox {}
}
export namespace Outer.Dotted { export enum Mode { A } }
export namespace Other { export interface Shape { other: true; } }
namespace Local { export const NEVER = 1; }
export const TOP = 1;
`
        );
        const deps = new AngularDependencies([path.join(tmpDir, 'module.ts')], {
            tsconfigDirectory: tmpDir
        });
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('records each namespace with its parent chain and description', () => {
        expect(scoped(result.namespaces)).toEqual(
            expect.arrayContaining(['Outer', 'Outer.Inner', 'Outer.Dotted', 'Other'])
        );
        const outer = result.namespaces.find(entry => entry.name === 'Outer');
        expect(outer.namespace).toBeUndefined();
        expect(outer.rawdescription).toBe('The outer namespace.');
    });

    it('keeps the namespace chain on exported members', () => {
        expect(scoped(result.interfaces)).toEqual(['Outer.Shape', 'Other.Shape']);
        expect(scoped(result.miscellaneous.variables)).toEqual(['Outer.VALUE', 'TOP']);
        expect(scoped(result.miscellaneous.typealiases)).toEqual(['Outer.Inner.Deep']);
        expect(scoped(result.miscellaneous.functions)).toEqual(['Outer.read']);
        expect(scoped(result.miscellaneous.enumerations)).toEqual(['Outer.Dotted.Mode']);
        expect(scoped(result.classes)).toEqual(['Outer.Box']);
    });

    it('drops members the namespace does not export', () => {
        const all = [
            ...scoped(result.interfaces),
            ...scoped(result.classes),
            ...scoped(result.miscellaneous.variables)
        ];
        expect(all).not.toContain('Outer.Hidden');
        expect(all).not.toContain('Outer.HiddenBox');
        expect(all).not.toContain('Outer.local');
    });

    it('drops a namespace the file does not export, with its members', () => {
        expect(scoped(result.namespaces)).not.toContain('Local');
        expect(scoped(result.miscellaneous.variables)).not.toContain('Local.NEVER');
    });

    it('lists the qualified members of each namespace', () => {
        const members = (name: string) =>
            result.namespaces.find(entry => scoped([entry])[0] === name).members;
        expect(members('Outer')).toEqual([
            'Outer.Box',
            'Outer.Dotted',
            'Outer.Inner',
            'Outer.Shape',
            'Outer.VALUE',
            'Outer.read'
        ]);
        expect(members('Outer.Dotted')).toEqual(['Outer.Dotted.Mode']);
    });
});
