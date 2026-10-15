import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { JsdocParserUtil } from '../../../src/utils/jsdoc-parser.util';

/**
 * `parseJSDocNode` turns a tag comment into text. An inline link keeps the
 * form it was written in (label, pipe, URL, `{@linkcode}`), so the one
 * render-time resolver sees what the author wrote.
 */
const util = new JsdocParserUtil();

const tagComment = (comment: string): string => {
    const source = `/**\n * @since ${comment}\n */\nexport function f() {}`;
    const sf = ts.createSourceFile('t.ts', source, ts.ScriptTarget.Latest, true);
    const [tag] = ts.getJSDocTags(sf.statements[0]);
    return util.parseJSDocNode(tag);
};

describe('JsdocParserUtil.parseJSDocNode - inline links', () => {
    it.each([
        ['bare', 'the {@link Foo} value'],
        ['pipe label', 'the {@link Foo|the foo} value'],
        ['space label', 'the {@link Foo the foo} value'],
        ['bracket label', 'the [the foo]{@link Foo} value'],
        ['URL with pipe label', 'see {@link https://angular.dev|Angular}'],
        ['URL with space label', 'see {@link https://angular.dev Angular}'],
        ['member with hash', 'the {@link Foo#bar} member'],
        ['member with dot', 'the {@link Foo.bar} member'],
        ['linkcode', 'the {@linkcode Foo} code'],
        ['linkplain with label', 'the {@linkplain Foo|foo} text']
    ])('keeps a %s link as written', (_, comment) => {
        expect(tagComment(comment)).toBe(comment);
    });

    it('joins a link spread over two comment lines with a space', () => {
        expect(tagComment('the {@link Foo|the\n *   foo} value')).toBe(
            'the {@link Foo|the foo} value'
        );
    });

    it('rebuilds a link from its parts without a source file', () => {
        const source =
            '/**\n * @since {@link Foo|the foo} and {@link https://angular.dev}\n */\nexport function f() {}';
        const sf = ts.createSourceFile('t.ts', source, ts.ScriptTarget.Latest, true);
        const [tag] = ts.getJSDocTags(sf.statements[0]) as unknown as { comment: any[] }[];
        const detached = {
            comment: tag.comment.map((n: any) => ({
                kind: n.kind,
                text: n.text,
                name: n.name
            }))
        };
        expect(util.parseJSDocNode(detached)).toBe(
            '{@link Foo|the foo} and {@link https://angular.dev}'
        );
    });
});
