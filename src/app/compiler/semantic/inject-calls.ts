import { ts } from 'ts-morph';

/** Names a file imports from `@angular/*` modules. */
export interface AngularImports {
    /** Local name -> imported name and module. */
    readonly named: ReadonlyMap<string, { readonly name: string; readonly module: string }>;
    /** Local namespace name -> module. */
    readonly namespaces: ReadonlyMap<string, string>;
}

export interface InjectCall {
    /** The token argument, unwrapped from `forwardRef(() => X)`. */
    readonly token: ts.Expression;
    /** Identifier or property access text of the token; undefined for computed tokens. */
    readonly tokenName?: string;
    readonly optional: boolean;
    readonly node: ts.CallExpression;
}

const ANGULAR_CORE = '@angular/core';

/**
 * Angular APIs that need an injection context unless an injector is passed.
 * `takeUntilDestroyed` is exempt when it gets a `DestroyRef` argument.
 */
export const CONTEXT_APIS: ReadonlySet<string> = new Set([
    'effect',
    'toSignal',
    'toObservable',
    'takeUntilDestroyed',
    'afterNextRender',
    'afterRenderEffect',
    'afterEveryRender',
    'resource',
    'rxResource',
    'httpResource',
    'outputFromObservable',
    'pendingUntilEvent',
    'assertInInjectionContext'
]);

/** Callbacks of these APIs run in the caller's context, so their bodies count as its own. */
const CALLBACK_HOSTS: ReadonlySet<string> = new Set(['computed', 'effect']);

const isAngularModule = (specifier: string): boolean => specifier.startsWith('@angular/');

const localFunctionNames = (sourceFile: ts.SourceFile): ReadonlySet<string> =>
    new Set(
        sourceFile.statements
            .filter(ts.isFunctionDeclaration)
            .map(statement => statement.name?.text)
            .filter((name): name is string => name !== undefined)
    );

/** Imports from `@angular/*`. A top-level function of the same name shadows an import. */
export const angularImports = (sourceFile: ts.SourceFile): AngularImports => {
    const shadowed = localFunctionNames(sourceFile);
    const named = new Map<string, { name: string; module: string }>();
    const namespaces = new Map<string, string>();
    for (const statement of sourceFile.statements) {
        if (
            !ts.isImportDeclaration(statement) ||
            !ts.isStringLiteral(statement.moduleSpecifier) ||
            !isAngularModule(statement.moduleSpecifier.text)
        ) {
            continue;
        }
        const module = statement.moduleSpecifier.text;
        const bindings = statement.importClause?.namedBindings;
        if (!bindings) {
            continue;
        }
        if (ts.isNamespaceImport(bindings)) {
            namespaces.set(bindings.name.text, module);
            continue;
        }
        for (const element of bindings.elements) {
            if (!shadowed.has(element.name.text)) {
                named.set(element.name.text, {
                    name: (element.propertyName ?? element.name).text,
                    module
                });
            }
        }
    }
    return { named, namespaces };
};

/** Local names bound to `inject` from `@angular/core`, including `inject as i`. */
export const injectAliases = (sourceFile: ts.SourceFile): ReadonlySet<string> =>
    new Set(
        [...angularImports(sourceFile).named]
            .filter(
                ([, imported]) => imported.name === 'inject' && imported.module === ANGULAR_CORE
            )
            .map(([local]) => local)
    );

/** The Angular API a call targets, as `{ name, module }`, or undefined. */
export const angularCallee = (
    call: ts.CallExpression,
    imports: AngularImports
): { readonly name: string; readonly module: string } | undefined => {
    const callee = call.expression;
    if (ts.isIdentifier(callee)) {
        return imports.named.get(callee.text);
    }
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
        const module = imports.namespaces.get(callee.expression.text);
        return module ? { name: callee.name.text, module } : undefined;
    }
    return undefined;
};

const isInjectCall = (call: ts.CallExpression, imports: AngularImports): boolean => {
    const callee = angularCallee(call, imports);
    return callee?.name === 'inject' && callee.module === ANGULAR_CORE;
};

const isHostCallback = (node: ts.Node, imports: AngularImports): boolean => {
    const parent = node.parent;
    if (!ts.isArrowFunction(node) || !parent || !ts.isCallExpression(parent)) {
        return false;
    }
    if (parent.arguments[0] !== node) {
        return false;
    }
    const callee = angularCallee(parent, imports);
    return callee !== undefined && CALLBACK_HOSTS.has(callee.name);
};

/**
 * Visit `root` and its descendants, without entering nested function-like
 * nodes (closures belong to their own declaration), except arrow functions
 * passed directly as `computed`/`effect` callbacks.
 */
