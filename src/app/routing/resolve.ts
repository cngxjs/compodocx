import { ts } from 'ts-morph';

import { relativeFile, resolveAlias, unwrapExpression } from '../compiler/semantic/declarations';
import { resolveSpecifier } from '../compiler/semantic/imports';
import type { SymbolId } from '../links/symbol-id';
import type { SymbolTable } from '../links/symbol-table';
import type { LazyTarget, RouteEnv } from './extract';
import {
    emptyGuards,
    GUARD_KEYS,
    type RouteNode,
    type RouteNote,
    type RouteRef,
    type RouteRoot,
    type RouteTarget,
    type RouteValue,
    type RoutingModel
} from './model';
import { routeArrayOfVariable } from './recognise';
import { indexRouting } from './roots';

/** Kinds of the type space; a route reference is always a value. */
const TYPE_KINDS: ReadonlySet<string> = new Set(['interface', 'typealias', 'style']);

/** `file#name` -> documented symbol id (value-space kinds, first entry wins). */
export const symbolIndex = (table: SymbolTable): ReadonlyMap<string, SymbolId> => {
    const index = new Map<string, SymbolId>();
    for (const [id, entry] of table.byId) {
        if (TYPE_KINDS.has(entry.ref.kind)) {
            continue;
        }
        const key = `${entry.ref.file}#${entry.ref.name}`;
        if (!index.has(key)) {
            index.set(key, id);
        }
    }
    return index;
};

const declarationName = (node: ts.Node): string | undefined => {
    const name = (node as ts.NamedDeclaration).name;
    return name && ts.isIdentifier(name) ? name.text : undefined;
};

/**
 * The `file#name` key of a class, function or variable declaration, in the
 * place of its symbol id until `nameRouting` looks it up in the table.
 */
export const declarationKey =
    (cwd: string) =>
    (node: ts.Node): SymbolId | undefined => {
        const name = declarationName(node);
        return name === undefined
            ? undefined
            : (`${relativeFile(cwd, node.getSourceFile().fileName)}#${name}` as SymbolId);
    };

/** `import('<specifier>')`. */
const importSpecifier = (expression: ts.Expression): ts.Expression | undefined => {
    const call = unwrapExpression(expression);
    return ts.isCallExpression(call) && call.expression.kind === ts.SyntaxKind.ImportKeyword
        ? call.arguments[0]
        : undefined;
};

/** The single returned expression of an arrow or function body. */
const returned = (fn: ts.Expression): ts.Expression | undefined => {
    const expression = unwrapExpression(fn);
    if (!ts.isArrowFunction(expression) && !ts.isFunctionExpression(expression)) {
        return undefined;
    }
    const { body } = expression;
    if (!ts.isBlock(body)) {
        return body;
    }
    const [statement] = body.statements;
    return body.statements.length === 1 && statement && ts.isReturnStatement(statement)
        ? statement.expression
        : undefined;
};

/** The export a `.then(...)` callback picks: `m => m.X`, `({ X }) => X`. */
const pickedExport = (callback: ts.Expression): string | undefined => {
    const fn = unwrapExpression(callback);
    if (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn)) {
        return undefined;
    }
    const [param] = fn.parameters;
    const body = returned(fn);
    if (!param || !body) {
        return undefined;
    }
    const picked = unwrapExpression(body);
    if (ts.isIdentifier(param.name)) {
        const isMember =
            ts.isPropertyAccessExpression(picked) &&
            ts.isIdentifier(picked.expression) &&
            picked.expression.text === param.name.text;
        return isMember ? picked.name.text : undefined;
    }
    if (ts.isObjectBindingPattern(param.name) && ts.isIdentifier(picked)) {
        const element = param.name.elements.find(
            e => ts.isIdentifier(e.name) && e.name.text === picked.text
        );
        const property = element?.propertyName ?? element?.name;
        return property && ts.isIdentifier(property) ? property.text : undefined;
    }
    return undefined;
};

