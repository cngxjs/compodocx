import type { LegacyFinding } from '../compiler/legacy-scan';

export interface ParsedData {
    components?;
    entities?;
    directives?;
    injectables?;
    tokens?;
    interceptors?;
    guards?;
    interfaces?;
    pipes?;
    classes?;
    miscellaneous?;
    aliases?;
    routes?;
    typescriptImports?;
    appConfig?;
    legacyFindings?: readonly LegacyFinding[];
}
