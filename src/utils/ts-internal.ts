import * as ts from 'typescript';

const tsany = ts as any;

// https://github.com/Microsoft/TypeScript/blob/v2.1.4/src/compiler/utilities.ts#L1423
export function getJSDocCommentRanges(node: ts.Node, text: string) {
    return tsany.getJSDocCommentRanges(node, text);
}
