import { ts } from 'ts-morph';

import { relativeFile, resolveAlias, unwrapExpression } from '../compiler/semantic/declarations';
import type { SymbolId } from '../links/symbol-id';
import {
    emptyGuards,
    GUARD_KEYS,
    type GuardKey,
    joinPath,
    pathSegment,
    type RouteNode,
    type RouteNote,
    type RouteRef,
    type RouteTarget,
    type RouteValue
} from './model';

/** A route array reached from a route: its expression and, when named, its variable. */
export interface RouteArrayRef {
    readonly expression: ts.Expression;
    readonly array?: SymbolId;
}

/** What a `loadComponent` / `loadChildren` function loads. */
export interface LazyTarget {
    readonly target: RouteTarget;
    /** Set when `loadChildren` loads a route array: expanded below the route. */
    readonly routes?: RouteArrayRef;
}

/** What the extractor needs from the program around a route array. */
export interface RouteEnv {
    readonly checker: ts.TypeChecker;
    /** Base of every file path in the model. */
    readonly cwd: string;
    /** The documented symbol of a declaration, when there is one. */
    readonly symbolOf: (declaration: ts.Node) => SymbolId | undefined;
    /** Resolves the function of a `loadComponent` (`children` false) or `loadChildren`. */
    readonly lazy: (fn: ts.Expression, children: boolean) => LazyTarget;
}

/** Lazy loading left unresolved: the function stays a source text. */
export const unresolvedLazy = (fn: ts.Expression): LazyTarget => ({
    target: { kind: 'unresolved', name: '', lazy: true, source: fn.getText() }
});

const MAX_DEPTH = 32;

const ROUTE_KEYS: ReadonlySet<string> = new Set([
    'path',
    'pathMatch',
    'matcher',
    'component',
    'loadComponent',
    'children',
    'loadChildren',
    'redirectTo',
    'outlet',
    'title',
    'data',
    'resolve',
    'runGuardsAndResolvers',
    'providers',
    ...GUARD_KEYS
]);

interface Walk {
    readonly env: RouteEnv;
    readonly notes: RouteNote[];
    /** Array expressions on the current path (cycle guard). */
    readonly visiting: ReadonlySet<ts.Node>;
    readonly depth: number;
}

/** Where the extracted routes hang: parent full path and node id. */
export interface RoutePlace {
    readonly fullPath: string;
    readonly id: string;
}

const lineOf = (node: ts.Node): number => {
    const sourceFile = node.getSourceFile();
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
};

const fileOf = (env: RouteEnv, node: ts.Node): string =>
    relativeFile(env.cwd, node.getSourceFile().fileName);

const note = (walk: Walk, node: ts.Node, what: string): void => {
    walk.notes.push({ file: fileOf(walk.env, node), line: lineOf(node), what });
};

/** The declaration an identifier or property access refers to, aliases followed. */
export const declarationOf = (
    checker: ts.TypeChecker,
    expression: ts.Expression
): ts.Declaration | undefined => {
    const target = ts.isPropertyAccessExpression(expression) ? expression.name : expression;
    const shorthand =
        ts.isShorthandPropertyAssignment(target.parent) && target.parent.name === target;
    const symbol = resolveAlias(
        checker,
        shorthand
            ? checker.getShorthandAssignmentValueSymbol(target.parent)
            : checker.getSymbolAtLocation(target)
    );
    return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
};

const isNameExpression = (
    expression: ts.Expression
): expression is ts.Identifier | ts.PropertyAccessExpression =>
    ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression);

const lastName = (expression: ts.Expression): string => {
    if (ts.isIdentifier(expression)) {
        return expression.text;
    }
    if (ts.isPropertyAccessExpression(expression)) {
        return expression.name.text;
    }
    return '';
};

/**
 * A string the checker can evaluate (D5): a literal, a template of evaluable
 * parts, or an expression typed as a string literal (const, enum member,
 * `as const` property); anything else is kept as source text.
 */
