import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ts } from 'ts-morph';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AngularDependencies } from '../../../../src/app/compiler/angular-dependencies';

/**
 * `export import X = Ns.Y` is recorded as an alias of its namespace (or as
 * a top-level alias), with the qualified target the checker resolves.
 */
describe('AngularDependencies - namespace aliases', () => {
    let tmpDir: string;
    let result: any;

    beforeAll(() => {
        tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-ns-alias-')));
        fs.writeFileSync(
            path.join(tmpDir, 'geometry.ts'),
            `/** Shapes. */
export namespace Geometry {
    /** A point in the plane. */
    export interface Point { x: number; }
    export function distance(): number { return 0; }
    export namespace Deep { export const ORIGIN = 0; }
}
`
        );
        fs.writeFileSync(
            path.join(tmpDir, 'api.ts'),
            `import { Geometry } from './geometry';
import G = Geometry;
/** The API. */
export namespace Api {
    /** The point of the API. */
    export import Point = Geometry.Point;
    export import distance = G.distance;
    export import Origin = Geometry.Deep.ORIGIN;
    import Hidden = Geometry.Point;
    export import type OnlyType = Geometry.Point;
}
/** A top-level alias. */
export import Pt = Geometry.Point;
export namespace Empty {}
`
        );
        const deps = new AngularDependencies(
            [path.join(tmpDir, 'geometry.ts'), path.join(tmpDir, 'api.ts')],
            {
                tsconfigDirectory: tmpDir,
                // As in a real run: imports between project files resolve.
                resolution: {
                    moduleResolution: ts.ModuleResolutionKind.Bundler,
                    module: ts.ModuleKind.ESNext
                }
            }
        );
        result = deps.getDependencies();
    });

    afterAll(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    const aliasesOf = (name: string) =>
        result.namespaces.find(entry => entry.name === name && !entry.namespace)?.aliases ?? [];

    it('attaches the exported aliases to their namespace in name order', () => {
        expect(aliasesOf('Api').map(alias => alias.name)).toEqual(['Origin', 'Point', 'distance']);
        expect(aliasesOf('Api').every(alias => alias.namespace === 'Api')).toBe(true);
    });

    it('resolves the target to its qualified name, through a local import alias', () => {
        const targets = Object.fromEntries(
            aliasesOf('Api').map(alias => [alias.name, alias.target])
        );
        expect(targets).toEqual({
            Origin: 'Geometry.Deep.ORIGIN',
            Point: 'Geometry.Point',
            distance: 'Geometry.distance'
        });
        const point = aliasesOf('Api').find(alias => alias.name === 'Point');
        expect(path.basename(point.targetFile)).toBe('geometry.ts');
        expect(point.rawdescription).toBe('The point of the API.');
    });

    it('skips a non-exported and a type-only alias', () => {
        const names = result.namespaceAliases.map(alias => alias.name);
        expect(names).not.toContain('Hidden');
        expect(names).not.toContain('OnlyType');
        expect(names).not.toContain('G');
    });

    it('records a top-level alias without a namespace', () => {
        const pt = result.namespaceAliases.find(alias => alias.name === 'Pt');
        expect(pt.namespace).toBeUndefined();
        expect(pt.target).toBe('Geometry.Point');
    });

    it('keeps an empty namespace in the engine data', () => {
        expect(result.namespaces.map(entry => entry.name)).toContain('Empty');
        expect(aliasesOf('Empty')).toEqual([]);
    });
});
