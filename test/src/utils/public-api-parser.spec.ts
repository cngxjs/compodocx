import * as path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { type PublicApiExports, parsePublicApi } from '../../../src/utils/public-api-parser.util';

const TYPES = path.join(process.cwd(), 'test/fixtures/public-api-barrels/declarations/types');
const types = (file: string): string => path.join(TYPES, file);

let parsed: PublicApiExports;

beforeAll(async () => {
    parsed = await parsePublicApi(TYPES);
});

describe('parsePublicApi', () => {
    it('follows `export *` of a folder to its index.d.ts', () => {
        expect(parsed.symbolToFiles.get('nestedFn')).toEqual(new Set([types('nested/inner.d.ts')]));
    });

    it('reads the declaration file of a `.js` specifier', () => {
        expect(parsed.symbolToFiles.get('esmFn')).toEqual(new Set([types('esm.d.ts')]));
    });

    it('records a named re-export against its target and its barrel', () => {
        expect(parsed.symbolToFiles.get('zed')).toEqual(
            new Set([types('z.d.ts'), types('index.d.ts')])
        );
    });

    it('records an alias against the barrel, where the resolver can follow it', () => {
        expect(parsed.symbolToFiles.get('renamed')?.has(types('index.d.ts'))).toBe(true);
        expect(parsed.symbolToFiles.has('orig')).toBe(false);
    });

    it('records nothing for a symbol no barrel re-exports', () => {
        expect(parsed.symbolToFiles.has('hiddenFn')).toBe(false);
    });
});
