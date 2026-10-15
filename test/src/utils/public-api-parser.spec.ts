import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { parseApiMarkdownExports } from '../../../src/utils/api-markdown-parser.util';
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

/**
 * A folder name with glob syntax, like a Windows path with backslashes,
 * must not end up in the glob pattern: both readers search relative to it.
 */
describe('public API readers in a folder with glob syntax', () => {
    let root: string;

    beforeAll(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-public-api-')));
        root = path.join(root, 'lib (v2)');
        fs.cpSync(path.join(process.cwd(), 'test/fixtures/public-api-barrels'), root, {
            recursive: true
        });
    });

    afterAll(() => {
        fs.rmSync(path.dirname(root), { recursive: true, force: true });
    });

    it('finds the index.d.ts files', async () => {
        const found = await parsePublicApi(path.join(root, 'declarations/types'));
        expect(found.indexFiles.size).toBeGreaterThan(0);
        expect(found.symbolToFiles.has('pub')).toBe(true);
    });

    it('finds the *.api.md reports', async () => {
        const found = await parseApiMarkdownExports(path.join(root, 'api-report'));
        expect(found.apiMdFiles.size).toBe(1);
        expect(found.symbolToFiles.has('zed')).toBe(true);
    });
});
