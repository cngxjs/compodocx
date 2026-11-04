import type { LegacyFinding } from '../compiler/legacy-scan';

export interface ParsedData {
    components?;
    entities?;
    directives?;
    injectables?;
    services?;
    tokens?;
    interceptors?;
    guards?;
    interfaces?;
    namespaces?;
    namespaceAliases?;
    pipes?;
    classes?;
    miscellaneous?;
    aliases?;
    routes?;
    typescriptImports?;
    appConfig?;
    legacyFindings?: readonly LegacyFinding[];
}
