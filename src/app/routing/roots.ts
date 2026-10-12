import { ts } from 'ts-morph';

import { relativeFile, unwrapExpression } from '../compiler/semantic/declarations';
import type { SymbolId } from '../links/symbol-id';
import { declarationOf, extractRoutes, type RouteEnv, routeRef } from './extract';
import type { RouteBootstrap, RouteNode, RouteNote, RouteRoot, RoutingModel } from './model';
import { importedName, ROUTER_MODULE, routeArrayDeclarations } from './recognise';

const BROWSER_MODULE = '@angular/platform-browser';
const CORE_MODULE = '@angular/core';
/** Provider arrays nest through spreads and identifiers; deeper chains are not followed. */
const MAX_PROVIDER_DEPTH = 16;

/** True when `call` calls `name` imported from `module` in its file. */
const calls = (call: ts.CallExpression, module: string, name: string): boolean =>
    importedName(unwrapExpression(call.expression), module) === name;

const lineOf = (node: ts.Node): number => {
    const sourceFile = node.getSourceFile();
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
};

/** Every call of `name` from `module` in a file, at any nesting. */
const callsIn = (sourceFile: ts.SourceFile, module: string, name: string): ts.CallExpression[] => {
    const found: ts.CallExpression[] = [];
    const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && calls(node, module, name)) {
            found.push(node);
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return found;
};

/** A `provideRouter` call reached from a bootstrap, with the config variable around it. */
interface RouterCall {
    readonly call: ts.CallExpression;
    readonly config?: ts.VariableDeclaration;
}

/** The initializer of the variable an identifier names, across files. */
const initializerOf = (
    checker: ts.TypeChecker,
    expression: ts.Expression
): { declaration: ts.VariableDeclaration; initializer: ts.Expression } | undefined => {
    if (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression)) {
        return undefined;
    }
    const declaration = declarationOf(checker, expression);
    return declaration && ts.isVariableDeclaration(declaration) && declaration.initializer
        ? { declaration, initializer: unwrapExpression(declaration.initializer) }
        : undefined;
};

/** The `provideRouter` calls of a providers expression: arrays, spreads, named arrays. */
const routerCallsInProviders = (
    checker: ts.TypeChecker,
    node: ts.Expression,
    config: ts.VariableDeclaration | undefined,
    seen: ReadonlySet<ts.Node>
): RouterCall[] => {
    const expression = unwrapExpression(node);
    if (seen.has(expression) || seen.size >= MAX_PROVIDER_DEPTH) {
        return [];
    }
    const next = new Set([...seen, expression]);
    if (ts.isCallExpression(expression)) {
        return calls(expression, ROUTER_MODULE, 'provideRouter')
            ? [{ call: expression, ...(config ? { config } : {}) }]
            : [];
    }
    if (ts.isArrayLiteralExpression(expression)) {
        return expression.elements.flatMap(element =>
            routerCallsInProviders(
                checker,
                ts.isSpreadElement(element) ? element.expression : element,
                config,
                next
            )
        );
    }
    const named = initializerOf(checker, expression);
    return named ? routerCallsInProviders(checker, named.initializer, config, next) : [];
};

/** The `provideRouter` calls of an application config: literal, named, or merged. */
const routerCallsInConfig = (
    checker: ts.TypeChecker,
    node: ts.Expression,
    config: ts.VariableDeclaration | undefined,
    seen: ReadonlySet<ts.Node>
): RouterCall[] => {
    const expression = unwrapExpression(node);
    if (seen.has(expression) || seen.size >= MAX_PROVIDER_DEPTH) {
        return [];
    }
    const next = new Set([...seen, expression]);
    if (ts.isObjectLiteralExpression(expression)) {
        const providers = expression.properties.find(
            p => ts.isPropertyAssignment(p) && p.name.getText() === 'providers'
        );
        return providers && ts.isPropertyAssignment(providers)
            ? routerCallsInProviders(checker, providers.initializer, config, new Set())
            : [];
    }
    if (
        ts.isCallExpression(expression) &&
        calls(expression, CORE_MODULE, 'mergeApplicationConfig')
    ) {
        return expression.arguments.flatMap(arg => routerCallsInConfig(checker, arg, config, next));
    }
    const named = initializerOf(checker, expression);
    return named ? routerCallsInConfig(checker, named.initializer, named.declaration, next) : [];
};

