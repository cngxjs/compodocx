import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { JsdocParserUtil } from '../../../src/utils/jsdoc-parser.util';

/** `getJSDocs` keeps its own cache, apart from the one TypeScript keeps on the node. */
describe('JsdocParserUtil.getJSDocs cache', () => {
    const functionOf = (): ts.FunctionDeclaration => {
        const source = ts.createSourceFile(
            'a.ts',
            '/**\n * Adds.\n * @param a first\n */\nfunction add(a: number) {}\n',
            ts.ScriptTarget.Latest,
            true
        );
        return source.statements[0] as ts.FunctionDeclaration;
    };

    it('returns the JSDoc comment after TypeScript cached the tags of the node', () => {
        const node = functionOf();
        const tags = ts.getJSDocTags(node);
        const docs = new JsdocParserUtil().getJSDocs(node);
        expect(docs.some(doc => doc.kind === ts.SyntaxKind.JSDoc)).toBe(true);
        expect(ts.getJSDocTags(node)).toEqual(tags);
    });

    it('leaves the tags TypeScript returns unchanged', () => {
        const node = functionOf();
        new JsdocParserUtil().getJSDocs(node);
        expect(ts.getJSDocTags(node).map(tag => tag.kind)).toEqual([
            ts.SyntaxKind.JSDocParameterTag
        ]);
    });

    it('returns the same list on a second call', () => {
        const node = functionOf();
        const util = new JsdocParserUtil();
        expect(util.getJSDocs(node)).toBe(util.getJSDocs(node));
    });
});
