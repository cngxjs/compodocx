import * as path from 'node:path';

import fg from 'fast-glob';
import type { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';

import {
    createSemanticProgram,
    recordEntryExports,
    resolvePublicApi
} from '../../../../../src/app/compiler/semantic';
import type { EntryPoint } from '../../../../../src/app/compiler/semantic/model';

const FIXTURE = path.join(process.cwd(), 'test/fixtures/public-api-barrels/declarations');
const TSCONFIG = path.join(FIXTURE, 'tsconfig.json');
const src = (file: string): string => path.join(FIXTURE, 'src', file);

let program: ts.Program;

const resolve = (entries: [string, string][]): Map<string, Set<string>> =>
    resolvePublicApi(program, new Map(entries.map(([name, file]) => [name, new Set([file])])));

beforeAll(() => {
    const files = fg.sync('src/**/*.ts', { cwd: FIXTURE, absolute: true }).sort();
    const created = createSemanticProgram(TSCONFIG, files);
    if (created.ok === false) {
        throw new Error(created.message);
    }
    program = created.value;
});

describe('resolvePublicApi', () => {
    it('follows a named re-export to the declaring file', () => {
        const resolved = resolve([['zed', src('index.ts')]]);
        expect(resolved.get('zed')).toEqual(new Set([src('index.ts'), src('z.ts')]));
    });

    it('follows `export *`', () => {
        const resolved = resolve([['starFn', src('index.ts')]]);
        expect(resolved.get('starFn')?.has(src('b.ts'))).toBe(true);
    });

    it('records an alias under the declared name', () => {
        const resolved = resolve([['renamed', src('index.ts')]]);
        expect(resolved.get('orig')).toEqual(new Set([src('c.ts')]));
        expect(resolved.get('renamed')).toEqual(new Set([src('index.ts')]));
    });

    it('follows nested barrels', () => {
        const resolved = resolve([
            ['deep', src('index.ts')],
            ['DeepType', src('lib/public-api.ts')]
        ]);
        expect(resolved.get('deep')?.has(src('lib/deep.ts'))).toBe(true);
        expect(resolved.get('DeepType')?.has(src('lib/deep.ts'))).toBe(true);
    });

    it('follows a name imported by the barrel and exported from there', () => {
        const resolved = resolve([['localFn', src('index.ts')]]);
        expect(resolved.get('localFn')?.has(src('local.ts'))).toBe(true);
    });

    it('keeps the declaring file of a direct export', () => {
        const resolved = resolve([['pub', src('a.ts')]]);
        expect(resolved.get('pub')).toEqual(new Set([src('a.ts')]));
    });

    it('keeps pairs it cannot follow and adds nothing for them', () => {
        const resolved = resolve([
            ['hiddenFn', src('index.ts')],
            ['ghost', path.join(FIXTURE, 'missing.ts')]
        ]);
        expect([...resolved.keys()].sort()).toEqual(['ghost', 'hiddenFn']);
        expect(resolved.get('hiddenFn')).toEqual(new Set([src('index.ts')]));
    });
});

describe('recordEntryExports', () => {
    const entry = (importPath: string, file: string): EntryPoint => ({
        importPath,
        file,
        root: path.dirname(file),
        source: 'ng-package'
    });

    it('records each name against the entry file of its import path', () => {
        const { recorded, unmatched } = recordEntryExports(
            new Map([
                ['@lib/core', new Set(['a', 'b'])],
                ['@lib/core/sub', new Set(['b'])]
            ]),
            [entry('@lib/core', 'core/src/public-api.ts'), entry('@lib/core/sub', 'sub/index.ts')]
        );
        expect(recorded.get('a')).toEqual(new Set([path.resolve('core/src/public-api.ts')]));
        expect(recorded.get('b')).toEqual(
            new Set([path.resolve('core/src/public-api.ts'), path.resolve('sub/index.ts')])
        );
        expect(unmatched).toEqual([]);
    });

    it('lists import paths without a source entry point', () => {
        const { recorded, unmatched } = recordEntryExports(
            new Map([
                ['@lib/z', new Set(['z'])],
                ['@lib/a', new Set(['a'])]
            ]),
            []
        );
        expect(recorded.size).toBe(0);
        expect(unmatched).toEqual(['@lib/a', '@lib/z']);
    });
});