interface RouterEntry {
    readonly call: ts.CallExpression;
    readonly config?: ts.VariableDeclaration;
    readonly bootstraps: ts.CallExpression[];
}

const compareFileLine = (a: ts.Node, b: ts.Node, cwd: string): number => {
    const fa = relativeFile(cwd, a.getSourceFile().fileName);
    const fb = relativeFile(cwd, b.getSourceFile().fileName);
    return fa === fb ? a.getStart() - b.getStart() : fa < fb ? -1 : 1;
};

const countNodes = (nodes: readonly RouteNode[]): number =>
    nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0);

const walkNodes = (
    nodes: readonly RouteNode[],
    parent: string,
    visit: (node: RouteNode, parent: string) => void
): void => {
    for (const node of nodes) {
        visit(node, parent);
        walkNodes(node.children, node.fullPath, visit);
    }
};

const pushUnique = <K, V>(map: Map<K, V[]>, key: K, value: V): void => {
    const list = map.get(key) ?? [];
    if (!list.includes(value)) {
        list.push(value);
    }
    map.set(key, list);
};

/** Input of `buildRouting`: the program files to scan and how to name symbols. */
export interface RoutingInput {
    readonly program: ts.Program;
    /** Files to scan for bootstraps and route arrays (the documented files). */
    readonly files: readonly string[];
    readonly cwd: string;
    readonly symbolOf: RouteEnv['symbolOf'];
    /** Lazy resolution; built over the notes list it is handed. */
    readonly lazy: (notes: RouteNote[]) => RouteEnv['lazy'];
}

/**
 * The route model of a program (D3): one router root per `provideRouter` call
 * reached from a `bootstrapApplication` config (two bootstraps of one call
 * share the root), then every exported route array no root mounts as an
 * unmounted root. Unexported unmounted arrays are noted, not rendered.
 */
