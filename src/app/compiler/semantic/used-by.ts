import { ts } from 'ts-morph';

import { type Declaration, resolveAlias } from './declarations';
import { compareKeys, factKey, type SymbolKey } from './model';

const isSpecifier = (node: ts.Node): boolean =>
    ts.isImportSpecifier(node) ||
    ts.isExportSpecifier(node) ||
    ts.isImportClause(node) ||
    ts.isNamespaceImport(node);

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
    const bySymbol = new Map<ts.Symbol, Declaration>();
    for (const declaration of declarations) {
        if (declaration.symbol && !bySymbol.has(declaration.symbol)) {
            bySymbol.set(declaration.symbol, declaration);
        }
    }
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
                const target = symbol && bySymbol.get(symbol);
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