export const visitOwnScope = (
    root: ts.Node,
    imports: AngularImports,
    visit: (node: ts.Node) => void
): void => {
    const walk = (node: ts.Node): void => {
        if (node !== root && ts.isFunctionLike(node) && !isHostCallback(node, imports)) {
            return;
        }
        visit(node);
        ts.forEachChild(node, walk);
    };
    walk(root);
};

const unwrapForwardRef = (expression: ts.Expression): ts.Expression => {
    if (
        ts.isCallExpression(expression) &&
        ts.isIdentifier(expression.expression) &&
        expression.expression.text === 'forwardRef'
    ) {
        const callback = expression.arguments[0];
        if (callback && ts.isArrowFunction(callback) && !ts.isBlock(callback.body)) {
            return callback.body;
        }
    }
    return expression;
};

/** `ElementRef<HTMLElement>` used as a value names the token `ElementRef`. */
const unwrapInstantiation = (expression: ts.Expression): ts.Expression =>
    ts.isExpressionWithTypeArguments(expression) ? expression.expression : expression;

const nameOf = (expression: ts.Expression): string | undefined => {
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
        const owner = nameOf(expression.expression);
        return owner ? `${owner}.${expression.name.text}` : undefined;
    }
    return undefined;
};

const isOptional = (call: ts.CallExpression): boolean => {
    const options = call.arguments[1];
    return (
        options !== undefined &&
        ts.isObjectLiteralExpression(options) &&
        options.properties.some(
            property =>
                ts.isPropertyAssignment(property) &&
                property.name.getText() === 'optional' &&
                property.initializer.kind === ts.SyntaxKind.TrueKeyword
        )
    );
};

const toInjectCall = (call: ts.CallExpression): InjectCall | undefined => {
    const argument = call.arguments[0];
    if (!argument) {
        return undefined;
    }
    const token = unwrapInstantiation(unwrapForwardRef(argument));
    return { token, tokenName: nameOf(token), optional: isOptional(call), node: call };
};

/** Every `inject()` call in the own scope of `node`, in source order. */
export const findInjectCalls = (node: ts.Node, imports: AngularImports): readonly InjectCall[] => {
    const calls: InjectCall[] = [];
    visitOwnScope(node, imports, current => {
        if (ts.isCallExpression(current) && isInjectCall(current, imports)) {
            const call = toInjectCall(current);
            if (call) {
                calls.push(call);
            }
        }
    });
    return calls;
};

/**
 * The `inject()` call at the root of an expression such as `inject(X)`,
 * `inject<T>(X)`, `inject(X).y`, `inject(X).y()`, `inject(X)!` or `inject(X) as Y`.
 */
export const rootInjectCall = (
    expression: ts.Expression,
    imports: AngularImports
): InjectCall | undefined => {
    let current: ts.Expression = expression;
    for (;;) {
        if (ts.isCallExpression(current) && isInjectCall(current, imports)) {
            return toInjectCall(current);
        }
        if (
            ts.isPropertyAccessExpression(current) ||
            ts.isElementAccessExpression(current) ||
            ts.isCallExpression(current) ||
            ts.isNonNullExpression(current) ||
            ts.isAsExpression(current) ||
            ts.isSatisfiesExpression(current) ||
            ts.isParenthesizedExpression(current)
        ) {
            current = current.expression;
            continue;
        }
        return undefined;
    }
};

/** Whether an options argument passes an injector; a spread or a non-literal does not count. */
const passesInjector = (call: ts.CallExpression): boolean =>
    call.arguments.some(
        argument =>
            ts.isObjectLiteralExpression(argument) &&
            !argument.properties.some(ts.isSpreadAssignment) &&
            argument.properties.some(
                property =>
                    (ts.isPropertyAssignment(property) ||
                        ts.isShorthandPropertyAssignment(property)) &&
                    property.name.getText() === 'injector'
            )
    );

const needsContext = (call: ts.CallExpression, name: string): boolean => {
    if (name === 'takeUntilDestroyed') {
        return call.arguments.length === 0;
    }
    return !passesInjector(call);
};

/**
 * Names of the Angular context APIs called in the own scope of `node` that
 * need an injection context (no injector passed), in source order.
 */
export const findContextApiCalls = (node: ts.Node, imports: AngularImports): readonly string[] => {
    const names: string[] = [];
    visitOwnScope(node, imports, current => {
        if (!ts.isCallExpression(current)) {
            return;
        }
        const callee = angularCallee(current, imports);
        if (callee && CONTEXT_APIS.has(callee.name) && needsContext(current, callee.name)) {
            names.push(callee.name);
        }
    });
    return names;
};