export const routeValue = (checker: ts.TypeChecker, node: ts.Expression): RouteValue => {
    const expression = unwrapExpression(node);
    const dynamic: RouteValue = { kind: 'dynamic', source: node.getText() };
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        return { kind: 'literal', text: expression.text };
    }
    if (ts.isTemplateExpression(expression)) {
        let text = expression.head.text;
        for (const span of expression.templateSpans) {
            const part = routeValue(checker, span.expression);
            if (part.kind === 'dynamic') {
                return dynamic;
            }
            text += part.text + span.literal.text;
        }
        return { kind: 'literal', text };
    }
    // A shorthand `{ path }` names the property; its value is the variable in scope.
    const isShorthand =
        ts.isIdentifier(expression) &&
        ts.isShorthandPropertyAssignment(expression.parent) &&
        expression.parent.name === expression;
    const declaration = isShorthand ? declarationOf(checker, expression) : undefined;
    const type = checker.getTypeAtLocation(declaration ?? expression);
    if (type.isStringLiteral()) {
        return { kind: 'literal', text: type.value };
    }
    if (type.isNumberLiteral()) {
        return { kind: 'literal', text: String(type.value) };
    }
    return dynamic;
};

/** One reference: an identifier, a call (callee linked) or an inline function. */
export const routeRef = (env: RouteEnv, node: ts.Expression): RouteRef => {
    const expression = unwrapExpression(node);
    const source = node.getText();
    const callee =
        ts.isCallExpression(expression) || ts.isNewExpression(expression)
            ? unwrapExpression(expression.expression)
            : undefined;
    const named = callee ?? expression;
    if (!isNameExpression(named)) {
        return { name: '', source, call: callee !== undefined };
    }
    const declaration = declarationOf(env.checker, named);
    const symbol = declaration && env.symbolOf(declaration);
    return {
        name: lastName(named),
        ...(symbol ? { symbol } : {}),
        source,
        call: callee !== undefined
    };
};

const isFunctionLike = (declaration: ts.Declaration | undefined): boolean => {
    if (!declaration) {
        return false;
    }
    if (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
        return true;
    }
    const initializer =
        ts.isVariableDeclaration(declaration) && declaration.initializer
            ? unwrapExpression(declaration.initializer)
            : undefined;
    return (
        initializer !== undefined &&
        (ts.isArrowFunction(initializer) ||
            ts.isFunctionExpression(initializer) ||
            ts.isClassExpression(initializer))
    );
};

/** `redirectTo` / `title`: a string, or a function / class reference. */
const valueOrRef = (env: RouteEnv, node: ts.Expression): RouteValue | RouteRef => {
    const expression = unwrapExpression(node);
    const isInline =
        ts.isArrowFunction(expression) ||
        ts.isFunctionExpression(expression) ||
        ts.isCallExpression(expression) ||
        ts.isNewExpression(expression);
    if (isInline) {
        return routeRef(env, node);
    }
    const value = routeValue(env.checker, node);
    const isReference =
        value.kind === 'dynamic' &&
        isNameExpression(expression) &&
        isFunctionLike(declarationOf(env.checker, expression));
    return isReference ? routeRef(env, node) : value;
};

/** Elements of a guard / provider list; a non-array value is one reference. */
const refList = (env: RouteEnv, node: ts.Expression): readonly RouteRef[] => {
    const expression = unwrapExpression(node);
    return ts.isArrayLiteralExpression(expression)
        ? expression.elements.map(element => routeRef(env, element))
        : [routeRef(env, node)];
};

/** A non-lazy `component`: the class it names, else the source text. */
const componentTarget = (env: RouteEnv, node: ts.Expression): RouteTarget => {
    const expression = unwrapExpression(node);
    const declaration = isNameExpression(expression)
        ? declarationOf(env.checker, expression)
        : undefined;
    if (!declaration) {
        return { kind: 'unresolved', name: '', lazy: false, source: node.getText() };
    }
    const symbol = env.symbolOf(declaration);
    return {
        kind: 'symbol',
        name: lastName(expression),
        ...(symbol ? { symbol } : {}),
        lazy: false,
        source: node.getText()
    };
};

/** What a route list expression stands for: an array, or a call that builds one at runtime. */
export type RouteListSource =
    | { readonly array: RouteArrayRef }
    | { readonly call: ts.CallExpression }
    | undefined;

/**
 * The route array an expression stands for: an array literal, or an
 * identifier whose declaration holds one (aliases and re-exports followed).
 */
