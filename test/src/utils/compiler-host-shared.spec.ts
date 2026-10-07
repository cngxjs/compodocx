import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';

import { compilerHost } from '../../../src/utils/utils';

const OPTIONS = { target: ts.ScriptTarget.ES5, tsconfigDirectory: '/proj' };

describe('compilerHost shared source files', () => {
    it('returns the shared source file instead of reading the file', () => {
        const shared = ts.createSourceFile(
            '/proj/missing.ts',
            'export const a = 1;',
            ts.ScriptTarget.ES2022,
            true
        );
        const host = compilerHost(OPTIONS, fileName =>
            fileName === shared.fileName ? shared : undefined
        );
        expect(host.getSourceFile('/proj/missing.ts', ts.ScriptTarget.ES5)).toBe(shared);
    });

    it('falls back to reading the file when no shared file exists', () => {
        const host = compilerHost(OPTIONS, () => undefined);
        expect(host.getSourceFile('/proj/missing.ts', ts.ScriptTarget.ES5)).toBeUndefined();
    });
});
