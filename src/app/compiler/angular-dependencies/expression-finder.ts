import { ts } from 'ts-morph';
import ImportsUtil from '../../../utils/imports.util';
import { logger } from '../../../utils/logger';

export class ExpressionFinder {
    public getSymboleName(node): string {
        return node.name.text;
    }

    public findProperties(
        visitedNode: ts.Decorator,
        sourceFile: ts.SourceFile
    ): ReadonlyArray<ts.ObjectLiteralElementLike> {
        if (
            visitedNode.expression &&
            (visitedNode.expression as any).arguments &&
            (visitedNode.expression as any).arguments.length > 0
        ) {
            const pop = (visitedNode.expression as any).arguments[0];

            if (pop?.properties && pop.properties.length >= 0) {
                return pop.properties;
            } else if (pop?.kind && pop.kind === ts.SyntaxKind.StringLiteral) {
                return [pop];
            } else {
                logger.warn('Empty metadatas, trying to find it with imports.');
                return ImportsUtil.findValueInImportOrLocalVariables(pop.text, sourceFile) as any;
            }
        }

        return [];
    }
}
