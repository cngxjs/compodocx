export { exportRoutes } from './export';
export {
    declarationOf,
    extractRoutes,
    type LazyTarget,
    type RouteArrayRef,
    type RouteEnv,
    type RouteListSource,
    type RoutePlace,
    routeArrayOf,
    routeRef,
    routeValue,
    unresolvedLazy
} from './extract';
export * from './model';
export {
    importedName,
    isRouteArrayType,
    ROUTER_MODULE,
    type RouteArrayDeclaration,
    routeArrayDeclarations,
    routeArrayOfVariable
} from './recognise';
export { declarationKey, lazyImport, lazyResolver, nameRouting, symbolIndex } from './resolve';
export { buildRouting, formatRoutingSummary, indexRouting, type RoutingInput } from './roots';
