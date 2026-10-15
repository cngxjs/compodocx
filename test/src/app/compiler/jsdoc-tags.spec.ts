import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { JsdocExtractor } from '../../../../src/app/compiler/angular/deps/helpers/class-helper/jsdoc-extractor';
import { JsdocTags } from '../../../../src/app/compiler/angular-dependencies/jsdoc-tags';
import { JsdocParserUtil } from '../../../../src/utils/jsdoc-parser.util';

/**
 * One custom-tag parser: class-level tags (`JsdocTags`) and member tags
 * (`JsdocExtractor`) share the same code, so both entry points give the
 * same result for the same tags.
 */
const tagsOf = (source: string): any[] => {
    const sf = ts.createSourceFile('t.ts', source, ts.ScriptTarget.Latest, true);
    const decl = sf.statements[0];
    return [...ts.getJSDocTags(decl)];
};

const classTags = (tags: any[]) => {
    const result: Record<string, any> = {};
    new JsdocTags(new JsdocParserUtil()).checkForDeprecation(tags, result);
    return result;
};

const memberTags = (tags: any[]) => {
    const result: Record<string, any> = {};
    new JsdocExtractor().checkForDeprecation(tags, result);
    return result;
};

describe('JsdocTags - one custom-tag parser', () => {
    const duplicateSlots = tagsOf(`/**
 * @slot header - the first header
 * @slot header - the second header
 * @slot footer
 */
export class Card {}`);

    it('keeps the first of two slots with the same name on a class', () => {
        expect(classTags(duplicateSlots).slots).toEqual([
            { name: 'header', description: 'the first header' },
            { name: 'footer', description: '' }
        ]);
    });

    it('gives the same slots through the member entry point', () => {
        expect(memberTags(duplicateSlots).slots).toEqual(classTags(duplicateSlots).slots);
    });

    it('keeps the whole comment as the slot name when the pattern does not match', () => {
        const tags = tagsOf(`/**
 * @slot body - first line
 * continues here
 */
export class Panel {}`);
        expect(classTags(tags).slots).toEqual([
            { name: 'body - first line\ncontinues here', description: '' }
        ]);
        expect(memberTags(tags).slots).toEqual(classTags(tags).slots);
    });

    it('reads deprecation and single-line tags the same way on both entry points', () => {
        const tags = tagsOf(`/**
 * @deprecated use Other
 * @since 1.2
 * @group layout
 * @beta
 */
export class Old {}`);
        const result = classTags(tags);
        expect(result).toMatchObject({
            deprecated: true,
            deprecationMessage: 'use Other',
            since: '1.2',
            group: 'layout',
            beta: true
        });
        expect(memberTags(tags)).toEqual(result);
    });
});
