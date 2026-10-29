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

    it('reads the name and description of a single-line slot without a hyphen', () => {
        const tags = tagsOf(`/**
 * @slot header the header
 */
export class Panel {}`);
        expect(classTags(tags).slots).toEqual([{ name: 'header', description: 'the header' }]);
    });

    it('keeps the following lines in the description of a multi-line slot', () => {
        const tags = tagsOf(`/**
 * @slot body - first line
 * continues here
 */
export class Panel {}`);
        expect(classTags(tags).slots).toEqual([
            { name: 'body', description: 'first line\ncontinues here' }
        ]);
        expect(memberTags(tags).slots).toEqual(classTags(tags).slots);
    });

    it('leaves <example-url> lines after the last slot out of its description', () => {
        const tags = tagsOf(`/**
 * @slot label - the button label
 * @slot icon - a leading icon
 *
 * <example-url>/#/buttons/action</example-url>
 * <example-url>/#/buttons/icon</example-url>
 */
export class ActionButton {}`);
        expect(classTags(tags).slots).toEqual([
            { name: 'label', description: 'the button label' },
            { name: 'icon', description: 'a leading icon' }
        ]);
        expect(memberTags(tags).slots).toEqual(classTags(tags).slots);
    });

    it('keeps a slot name alone when only <example-url> lines follow it', () => {
        const tags = tagsOf(`/**
 * @slot footer
 * <example-url>/#/cards</example-url>
 */
export class Card {}`);
        expect(classTags(tags).slots).toEqual([{ name: 'footer', description: '' }]);
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
