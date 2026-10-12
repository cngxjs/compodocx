import { ts } from 'ts-morph';
import type { ClassHelper } from '../angular/deps/helpers/class-helper';

export class IoExtractor {
    constructor(private readonly classHelper: ClassHelper) {}

    public getClassIO(
        filename: string,
        sourceFile: ts.SourceFile,
        node: ts.Node,
        fileBody,
        astFile
    ) {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const reducedSource = fileBody ? fileBody.statements : sourceFile.statements;
        const res = reducedSource.reduce((directive, statement) => {
            if (ts.isClassDeclaration(statement)) {
                if (statement.pos === node.pos && statement.end === node.end) {
                    return directive.concat(
                        this.classHelper.visitClassDeclaration(
                            filename,
                            statement,
                            sourceFile,
                            astFile
                        )
                    );
                }
            }

            return directive;
        }, []);

        return res[0] || {};
    }

    public getInterfaceIO(filename: string, sourceFile, node, fileBody, astFile) {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const reducedSource = fileBody ? fileBody.statements : sourceFile.statements;
        const res = reducedSource.reduce((directive, statement) => {
            if (ts.isInterfaceDeclaration(statement)) {
                if (statement.pos === node.pos && statement.end === node.end) {
                    return directive.concat(
                        this.classHelper.visitClassDeclaration(
                            filename,
                            statement,
                            sourceFile,
                            astFile
                        )
                    );
                }
            }

            return directive;
        }, []);

        return res[0] || {};
    }

    /**
     * Check if a variable statement is exported
     */
    public isExportedVariable(node: any): boolean {
        // Check if the node has export modifiers
        return !!node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);
    }
}
