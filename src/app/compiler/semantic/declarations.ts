import * as path from 'node:path';

import { ts } from 'ts-morph';

import type { DeclarationSpace, SymbolKey } from './model';

/** A named top-level declaration of a root file, or a member of a top-level namespace. */
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
    /**
     * Symbol of the outermost namespace of a namespace member (key name
     * `Ns.Member`): barrels export the namespace, the member shares its facts.
     */
    readonly exportSymbol?: ts.Symbol;
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

/** The namespaces around a member: dotted prefix, outermost symbol, visibility. */
interface NamespaceScope {
    readonly prefix: string;
    readonly root: ts.Symbol | undefined;
    /** Whether the namespace chain is exported from its file. */
    readonly exported: boolean;
    /** `declare namespace`: members are exported without the keyword. */
    readonly ambient: boolean;
}

const qualified = (scope: NamespaceScope | undefined, name: string): string =>
    scope ? `${scope.prefix}.${name}` : name;

const isExported = (statement: ts.Statement, scope: NamespaceScope | undefined): boolean =>
    scope
        ? scope.exported && (scope.ambient || hasExportKeyword(statement))
        : hasExportKeyword(statement);

/**
 * A namespace (`namespace A.B {}` opens one per segment) and its members.
 * Module augmentations (`declare module 'x'`, `declare global`) are skipped.
 */
const fromNamespace = (
    statement: ts.ModuleDeclaration,
    file: string,
    checker: ts.TypeChecker,
    scope: NamespaceScope | undefined
): readonly Declaration[] => {
    if (!ts.isIdentifier(statement.name) || statement.flags & ts.NodeFlags.GlobalAugmentation) {
        return [];
    }
    const declarations: Declaration[] = [];
    const exported = isExported(statement, scope);
    let current: ts.ModuleDeclaration = statement;
    let inner: NamespaceScope = {
        prefix: qualified(scope, statement.name.text),
        root: scope?.root ?? checker.getSymbolAtLocation(statement.name),
        exported,
        ambient:
            (scope?.ambient ?? false) ||
            (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Ambient) !== 0
    };
    for (;;) {
        declarations.push({
            key: { name: inner.prefix, file },
            node: current,
            symbol: checker.getSymbolAtLocation(current.name),
            exported,
            // Every segment but a top-level namespace itself shares the root's facts.
            ...((scope || current !== statement) && { exportSymbol: inner.root })
        });
        if (!current.body || !ts.isModuleDeclaration(current.body)) {
            break;
        }
        current = current.body;
        inner = { ...inner, prefix: `${inner.prefix}.${current.name.text}` };
    }
    const body = current.body && ts.isModuleBlock(current.body) ? current.body : undefined;
    // A member the namespace does not export is not part of any API.
    for (const member of body?.statements ?? []) {
        declarations.push(...fromStatement(member, file, checker, inner).filter(d => d.exported));
    }
    return declarations;
};

const fromStatement = (
    statement: ts.Statement,
    file: string,
    checker: ts.TypeChecker,
    scope?: NamespaceScope
): readonly Declaration[] => {
    if (ts.isModuleDeclaration(statement)) {
        return fromNamespace(statement, file, checker, scope);
    }
    const inScope = (declaration: Declaration): Declaration =>
        scope
            ? {
                  ...declaration,
                  key: { ...declaration.key, name: qualified(scope, declaration.key.name) },
                  exportSymbol: scope.root
              }
            : declaration;
    if (ts.isVariableStatement(statement)) {
        const exported = isExported(statement, scope);
        return statement.declarationList.declarations
            .map(declaration => fromVariable(declaration, file, exported, checker))
            .filter((d): d is Declaration => d !== undefined)
            .map(inScope);
    }
    if (!isNamedStatement(statement) || !statement.name) {
        return [];
    }
    // Overload signatures: the implementation carries the body.
    if (ts.isFunctionDeclaration(statement) && !statement.body) {
        return [];
    }
    const isType = ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);
    return [
        inScope({
            key: isType
                ? { name: statement.name.text, file, space: 'type' }
                : { name: statement.name.text, file },
            node: statement,
            symbol: checker.getSymbolAtLocation(statement.name),
            exported: isExported(statement, scope),
            fn: ts.isFunctionDeclaration(statement) ? statement : undefined,
            cls: ts.isClassDeclaration(statement) ? statement : undefined
        })
    ];
};

/**
 * Every named top-level declaration of the given source files, in file order,
 * with namespaces and their members (`Ns.Member`) right after the namespace.
 */
export const collectDeclarations = (
    sourceFiles: readonly ts.SourceFile[],
    checker: ts.TypeChecker,
    cwd: string
): readonly Declaration[] =>
    sourceFiles.flatMap(sourceFile => {
        const file = relativeFile(cwd, sourceFile.fileName);
        return sourceFile.statements.flatMap(statement => fromStatement(statement, file, checker));
    });

const spaceOf = (declaration: Declaration): DeclarationSpace => declaration.key.space ?? 'value';

/**
 * Declarations by their merged symbol. A const and a type of one name share
 * a symbol; each keeps its own slot, the first declaration per space wins.
 */
export type DeclarationsBySymbol = ReadonlyMap<
    ts.Symbol,
    Partial<Record<DeclarationSpace, Declaration>>
>;

export const declarationsBySymbol = (
    declarations: readonly Declaration[]
): DeclarationsBySymbol => {
    const bySymbol = new Map<ts.Symbol, Partial<Record<DeclarationSpace, Declaration>>>();
    for (const declaration of declarations) {
        if (!declaration.symbol) {
            continue;
        }
        const slots = bySymbol.get(declaration.symbol) ?? {};
        const space = spaceOf(declaration);
        if (!slots[space]) {
            slots[space] = declaration;
        }
        bySymbol.set(declaration.symbol, slots);
    }
    return bySymbol;
};

/** The declaration of `space`, or the other one when the symbol has only one. */
export const declarationIn = (
    slots: Partial<Record<DeclarationSpace, Declaration>> | undefined,
    space: DeclarationSpace
): Declaration | undefined => slots?.[space] ?? slots?.[space === 'type' ? 'value' : 'type'];

/** Follow an import/export alias to the declared symbol. */
export const resolveAlias = (
    checker: ts.TypeChecker,
    symbol: ts.Symbol | undefined
): ts.Symbol | undefined =>
    symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
