import type {
    ExportRoute,
    ExportRouteRef,
    ExportRouteRoot,
    ExportRouteTarget
} from '../interfaces/export-data.interface';
import type { SymbolId } from '../links/symbol-id';
import type { SymbolTable } from '../links/symbol-table';
import {
    GUARD_KEYS,
    type RouteNode,
    type RouteRef,
    type RouteRoot,
    type RouteTarget,
    type RouteValue,
    type RoutingModel
} from './model';

type FileOf = (id: SymbolId | undefined) => { file?: string };

const fileLookup =
    (table: SymbolTable | undefined): FileOf =>
    id => {
        const file = id === undefined ? undefined : table?.byId.get(id)?.ref.file;
        return file === undefined ? {} : { file };
    };

const exportRef = (ref: RouteRef, fileOf: FileOf): ExportRouteRef => ({
    name: ref.name,
    ...fileOf(ref.symbol),
    source: ref.source,
    ...(ref.call ? { call: true as const } : {})
});

const exportTarget = (target: RouteTarget, fileOf: FileOf): ExportRouteTarget => ({
    kind: target.kind,
    name: target.name,
    ...fileOf(target.symbol),
    ...(target.specifier !== undefined ? { specifier: target.specifier } : {}),
    ...(target.lazy ? { lazy: true as const } : {}),
    source: target.source
});

const isRef = (value: RouteValue | RouteRef): value is RouteRef => 'call' in value;

/** A string value as text; a dynamic one or a function as a reference with its source. */
const exportValue = (value: RouteValue | RouteRef, fileOf: FileOf): string | ExportRouteRef => {
    if (isRef(value)) {
        return exportRef(value, fileOf);
    }
    return value.kind === 'literal' ? value.text : { name: '', source: value.source };
};

const nonEmpty = <K extends string, T>(key: K, list: readonly T[]): Partial<Record<K, T[]>> =>
    list.length > 0 ? ({ [key]: [...list] } as Partial<Record<K, T[]>>) : {};

const exportNode = (node: RouteNode, fileOf: FileOf): ExportRoute => {
    const ref = (r: RouteRef) => exportRef(r, fileOf);
    const guards: Partial<Record<(typeof GUARD_KEYS)[number], ExportRouteRef[]>> = {};
    for (const key of GUARD_KEYS) {
        Object.assign(guards, nonEmpty(key, node.guards[key].map(ref)));
    }
    const path = node.path;
    return {
        path: path === null ? null : path.kind === 'literal' ? path.text : path.source,
        ...(path?.kind === 'dynamic' ? { pathDynamic: true as const } : {}),
        fullPath: node.fullPath,
        ...(node.pathMatch ? { pathMatch: node.pathMatch } : {}),
        ...(node.outlet !== undefined ? { outlet: node.outlet } : {}),
        ...(node.matcher ? { matcher: ref(node.matcher) } : {}),
        ...(node.component ? { component: exportTarget(node.component, fileOf) } : {}),
        ...(node.childrenFrom ? { loadChildren: exportTarget(node.childrenFrom, fileOf) } : {}),
        ...(node.builtBy ? { builtBy: ref(node.builtBy) } : {}),
        ...(node.redirectTo ? { redirectTo: exportValue(node.redirectTo, fileOf) } : {}),
        ...(node.title ? { title: exportValue(node.title, fileOf) } : {}),
        ...guards,
        ...(node.resolve.length > 0
            ? { resolve: Object.fromEntries(node.resolve.map(e => [e.key, ref(e.ref)])) }
            : {}),
        ...nonEmpty('providers', node.providers.map(ref)),
        ...(node.data !== undefined ? { data: node.data } : {}),
        ...(node.runGuardsAndResolvers !== undefined
            ? { runGuardsAndResolvers: node.runGuardsAndResolvers }
            : {}),
        file: node.file,
        line: node.line,
        ...nonEmpty(
            'children',
            node.children.map(child => exportNode(child, fileOf))
        )
    };
};

const exportRoot = (root: RouteRoot, table: SymbolTable | undefined): ExportRouteRoot => {
    const fileOf = fileLookup(table);
    const nameOf = (id: SymbolId | undefined, fallback: string | undefined) =>
        (id && table?.byId.get(id)?.ref.name) ?? fallback;
    const config = nameOf(root.config, root.configName);
    const array = nameOf(root.array, root.arrayName);
    return {
        kind: root.kind,
        ...nonEmpty(
            'bootstraps',
            root.bootstraps.map(b => ({
                file: b.file,
                line: b.line,
                ...(b.componentName ? { component: b.componentName } : {})
            }))
        ),
        ...(config ? { config } : {}),
        ...nonEmpty(
            'features',
            root.features.map(f => exportRef(f, fileOf))
        ),
        ...(array ? { array } : {}),
        routes: root.routes.map(node => exportNode(node, fileOf))
    };
};

/** The typed `routes` of the JSON export: no symbol ids, no output paths. */
export const exportRoutes = (
    model: RoutingModel,
    table: SymbolTable | undefined
): ExportRouteRoot[] => model.roots.map(root => exportRoot(root, table));
