import * as path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import {
    exportedNames,
    type PackageTypesExports,
    parsePackageTypesExports,
    typesEntries,
    typesTarget
} from '../../../src/utils/package-exports-parser.util';

const DIST = path.join(process.cwd(), 'test/fixtures/semantic-library/ng-packaged');

describe('typesTarget', () => {
    it('reads `types` of an entry and of nested conditions', () => {
        expect(typesTarget({ types: './a.d.ts', default: './a.mjs' })).toBe('./a.d.ts');
        expect(typesTarget({ import: { types: './b.d.ts', default: './b.mjs' } })).toBe('./b.d.ts');
    });

    it('finds nothing in a plain string or an entry without types', () => {
        expect(typesTarget('./a.mjs')).toBeUndefined();
        expect(typesTarget({ default: './package.json' })).toBeUndefined();
    });
});

describe('typesEntries', () => {
    it('maps each subpath with types to its import path, skipping wildcards', () => {
        const entries = typesEntries({
            name: '@lib/core',
            exports: {
                './package.json': { default: './package.json' },
                '.': { types: './types/lib-core.d.ts' },
                './sub': { types: './types/lib-core-sub.d.ts' },
                './theming/*.css': './theming/*.css'
            }
        });
        expect([...entries]).toEqual([
            ['@lib/core', './types/lib-core.d.ts'],
            ['@lib/core/sub', './types/lib-core-sub.d.ts']
        ]);
    });

    it('takes the top-level `typings` without an exports map', () => {
        expect([...typesEntries({ name: 'lib', typings: './index.d.ts' })]).toEqual([
            ['lib', './index.d.ts']
        ]);
    });

    it('reads nothing from a manifest without a name', () => {
        expect(typesEntries({ exports: { '.': { types: './a.d.ts' } } }).size).toBe(0);
    });
});

describe('exportedNames', () => {
    it('lists export lists, type-only exports, aliases and exported declarations', () => {
        const names = exportedNames(
            'x.d.ts',
            [
                'declare class A {}',
                'declare function b(): void;',
                'interface C {}',
                'export declare const D: number;',
                'export { A, b as renamed };',
                'export type { C };',
                "export * as ns from './ns';",
                "export * from './star';"
            ].join('\n')
        );
        expect([...names].sort()).toEqual(['A', 'C', 'D', 'ns', 'renamed']);
    });
});

describe('parsePackageTypesExports', () => {
    let parsed: PackageTypesExports;

    beforeAll(async () => {
        parsed = await parsePackageTypesExports(DIST);
    });

    it('reads the names of every entry point of every package', () => {
        expect(
            Object.fromEntries([...parsed.byImportPath].map(([k, v]) => [k, [...v].sort()]))
        ).toEqual({
            '@sem/core': ['FooFeature', 'formatFoo', 'normalizeLabel', 'provideFoo'],
            '@sem/core/tokens': ['FOO_CONFIG', 'FooConfig'],
            '@sem/ui': ['SemButton'],
            '@sem/ui/legacy': ['SemLegacy']
        });
        expect(parsed.typesFiles).toBe(4);
    });

    it('reads nothing from a missing folder', async () => {
        const missing = await parsePackageTypesExports(path.join(DIST, 'missing'));
        expect(missing.byImportPath.size).toBe(0);
    });
});
