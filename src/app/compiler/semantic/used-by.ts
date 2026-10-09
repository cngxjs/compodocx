import { ts } from 'ts-morph';

import {
    type Declaration,
    declarationIn,
    declarationsBySymbol,
    resolveAlias
} from './declarations';
import { compareKeys, type DeclarationSpace, factKey, type SymbolKey } from './model';

const isSpecifier = (node: ts.Node): boolean =>
    ts.isImportSpecifier(node) ||
    ts.isExportSpecifier(node) ||
    ts.isImportClause(node) ||
    ts.isNamespaceImport(node);

/**
 * Whether an identifier names a type (type reference, heritage clause of an
 * interface or an `implements` clause) or a value (everything else, `typeof X`
 * included). Picks the declaration of a const and a type of one name.
 */
const spaceOfUse = (identifier: ts.Identifier): DeclarationSpace => {
    let node: ts.Node = identifier;
    while (ts.isQualifiedName(node.parent) && node.parent.right === node) {
        node = node.parent;
    }
    const parent = node.parent;
    if (ts.isTypeReferenceNode(parent)) {
        return 'type';
    }
    if (ts.isExpressionWithTypeArguments(parent) && ts.isHeritageClause(parent.parent)) {
        const clause = parent.parent;
        const isInterface = ts.isInterfaceDeclaration(clause.parent);
        return isInterface || clause.token === ts.SyntaxKind.ImplementsKeyword ? 'type' : 'value';
    }
    return 'value';
};

/**
 * "Used by" edges between the top-level declarations of one run: a
 * declaration uses another when an identifier anywhere in it (signature,
 * body, initializer, heritage clause, decorator) resolves to the other.
 * Members roll up to their class; self edges are dropped.
 */
export const usedByEdges = (
    declarations: readonly Declaration[],
    checker: ts.TypeChecker
): ReadonlyMap<string, readonly SymbolKey[]> => {
    const bySymbol = declarationsBySymbol(declarations);
    const symbolOf = (identifier: ts.Identifier): ts.Symbol | undefined => {
        const parent = identifier.parent;
        const symbol =
            parent && ts.isShorthandPropertyAssignment(parent) && parent.name === identifier
                ? checker.getShorthandAssignmentValueSymbol(parent)
                : checker.getSymbolAtLocation(identifier);
        return resolveAlias(checker, symbol);
    };

    const isNamespaceAccess = (node: ts.PropertyAccessExpression): boolean => {
        if (!ts.isIdentifier(node.expression)) {
            return false;
        }
        const symbol = resolveAlias(checker, checker.getSymbolAtLocation(node.expression));
        return symbol !== undefined && (symbol.flags & ts.SymbolFlags.Module) !== 0;
    };

    const edges = new Map<string, Map<string, SymbolKey>>();
    for (const user of declarations) {
        const userKey = factKey(user.key);
        const walk = (node: ts.Node): void => {
            if (ts.isStringLiteralLike(node) || isSpecifier(node)) {
                return;
            }
            if (ts.isPropertyAccessExpression(node) && !isNamespaceAccess(node)) {
                // A member name never names a top-level declaration, and resolving
                // it needs the type of the object; only the object is walked.
                walk(node.expression);
                return;
            }
            if (ts.isIdentifier(node)) {
                const symbol = symbolOf(node);
                const target = symbol && declarationIn(bySymbol.get(symbol), spaceOfUse(node));
                const targetKey = target && factKey(target.key);
                if (target && targetKey !== userKey) {
                    const users = edges.get(targetKey as string) ?? new Map<string, SymbolKey>();
                    users.set(userKey, user.key);
                    edges.set(targetKey as string, users);
                }
                return;
            }
            ts.forEachChild(node, walk);
        };
        walk(user.node);
    }
    return new Map([...edges].map(([key, users]) => [key, [...users.values()].sort(compareKeys)]));
};