export const buildRouting = (input: RoutingInput): RoutingModel => {
    const { program, cwd, symbolOf } = input;
    const checker = program.getTypeChecker();
    const notes: RouteNote[] = [];
    const env: RouteEnv = { checker, cwd, symbolOf, lazy: input.lazy(notes) };
    const sourceFiles = input.files
        .map(file => program.getSourceFile(file))
        .filter((sf): sf is ts.SourceFile => sf !== undefined && !sf.isDeclarationFile);

    const routers = new Map<ts.CallExpression, RouterEntry>();
    for (const sourceFile of sourceFiles) {
        for (const bootstrap of callsIn(sourceFile, BROWSER_MODULE, 'bootstrapApplication')) {
            const config = bootstrap.arguments[1];
            const found = config ? routerCallsInConfig(checker, config, undefined, new Set()) : [];
            for (const router of found) {
                const entry = routers.get(router.call) ?? { ...router, bootstraps: [] };
                entry.bootstraps.push(bootstrap);
                routers.set(router.call, entry);
            }
        }
    }
    const firstBootstrap = (entry: RouterEntry) =>
        [...entry.bootstraps].sort((a, b) => compareFileLine(a, b, cwd))[0];
    const ordered = [...routers.values()].sort((a, b) =>
        compareFileLine(firstBootstrap(a), firstBootstrap(b), cwd)
    );

    const mounted = new Set<ts.Node>();
    const roots: RouteRoot[] = ordered.map((entry, index) => {
        const [routesArg, ...featureArgs] = entry.call.arguments;
        const named = routesArg && initializerOf(checker, unwrapExpression(routesArg));
        const array = named && symbolOf(named.declaration);
        const routes = routesArg
            ? extractRoutes(env, routesArg, { fullPath: '/', id: `${index}` }, notes, mounted)
            : [];
        const bootstraps: RouteBootstrap[] = [...entry.bootstraps]
            .sort((a, b) => compareFileLine(a, b, cwd))
            .map(call => {
                const component = call.arguments[0];
                const componentDeclaration =
                    component && declarationOf(checker, unwrapExpression(component));
                const componentId = componentDeclaration && symbolOf(componentDeclaration);
                return {
                    file: relativeFile(cwd, call.getSourceFile().fileName),
                    line: lineOf(call),
                    ...(componentId ? { component: componentId } : {}),
                    ...(component ? { componentName: component.getText() } : {})
                };
            });
        const config = entry.config && symbolOf(entry.config);
        return {
            id: `${index}`,
            kind: 'router',
            bootstraps,
            ...(config ? { config } : {}),
            ...(entry.config ? { configName: entry.config.name.getText() } : {}),
            features: featureArgs.map(arg => routeRef(env, arg)),
            ...(array ? { array } : {}),
            ...(named ? { arrayName: named.declaration.name.getText() } : {}),
            routes
        };
    });

    // Exported route arrays that no router mounts, nor another such array.
    const candidates = sourceFiles
        .flatMap(sourceFile => routeArrayDeclarations(sourceFile))
        .filter(declaration => !mounted.has(declaration.initializer));
    const reached = new Map<ts.Node, Set<ts.Node>>();
    const probe: RouteEnv = { ...env, lazy: input.lazy([]) };
    for (const candidate of candidates) {
        const visited = new Set<ts.Node>();
        extractRoutes(
            probe,
            { expression: candidate.initializer },
            { fullPath: '/', id: '' },
            [],
            visited
        );
        visited.delete(candidate.initializer);
        reached.set(candidate.initializer, visited);
    }
    const unmounted = candidates.filter(
        candidate =>
            ![...reached].some(
                ([other, visited]) =>
                    other !== candidate.initializer &&
                    visited.has(candidate.initializer) &&
                    !reached.get(candidate.initializer)?.has(other)
            )
    );
    for (const candidate of unmounted.filter(c => !c.exported)) {
        notes.push({
            file: relativeFile(cwd, candidate.node.getSourceFile().fileName),
            line: lineOf(candidate.node),
            what: `route array ${candidate.name} is neither exported nor mounted (ignored)`
        });
    }
    for (const candidate of unmounted.filter(c => c.exported)) {
        const index = roots.length;
        const array = symbolOf(candidate.node);
        roots.push({
            id: `${index}`,
            kind: 'unmounted',
            bootstraps: [],
            features: [],
            ...(array ? { array } : {}),
            arrayName: candidate.name,
            routes: extractRoutes(
                env,
                { expression: candidate.initializer, ...(array ? { array } : {}) },
                { fullPath: '/', id: `${index}` },
                notes
            )
        });
    }

    return indexRouting(roots, notes);
};

/** Counts and back-references of a list of roots. */
export const indexRouting = (
    roots: readonly RouteRoot[],
    notes: readonly RouteNote[]
): RoutingModel => {
    const byTarget = new Map<SymbolId, string[]>();
    const mountedAt = new Map<SymbolId, string[]>();
    for (const root of roots) {
        walkNodes(root.routes, '/', (node, parent) => {
            if (node.component?.symbol) {
                pushUnique(byTarget, node.component.symbol, node.id);
            }
            if (root.kind === 'router' && node.array) {
                pushUnique(mountedAt, node.array, parent);
            }
        });
    }
    return {
        roots,
        count: roots.reduce((sum, root) => sum + countNodes(root.routes), 0),
        byTarget,
        mountedAt,
        notes
    };
};

/** One line for the build log. */
export const formatRoutingSummary = (model: RoutingModel): string => {
    let lazy = 0;
    let dynamic = 0;
    const isDynamic = (value: RouteNode['path'] | RouteNode['redirectTo'] | undefined) =>
        value !== null && value !== undefined && 'kind' in value && value.kind === 'dynamic';
    for (const root of model.roots) {
        walkNodes(root.routes, '/', node => {
            lazy += node.component?.lazy || node.childrenFrom?.lazy ? 1 : 0;
            dynamic += [node.path, node.redirectTo, node.title].filter(isDynamic).length;
            dynamic += node.builtBy ? 1 : 0;
        });
    }
    const routers = model.roots.filter(root => root.kind === 'router').length;
    const unmounted = model.roots.length - routers;
    return `Routes: ${model.count} in ${routers} router${routers === 1 ? '' : 's'}, ${unmounted} unmounted (${lazy} lazy, ${dynamic} dynamic value${dynamic === 1 ? '' : 's'})`;
};
