import { describe, expect, it } from 'vitest';
import { fileListChange, isUnchanged } from '../../../../src/app/run/file-list-change';

describe('fileListChange', () => {
    it('lists the added and the removed files', () => {
        const change = fileListChange(['/p/a.ts', '/p/b.ts'], ['/p/b.ts', '/p/c.ts']);

        expect(change).toEqual({ added: ['/p/c.ts'], removed: ['/p/a.ts'] });
        expect(isUnchanged(change)).toBe(false);
    });

    it('is unchanged for the same files in another order', () => {
        expect(isUnchanged(fileListChange(['/p/a.ts', '/p/b.ts'], ['/p/b.ts', '/p/a.ts']))).toBe(
            true
        );
    });
});
