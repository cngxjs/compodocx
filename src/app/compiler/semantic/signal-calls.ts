import { ts } from 'ts-morph';

import type { AngularImports } from './inject-calls';

export type SignalApi = 'input' | 'output' | 'model';

export interface SignalMemberCall {
    readonly api: SignalApi;
    readonly required: boolean;
    /** Text of the first type argument, newlines stripped; undefined without type arguments. */
    readonly type?: string;
    /** Text of the initial value argument (input/model only, not `.required`), newlines stripped. */
    readonly initialValue?: string;
    /** String literal `alias` of the options object literal. */
    readonly alias?: string;
    readonly node: ts.CallExpression;
}

const ANGULAR_CORE = '@angular/core';

const SIGNAL_APIS: ReadonlySet<string> = new Set<SignalApi>(['input', 'output', 'model']);

const isSignalApi = (name: string): name is SignalApi => SIGNAL_APIS.has(name);

/** `x`, `(x)`, `x!`, `x as T`, `x satisfies T` -> `x`. */
const unwrapRoot = (expression: ts.Expression): ts.Expression => {
    let current = expression;
    while (
        ts.isParenthesizedExpression(current) ||
        ts.isNonNullExpression(current) ||
        ts.isAsExpression(current) ||
        ts.isSatisfiesExpression(current)
    ) {
        current = current.expression;
    }
    return current;
};

/** The signal API an expression names: `input`, `i` (aliased import) or `ng.input`. */
const signalApiOf = (expression: ts.Expression, imports: AngularImports): SignalApi | undefined => {
    if (ts.isIdentifier(expression)) {
        const imported = imports.named.get(expression.text);
        return imported?.module === ANGULAR_CORE && isSignalApi(imported.name)
            ? imported.name
            : undefined;
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        const isCore = imports.namespaces.get(expression.expression.text) === ANGULAR_CORE;
        const name = expression.name.text;
        return isCore && isSignalApi(name) ? name : undefined;
    }
    return undefined;
};

/** `api(...)` or `api.required(...)`; `output.required` does not exist. */
const calleeOf = (
    call: ts.CallExpression,
    imports: AngularImports
): { readonly api: SignalApi; readonly required: boolean } | undefined => {
    const direct = signalApiOf(call.expression, imports);
    if (direct) {
        return { api: direct, required: false };
    }
    const callee = call.expression;
    if (!ts.isPropertyAccessExpression(callee) || callee.name.text !== 'required') {
        return undefined;
    }
    const api = signalApiOf(callee.expression, imports);
    return api && api !== 'output' ? { api, required: true } : undefined;
};

const textOf = (node: ts.Node, sourceFile: ts.SourceFile): string =>
    node.getText(sourceFile).replace(/\n/g, '');

const isAliasKey = (name: ts.PropertyName): boolean =>
    (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'alias';

/** The string literal `alias` of an options object literal; computed or variable aliases are ignored. */
const aliasOf = (options: ts.Expression | undefined): string | undefined => {
    if (!options || !ts.isObjectLiteralExpression(options)) {
        return undefined;
    }
    for (const property of options.properties) {
        if (
            ts.isPropertyAssignment(property) &&
            isAliasKey(property.name) &&
            ts.isStringLiteralLike(property.initializer)
        ) {
            return property.initializer.text;
        }
    }
    return undefined;
};

/**
 * The signal member call at the root of a property initializer, or undefined:
 * `input`, `input.required`, `output`, `model` or `model.required` imported from
 * `@angular/core` (named, aliased or through a namespace import).
 */
export const signalMemberCall = (
    initializer: ts.Expression,
    imports: AngularImports,
    sourceFile: ts.SourceFile
): SignalMemberCall | undefined => {
    const call = unwrapRoot(initializer);
    if (!ts.isCallExpression(call)) {
        return undefined;
    }
    const callee = calleeOf(call, imports);
    if (!callee) {
        return undefined;
    }
    const takesInitialValue = callee.api !== 'output' && !callee.required;
    const [first, second] = call.arguments;
    const initialArgument = takesInitialValue ? first : undefined;
    const options = takesInitialValue ? second : first;
    const typeArgument = call.typeArguments?.[0];
    const alias = aliasOf(options);
    return {
        api: callee.api,
        required: callee.required,
        type: typeArgument ? textOf(typeArgument, sourceFile) : undefined,
        initialValue: initialArgument ? textOf(initialArgument, sourceFile) : undefined,
        ...(alias !== undefined && { alias }),
        node: call
    };
};

/** Member APIs recognised by their import: export name, module and member kind. */
const IMPORTED_MEMBER_APIS: ReadonlyArray<{
    readonly name: string;
    readonly module: string;
    readonly kind: string;
}> = [
    { name: 'httpResource', module: '@angular/common/http', kind: 'http-resource' },
    { name: 'injectAsync', module: ANGULAR_CORE, kind: 'inject-async' }
];

/** `httpResource.text(...)` and its siblings read other response types. */
const HTTP_RESOURCE_VARIANTS: ReadonlySet<string> = new Set(['text', 'blob', 'arrayBuffer']);

export interface ImportedMemberCall {
    /** `http-resource` or `inject-async`. */
    readonly kind: string;
    /** Text of the first type argument, newlines stripped. */
    readonly type?: string;
}

/** The imported name and module an identifier or `ns.name` expression refers to. */
const importedApiOf = (
    expression: ts.Expression,
    imports: AngularImports
): { readonly name: string; readonly module: string } | undefined => {
    if (ts.isIdentifier(expression)) {
        return imports.named.get(expression.text);
    }
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
        const module = imports.namespaces.get(expression.expression.text);
        return module ? { name: expression.name.text, module } : undefined;
    }
    return undefined;
};

const memberKindOf = (callee: ts.Expression, imports: AngularImports): string | undefined => {
    const direct = importedApiOf(callee, imports);
    const api = IMPORTED_MEMBER_APIS.find(
        entry => entry.name === direct?.name && entry.module === direct?.module
    );
    if (api) {
        return api.kind;
    }
    if (!ts.isPropertyAccessExpression(callee) || !HTTP_RESOURCE_VARIANTS.has(callee.name.text)) {
        return undefined;
    }
    const base = importedApiOf(callee.expression, imports);
    return base?.name === 'httpResource' && base.module === '@angular/common/http'
        ? 'http-resource'
        : undefined;
};

/**
 * `httpResource(...)` (and `httpResource.text(...)`, `.blob`, `.arrayBuffer`)
 * from `@angular/common/http` or `injectAsync(...)` from `@angular/core` at the
 * root of a member initializer, recognised by the import.
 */
export const importedMemberCall = (
    expression: ts.Expression,
    imports: AngularImports,
    sourceFile: ts.SourceFile
): ImportedMemberCall | undefined => {
    const root = unwrapRoot(expression);
    if (!ts.isCallExpression(root)) {
        return undefined;
    }
    const kind = memberKindOf(root.expression, imports);
    if (!kind) {
        return undefined;
    }
    const typeArgument = root.typeArguments?.[0];
    return typeArgument ? { kind, type: textOf(typeArgument, sourceFile) } : { kind };
};
