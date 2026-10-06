import type { LegacyFinding } from '../compiler/legacy-scan';

export interface ParsedData {
    components?;
    entities?;
    directives?;
    injectables?;
    interceptors?;
    guards?;
    interfaces?;
    pipes?;
    classes?;
    miscellaneous?;
    routesTree?;
    aliases?;
    routes?;
    typescriptImports?;
    appConfig?;
    legacyFindings?: readonly LegacyFinding[];
}
