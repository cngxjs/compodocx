import { describe, expect, it } from 'vitest';

import { findRemovedTags, formatRemovedTagNotice } from '../../../../src/app/compiler/removed-tags';

const SOURCE = `/**
 * A toast.
 *
 * @category ui/feedback
 * @docsKind primary
 */
export class Toast {}

// @category in a line comment is not a JSDoc tag
const text = '@category in a string';

/** @docsKind primary */
export const provideToast = () => [];
`;

describe('removed JSDoc tags', () => {
    it('finds @category and @docsKind inside JSDoc blocks with their lines', () => {
        expect(findRemovedTags('src/toast.ts', SOURCE)).toEqual([
            { file: 'src/toast.ts', line: 4, tag: 'category' },
            { file: 'src/toast.ts', line: 5, tag: 'docsKind' },
            { file: 'src/toast.ts', line: 12, tag: 'docsKind' }
        ]);
    });

    it('formats one notice with a count and every location', () => {
        const notice = formatRemovedTagNotice(findRemovedTags('src/toast.ts', SOURCE));
        expect(notice).toEqual([
            '3 @category / @docsKind tags are ignored; run `compodocx migrate jsdoc <dir>` to remove them',
            '  src/toast.ts:4 @category',
            '  src/toast.ts:5 @docsKind',
            '  src/toast.ts:12 @docsKind'
        ]);
        expect(formatRemovedTagNotice([])).toEqual([]);
    });
});