/** Module specifier node and picked export of a lazy loader, in its four forms. */
export const lazyImport = (
    fn: ts.Expression
): { readonly specifier: ts.Expression; readonly name: string } | undefined => {
    const body = returned(fn);
    if (!body) {
        return undefined;
    }
    const expression = unwrapExpression(body);
    // () => import(s)
    const direct = importSpecifier(expression);
    if (direct) {
        return { specifier: direct, name: 'default' };
    }
    // () => import(s).then(m => m.X) / .then(({ X }) => X)
    if (
        ts.isCallExpression(expression) &&
        ts.isPropertyAccessExpression(expression.expression) &&
        expression.expression.name.text === 'then'
    ) {
        const specifier = importSpecifier(expression.expression.expression);
        const name = expression.arguments[0] && pickedExport(expression.arguments[0]);
        return specifier && name ? { specifier, name } : undefined;
    }
    // async () => (await import(s)).X
    if (ts.isPropertyAccessExpression(expression)) {
        const awaited = unwrapExpression(expression.expression);
        const specifier = ts.isAwaitExpression(awaited)
            ? importSpecifier(awaited.expression)
            : undefined;
        return specifier ? { specifier, name: expression.name.text } : undefined;
    }
    return undefined;
};

const isRelative = (specifier: string): boolean =>
    specifier.startsWith('.') || specifier.startsWith('/');

/** The declaration behind an export of a module, aliases and re-exports followed. */
const exportedDeclaration = (
    checker: ts.TypeChecker,
    module: ts.SourceFile,
    name: string
): ts.Node | undefined => {
    const moduleSymbol = checker.getSymbolAtLocation(module);
    const symbol =
        moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(s => s.name === name);
    const target = resolveAlias(checker, symbol);
    return target?.valueDeclaration ?? target?.declarations?.[0];
};

/** The route array a declaration holds: a variable or an `export default` expression. */
const routeArrayIn = (declaration: ts.Node): ts.Expression | undefined => {
    if (ts.isVariableDeclaration(declaration)) {
        const typed = routeArrayOfVariable(declaration);
        const initializer = declaration.initializer && unwrapExpression(declaration.initializer);
        return (
            typed ??
            (initializer && ts.isArrayLiteralExpression(initializer) ? initializer : undefined)
        );
    }
    if (ts.isExportAssignment(declaration)) {
        const expression = unwrapExpression(declaration.expression);
        return ts.isArrayLiteralExpression(expression) ? expression : undefined;
    }
    return undefined;
};

/**
 * Resolves `loadComponent` / `loadChildren` through the semantic program: the
 * module specifier with the program's resolution, the picked export on the
 * module symbol. A package specifier is `external`; anything else that does
 * not resolve is `unresolved` with a note.
 */
export const lazyResolver =
    (
        program: ts.Program,
        symbolOf: RouteEnv['symbolOf'],
        cwd: string,
        notes: RouteNote[]
    ): RouteEnv['lazy'] =>
    (fn, children) => {
        const checker = program.getTypeChecker();
        const source = fn.getText();
        const file = relativeFile(cwd, fn.getSourceFile().fileName);
        const line = fn.getSourceFile().getLineAndCharacterOfPosition(fn.getStart()).line + 1;
        const unresolved = (what: string, name = ''): LazyTarget => {
            notes.push({ file, line, what });
            return { target: { kind: 'unresolved', name, lazy: true, source } };
        };
        const loader = lazyImport(fn);
        if (!loader) {
            return unresolved(`lazy target not followed: ${source}`);
        }
        const literal = unwrapExpression(loader.specifier);
        if (!ts.isStringLiteral(literal) && !ts.isNoSubstitutionTemplateLiteral(literal)) {
            return unresolved(`computed import specifier: ${source}`, loader.name);
        }
        const specifier = literal.text;
        const module = resolveSpecifier(program, fn.getSourceFile().fileName, specifier);
        if (!module) {
            return isRelative(specifier)
                ? unresolved(`import not found: ${specifier}`, loader.name)
                : {
                      target: {
                          kind: 'external',
                          name: loader.name,
                          specifier,
                          lazy: true,
                          source
                      }
                  };
        }
        const declaration = exportedDeclaration(checker, module, loader.name);
        if (!declaration) {
            return unresolved(`no export ${loader.name} in ${specifier}`, loader.name);
        }
        const symbol = symbolOf(declaration);
        const name = ts.isExportAssignment(declaration)
            ? loader.name
            : (declarationName(declaration) ?? loader.name);
        const array = children ? routeArrayIn(declaration) : undefined;
        const target: RouteTarget = {
            kind: array ? 'routes' : 'symbol',
            name,
            ...(symbol ? { symbol } : {}),
            specifier,
            lazy: true,
            source
        };
        return array
            ? { target, routes: { expression: array, ...(symbol ? { array: symbol } : {}) } }
            : { target };
    };

