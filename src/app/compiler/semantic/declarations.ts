import * as path from 'node:path';

import { ts } from 'ts-morph';

import type { SymbolKey } from './model';

/** A named top-level declaration of a root file. */
export interface Declaration {
    readonly key: SymbolKey;
    readonly node: ts.Node;
    /** Merged symbol of the declaration (one per name and file). */
    readonly symbol: ts.Symbol | undefined;
    readonly exported: boolean;
    /** Function body owner: a function declaration or the arrow/function expression of a const. */
    readonly fn?: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression;
    readonly cls?: ts.ClassDeclaration;
    /** Initializer of a variable declaration, unwrapped from `as`/`satisfies`/parentheses. */
    readonly initializer?: ts.Expression;
}

/** Relative to `cwd`, forward slashes. */
export const relativeFile = (cwd: string, fileName: string): string =>
    path.relative(cwd, fileName).split(path.sep).join('/');

export const unwrapExpression = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current) ||
        ts.isParenthesizedExpression(current) ||
        ts.isNonNullExpression(current)
    ) {
        current = current.expression;
    }
    return current;
};

const hasExportKeyword = (node: ts.Node): boolean =>
    (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0;

const fromVariable = (
    declaration: ts.VariableDeclaration,
    file: string,
    exported: boolean,
    checker: ts.TypeChecker
): Declaration | undefined => {
    if (!ts.isIdentifier(declaration.name)) {
        return undefined;
    }
    const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
    const fn =
        initializer && (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
            ? initializer
            : undefined;
    return {
        key: { name: declaration.name.text, file },
        node: declaration,
        symbol: checker.getSymbolAtLocation(declaration.name),
        exported,
        fn,
        initializer
    };
};

type NamedStatement =
    | ts.FunctionDeclaration
    | ts.ClassDeclaration
    | ts.InterfaceDeclaration
    | ts.TypeAliasDeclaration
    | ts.EnumDeclaration;

const isNamedStatement = (statement: ts.Statement): statement is NamedStatement =>
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement);

const fromStatement = (
    statement: ts.Statement,
    file: string,
    checker: ts.TypeChecker
): readonly Declaration[] => {
    if (ts.isVariableStatement(statement)) {
        const exported = hasExportKeyword(statement);
        return statement.declarationList.declarations
            .map(declaration => fromVariable(declaration, file, exported, checker))
            .filter((d): d is Declaration => d !== undefined);
    }
    if (!isNamedStatement(statement) || !statement.name) {
        return [];
    }
    // Overload signatures: the implementation carries the body.
    if (ts.isFunctionDeclaration(statement) && !statement.body) {
        return [];
    }
    return [
        {
            key: { name: statement.name.text, file },
            node: statement,
            symbol: checker.getSymbolAtLocation(statement.name),
            exported: hasExportKeyword(statement),
            fn: ts.isFunctionDeclaration(statement) ? statement : undefined,
            cls: ts.isClassDeclaration(statement) ? statement : undefined
        }
    ];
};

/** Every named top-level declaration of the given source files, in file order. */
export const collectDeclarations = (
    sourceFiles: readonly ts.SourceFile[],
    checker: ts.TypeChecker,
    cwd: string
): readonly Declaration[] =>
    sourceFiles.flatMap(sourceFile => {
        const file = relativeFile(cwd, sourceFile.fileName);
        return sourceFile.statements.flatMap(statement => fromStatement(statement, file, checker));
    });

/** Follow an import/export alias to the declared symbol. */
export const resolveAlias = (
    checker: ts.TypeChecker,
    symbol: ts.Symbol | undefined
): ts.Symbol | undefined =>
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
