import { ts } from 'ts-morph';

import { unwrapExpression } from '../compiler/semantic/declarations';

export const ROUTER_MODULE = '@angular/router';

/** What the local names of a file stand for in one module. */
interface ModuleImports {
    /** Local name -> exported name (`import { Routes as AppRoutes }`). */
    readonly named: ReadonlyMap<string, string>;
    /** Local names of `import * as x from '<module>'`. */
    readonly namespaces: ReadonlySet<string>;
}

const importsCache = new WeakMap<ts.SourceFile, Map<string, ModuleImports>>();

const readImports = (sourceFile: ts.SourceFile, module: string): ModuleImports => {
    const named = new Map<string, string>();
    const namespaces = new Set<string>();
    for (const statement of sourceFile.statements) {
        if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            statement.moduleSpecifier.text !== module
        ) {
            continue;
        }
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
            namespaces.add(bindings.name.text);
        }
        if (bindings && ts.isNamedImports(bindings)) {
            for (const element of bindings.elements) {
                named.set(element.name.text, (element.propertyName ?? element.name).text);
            }
        }
    }
    return { named, namespaces };
};

const moduleImports = (sourceFile: ts.SourceFile, module: string): ModuleImports => {
    const byModule = importsCache.get(sourceFile) ?? new Map<string, ModuleImports>();
    importsCache.set(sourceFile, byModule);
    const cached = byModule.get(module);
    if (cached) {
        return cached;
    }
    const imports = readImports(sourceFile, module);
    byModule.set(module, imports);
    return imports;
};

/**
 * The export of `module` an identifier or `ns.name` refers to, read from the
 * imports of its own file (aliases and namespace imports followed).
 */
export const importedName = (
    name: ts.EntityName | ts.Expression,
    module: string
): string | undefined => {
    const imports = moduleImports(name.getSourceFile(), module);
    if (ts.isIdentifier(name)) {
        return imports.named.get(name.text);
    }
    const left = ts.isQualifiedName(name)
        ? name.left
        : ts.isPropertyAccessExpression(name)
          ? name.expression
          : undefined;
    const right = ts.isQualifiedName(name)
        ? name.right
        : ts.isPropertyAccessExpression(name)
          ? name.name
          : undefined;
    return left && right && ts.isIdentifier(left) && imports.namespaces.has(left.text)
        ? right.text
        : undefined;
};

/** The `@angular/router` export a type name refers to, if it is one. */
const routerTypeName = (name: ts.EntityName): string | undefined =>
    importedName(name, ROUTER_MODULE);

const isRouteType = (type: ts.TypeNode): boolean =>
    ts.isTypeReferenceNode(type) &&
    type.typeArguments === undefined &&
    routerTypeName(type.typeName) === 'Route';

/**
 * `Routes`, `Route[]`, `readonly Route[]` or `Array<Route>`, where `Routes` /
 * `Route` are imported from `@angular/router` in the same file (aliases and
 * namespace imports followed). No variable name is read.
 */
export const isRouteArrayType = (type: ts.TypeNode): boolean => {
    if (ts.isParenthesizedTypeNode(type)) {
        return isRouteArrayType(type.type);
    }
    if (ts.isTypeOperatorNode(type) && type.operator === ts.SyntaxKind.ReadonlyKeyword) {
        return isRouteArrayType(type.type);
    }
    if (ts.isArrayTypeNode(type)) {
        return isRouteType(type.elementType);
    }
    if (!ts.isTypeReferenceNode(type)) {
        return false;
    }
    const name = routerTypeName(type.typeName);
    if (name === 'Routes') {
        return type.typeArguments === undefined;
    }
    const isArray = ts.isIdentifier(type.typeName) && type.typeName.text === 'Array';
    return isArray && type.typeArguments?.length === 1 && isRouteType(type.typeArguments[0]);
};

/** `x satisfies T` / `x as T` chains: true when one of the types is a route array type. */
const assertsRouteArray = (expression: ts.Expression): boolean => {
    let current: ts.Expression = expression;
    while (true) {
        if (ts.isSatisfiesExpression(current) || ts.isAsExpression(current)) {
            if (isRouteArrayType(current.type)) {
                return true;
            }
            current = current.expression;
        } else if (ts.isParenthesizedExpression(current)) {
            current = current.expression;
        } else {
            return false;
        }
    }
};

/** A route array declared in a file: a typed variable or a typed `export default`. */
export interface RouteArrayDeclaration {
    /** The variable declaration or the `export default` assignment. */
    readonly node: ts.VariableDeclaration | ts.ExportAssignment;
    /** Variable name, `default` for an `export default`. */
    readonly name: string;
    readonly exported: boolean;
    /** The array expression, unwrapped from `as` / `satisfies` / parentheses. */
    readonly initializer: ts.Expression;
}

const isExported = (statement: ts.VariableStatement): boolean =>
    statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;

/** The route array a variable declaration holds, recognised by its type. */
export const routeArrayOfVariable = (
    declaration: ts.VariableDeclaration
): ts.Expression | undefined => {
    const { initializer, type } = declaration;
    if (!initializer) {
        return undefined;
    }
    const typed = (type && isRouteArrayType(type)) || assertsRouteArray(initializer);
    return typed ? unwrapExpression(initializer) : undefined;
};

/** Every top-level route array of a file, in source order. */
export const routeArrayDeclarations = (
    sourceFile: ts.SourceFile
): readonly RouteArrayDeclaration[] =>
    sourceFile.statements.flatMap((statement): RouteArrayDeclaration[] => {
        if (ts.isVariableStatement(statement)) {
            return statement.declarationList.declarations.flatMap(declaration => {
                const initializer = routeArrayOfVariable(declaration);
                return initializer && ts.isIdentifier(declaration.name)
                    ? [
                          {
                              node: declaration,
                              name: declaration.name.text,
                              exported: isExported(statement),
                              initializer
                          }
                      ]
                    : [];
            });
        }
        if (
            ts.isExportAssignment(statement) &&
            !statement.isExportEquals &&
            assertsRouteArray(statement.expression)
        ) {
            return [
                {
                    node: statement,
                    name: 'default',
                    exported: true,
                    initializer: unwrapExpression(statement.expression)
                }
            ];
        }
        return [];
    });
