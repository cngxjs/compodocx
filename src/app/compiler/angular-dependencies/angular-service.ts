import { ts } from 'ts-morph';

/** Package and export name of Angular's `Service` decorator. */
const ANGULAR_CORE = '@angular/core';
const SERVICE = 'Service';

interface ServiceBindings {
    /** Local names of `import { Service } from '@angular/core'` (aliases included). */
    readonly names: ReadonlySet<string>;
    /** Local names of `import * as core from '@angular/core'`. */
    readonly namespaces: ReadonlySet<string>;
}

const bindingsCache = new WeakMap<ts.SourceFile, ServiceBindings>();

const isAngularCoreImport = (statement: ts.Statement): statement is ts.ImportDeclaration =>
    ts.isImportDeclaration(statement) &&
    ts.isStringLiteral(statement.moduleSpecifier) &&
    statement.moduleSpecifier.text === ANGULAR_CORE &&
    !statement.importClause?.isTypeOnly;

const readBindings = (sourceFile: ts.SourceFile): ServiceBindings => {
    const names = new Set<string>();
    const namespaces = new Set<string>();
    for (const statement of sourceFile.statements.filter(isAngularCoreImport)) {
        const bindings = statement.importClause?.namedBindings;
        if (bindings && ts.isNamespaceImport(bindings)) {
            namespaces.add(bindings.name.text);
            continue;
        }
        for (const element of bindings && ts.isNamedImports(bindings) ? bindings.elements : []) {
            const imported = (element.propertyName ?? element.name).text;
            if (imported === SERVICE && !element.isTypeOnly) {
                names.add(element.name.text);
            }
        }
    }
    return { names, namespaces };
};

const bindingsOf = (sourceFile: ts.SourceFile): ServiceBindings => {
    let bindings = bindingsCache.get(sourceFile);
    if (!bindings) {
        bindings = readBindings(sourceFile);
        bindingsCache.set(sourceFile, bindings);
    }
    return bindings;
};

const sourceFileOf = (node: ts.Node): ts.SourceFile | undefined => {
    let current: ts.Node | undefined = node;
    while (current && !ts.isSourceFile(current)) {
        current = current.parent;
    }
    return current as ts.SourceFile | undefined;
};

const calleeOf = (decorator: ts.Decorator): ts.Expression =>
    ts.isCallExpression(decorator.expression)
        ? decorator.expression.expression
        : decorator.expression;

/**
 * Whether the decorator is Angular's `Service`, recognised by its import from
 * `@angular/core` (named, aliased or through a namespace import). A project
 * decorator that is also called `Service` is not.
 */
export const isAngularServiceDecorator = (
    decorator: ts.Decorator,
    sourceFile: ts.SourceFile | undefined = sourceFileOf(decorator)
): boolean => {
    if (!sourceFile) {
        return false;
    }
    const callee = calleeOf(decorator);
    const bindings = bindingsOf(sourceFile);
    if (ts.isIdentifier(callee)) {
        return bindings.names.has(callee.text);
    }
    return (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        callee.name.text === SERVICE &&
        bindings.namespaces.has(callee.expression.text)
    );
};

/** Options of a `@Service(...)` call that the docs show. */
export interface ServiceOptions {
    /** `autoProvided` when written as a boolean literal. */
    readonly autoProvided?: boolean;
    /** Source text of the `factory` option. */
    readonly factory?: string;
}

const propertyName = (property: ts.ObjectLiteralElementLike): string | undefined =>
    property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ? property.name.text
        : undefined;

const booleanOf = (expression: ts.Expression): boolean | undefined => {
    if (expression.kind === ts.SyntaxKind.TrueKeyword) {
        return true;
    }
    return expression.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
};

const factoryText = (
    property: ts.ObjectLiteralElementLike,
    sourceFile: ts.SourceFile
): string | undefined => {
    if (ts.isPropertyAssignment(property)) {
        return property.initializer.getText(sourceFile);
    }
    return ts.isMethodDeclaration(property) || ts.isShorthandPropertyAssignment(property)
        ? property.getText(sourceFile)
        : undefined;
};

/** The `autoProvided` and `factory` options of a `@Service(...)` decorator. */
export const serviceOptions = (
    decorator: ts.Decorator,
    sourceFile: ts.SourceFile
): ServiceOptions => {
    const call = decorator.expression;
    const argument = ts.isCallExpression(call) ? call.arguments[0] : undefined;
    if (!argument || !ts.isObjectLiteralExpression(argument)) {
        return {};
    }
    let autoProvided: boolean | undefined;
    let factory: string | undefined;
    for (const property of argument.properties) {
        const name = propertyName(property);
        if (name === 'autoProvided' && ts.isPropertyAssignment(property)) {
            autoProvided = booleanOf(property.initializer);
        } else if (name === 'factory') {
            factory = factoryText(property, sourceFile);
        }
    }
    return {
        ...(autoProvided !== undefined && { autoProvided }),
        ...(factory && { factory })
    };
};