export const routeArrayOf = (env: RouteEnv, node: ts.Expression): RouteListSource => {
    const expression = unwrapExpression(node);
    if (ts.isArrayLiteralExpression(expression)) {
        return { array: { expression } };
    }
    if (ts.isCallExpression(expression)) {
        return { call: expression };
    }
    if (!isNameExpression(expression)) {
        return undefined;
    }
    const declaration = declarationOf(env.checker, expression);
    if (!declaration || !ts.isVariableDeclaration(declaration) || !declaration.initializer) {
        return undefined;
    }
    const initializer = unwrapExpression(declaration.initializer);
    if (ts.isCallExpression(initializer)) {
        return { call: initializer };
    }
    if (!ts.isArrayLiteralExpression(initializer)) {
        return undefined;
    }
    const array = env.symbolOf(declaration);
    return { array: { expression: initializer, ...(array ? { array } : {}) } };
};

const childPlace = (parent: RoutePlace, index: number): RoutePlace => ({
    fullPath: parent.fullPath,
    id: `${parent.id}-${index}`
});

/** One node for a child list a function builds at runtime. */
const builtNode = (walk: Walk, call: ts.CallExpression, place: RoutePlace): RouteNode => {
    const builtBy = routeRef(walk.env, call);
    return {
        id: place.id,
        path: null,
        fullPath: joinPath(place.fullPath, `{${builtBy.source}}`),
        builtBy,
        children: [],
        guards: emptyGuards(),
        resolve: [],
        providers: [],
        file: fileOf(walk.env, call),
        line: lineOf(call)
    };
};

type Fields = Map<string, ts.Expression>;

const objectFields = (walk: Walk, object: ts.ObjectLiteralExpression): Fields => {
    const fields: Fields = new Map();
    for (const property of object.properties) {
        const key =
            property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
                ? property.name.text
                : undefined;
        const value = ts.isPropertyAssignment(property)
            ? property.initializer
            : ts.isShorthandPropertyAssignment(property)
              ? property.name
              : undefined;
        if (key === undefined || value === undefined) {
            note(walk, property, `route field not read: ${property.getText()}`);
            continue;
        }
        if (!ROUTE_KEYS.has(key)) {
            note(walk, property, `unknown route key: ${key}`);
            continue;
        }
        fields.set(key, value);
    }
    return fields;
};

const pathMatchOf = (walk: Walk, node: ts.Expression): { pathMatch?: 'full' | 'prefix' } => {
    const value = routeValue(walk.env.checker, node);
    if (value.kind === 'literal' && (value.text === 'full' || value.text === 'prefix')) {
        return { pathMatch: value.text };
    }
    note(walk, node, `pathMatch not evaluated: ${node.getText()}`);
    return {};
};

const resolveOf = (walk: Walk, node: ts.Expression): RouteNode['resolve'] => {
    const expression = unwrapExpression(node);
    if (!ts.isObjectLiteralExpression(expression)) {
        note(walk, node, `resolve is not an object literal: ${node.getText()}`);
        return [];
    }
    return expression.properties.flatMap(property => {
        const key =
            property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
                ? property.name.text
                : undefined;
        const value = ts.isPropertyAssignment(property)
            ? property.initializer
            : ts.isShorthandPropertyAssignment(property)
              ? property.name
              : undefined;
        return key !== undefined && value !== undefined
            ? [{ key, ref: routeRef(walk.env, value) }]
            : [];
    });
};