type Lookup = (key: SymbolId | undefined) => SymbolId | undefined;

const withSymbol = <T extends { readonly symbol?: SymbolId }>(item: T, lookup: Lookup): T => {
    const { symbol, ...rest } = item;
    const id = lookup(symbol);
    return (id ? { ...rest, symbol: id } : rest) as T;
};

const nameValue = (value: RouteValue | RouteRef, lookup: Lookup): RouteValue | RouteRef =>
    'call' in value ? withSymbol(value, lookup) : value;

const nameGuards = (
    guards: RouteNode['guards'],
    ref: (r: RouteRef) => RouteRef
): RouteNode['guards'] => {
    const named = emptyGuards();
    for (const key of GUARD_KEYS) {
        named[key] = guards[key].map(ref);
    }
    return named;
};

const nameNode = (node: RouteNode, lookup: Lookup): RouteNode => {
    const { array, ...rest } = node;
    const id = lookup(array);
    const ref = (r: RouteRef) => withSymbol(r, lookup);
    return {
        ...rest,
        ...(node.matcher ? { matcher: ref(node.matcher) } : {}),
        ...(node.component ? { component: withSymbol(node.component, lookup) } : {}),
        ...(node.childrenFrom ? { childrenFrom: withSymbol(node.childrenFrom, lookup) } : {}),
        children: node.children.map(child => nameNode(child, lookup)),
        ...(node.builtBy ? { builtBy: ref(node.builtBy) } : {}),
        ...(node.redirectTo ? { redirectTo: nameValue(node.redirectTo, lookup) } : {}),
        ...(node.title ? { title: nameValue(node.title, lookup) } : {}),
        guards: nameGuards(node.guards, ref),
        resolve: node.resolve.map(entry => ({ key: entry.key, ref: ref(entry.ref) })),
        providers: node.providers.map(ref),
        ...(id ? { array: id } : {})
    };
};

const nameRoot = (root: RouteRoot, lookup: Lookup): RouteRoot => {
    const { config, array, ...rest } = root;
    const configId = lookup(config);
    const arrayId = lookup(array);
    return {
        ...rest,
        bootstraps: root.bootstraps.map(b => {
            const { component, ...plain } = b;
            const id = lookup(component);
            return id ? { ...plain, component: id } : plain;
        }),
        ...(configId ? { config: configId } : {}),
        features: root.features.map(f => withSymbol(f, lookup)),
        ...(arrayId ? { array: arrayId } : {}),
        routes: root.routes.map(node => nameNode(node, lookup))
    };
};

/**
 * Replaces the `file#name` keys of a draft model (`declarationKey`) with the
 * ids of the documented symbols; a key without a symbol is dropped.
 */
export const nameRouting = (draft: RoutingModel, table: SymbolTable): RoutingModel => {
    const index = symbolIndex(table);
    const lookup: Lookup = key => (key === undefined ? undefined : index.get(key));
    return indexRouting(
        draft.roots.map(root => nameRoot(root, lookup)),
        draft.notes
    );
};