const routeNode = (
    walk: Walk,
    object: ts.ObjectLiteralExpression,
    place: RoutePlace,
    array: SymbolId | undefined
): RouteNode => {
    const { env } = walk;
    const fields = objectFields(walk, object);
    const field = (key: string) => fields.get(key);
    const pathNode = field('path');
    const path = pathNode ? routeValue(env.checker, pathNode) : null;
    const matcher = field('matcher') && routeRef(env, field('matcher') as ts.Expression);
    const own = path ? pathSegment(path) : matcher ? `{${matcher.source}}` : '';
    const fullPath = joinPath(place.fullPath, own);
    const self: RoutePlace = { fullPath, id: place.id };

    const loadComponent = field('loadComponent');
    const componentNode = field('component');
    const component = loadComponent
        ? env.lazy(loadComponent, false).target
        : componentNode && componentTarget(env, componentNode);

    const loadChildren = field('loadChildren');
    const lazyChildren = loadChildren && env.lazy(loadChildren, true);
    const childrenNode = field('children');
    const inline = childrenNode ? routeList(walk, childrenNode, self, 0) : [];
    const loaded = lazyChildren?.routes
        ? routeList(walk, lazyChildren.routes, self, inline.length)
        : [];

    const guards = emptyGuards();
    for (const key of GUARD_KEYS) {
        const node = field(key);
        if (node) {
            (guards as Record<GuardKey, readonly RouteRef[]>)[key] = refList(env, node);
        }
    }
    const redirectTo = field('redirectTo');
    const title = field('title');
    const outlet = field('outlet');
    const outletValue = outlet && routeValue(env.checker, outlet);
    const data = field('data');
    const run = field('runGuardsAndResolvers');
    const pathMatch = field('pathMatch');
    const resolve = field('resolve');
    const providers = field('providers');

    return {
        id: place.id,
        path,
        fullPath,
        ...(pathMatch ? pathMatchOf(walk, pathMatch) : {}),
        ...(matcher ? { matcher } : {}),
        ...(outletValue ? { outlet: pathSegment(outletValue) } : {}),
        ...(component ? { component } : {}),
        ...(lazyChildren ? { childrenFrom: lazyChildren.target } : {}),
        children: [...inline, ...loaded],
        ...(redirectTo ? { redirectTo: valueOrRef(env, redirectTo) } : {}),
        ...(title ? { title: valueOrRef(env, title) } : {}),
        guards,
        resolve: resolve ? resolveOf(walk, resolve) : [],
        providers: providers ? refList(env, providers) : [],
        ...(data ? { data: data.getText() } : {}),
        ...(run ? { runGuardsAndResolvers: run.getText() } : {}),
        ...(array ? { array } : {}),
        file: fileOf(env, object),
        line: lineOf(object)
    };
};

/**
 * The routes of one route array expression below `place`; `first` is the
 * index of the first node among its siblings. Spreads of route arrays are
 * followed, a list built by a call becomes one node with `builtBy`.
 */
const routeList = (
    walk: Walk,
    source: ts.Expression | RouteArrayRef,
    place: RoutePlace,
    first: number
): readonly RouteNode[] => {
    const isRef = !('kind' in source);
    const node = isRef ? source.expression : source;
    const list = isRef ? { array: source } : routeArrayOf(walk.env, source);
    if (list === undefined) {
        note(walk, node, `not a route array: ${node.getText()}`);
        return [];
    }
    if ('call' in list) {
        return [builtNode(walk, list.call, childPlace(place, first))];
    }
    const { expression, array } = list.array;
    if (walk.visiting.has(expression)) {
        note(walk, node, `route array cycle: ${node.getText()}`);
        return [];
    }
    if (walk.depth >= MAX_DEPTH) {
        note(walk, node, `route nesting deeper than ${MAX_DEPTH}`);
        return [];
    }
    const inner: Walk = {
        ...walk,
        visiting: new Set([...walk.visiting, expression]),
        depth: walk.depth + 1
    };
    const elements = ts.isArrayLiteralExpression(expression) ? expression.elements : [];
    const nodes: RouteNode[] = [];
    for (const element of elements) {
        const index = first + nodes.length;
        if (ts.isSpreadElement(element)) {
            nodes.push(...routeList(inner, element.expression, place, index));
            continue;
        }
        const value = unwrapExpression(element);
        if (ts.isObjectLiteralExpression(value)) {
            nodes.push(routeNode(inner, value, childPlace(place, index), array));
            continue;
        }
        note(walk, element, `route element not read: ${element.getText()}`);
    }
    return nodes;
};

/** The routes of a route array expression, ids below `place.id`. */
export const extractRoutes = (
    env: RouteEnv,
    source: ts.Expression | RouteArrayRef,
    place: RoutePlace,
    notes: RouteNote[] = []
): readonly RouteNode[] =>
    routeList({ env, notes, visiting: new Set(), depth: 0 }, source, place, 0);
