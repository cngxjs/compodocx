/**
 * Bare-specifier import scanner shared by the manifest builder (package
 * roots for dependency forwarding) and the vendor pruner (subpaths for entry
 * points). Picks up any non-relative `import` source (`from 'pkg'` /
 * `from "pkg/sub"`), side imports (`import 'foo';`) and re-exports
 * (`export ... from 'foo'`). Global: reset `lastIndex` before each scan.
 */
export const BARE_SPEC_RE = /(?:from|import|export\s+[^'"]*from)\s*['"]([^'".][^'"]*)['"]/g;

/**
 * Map a possibly-deep specifier (`@scope/kit/button`, `lodash-es/cloneDeep`)
 * back to its package root for npm-dependency lookup. Scoped packages keep
 * the first two segments (`@scope/name`); unscoped keep the first segment.
 */
export const resolvePackageRoot = (specifier: string): string => {
    if (specifier.startsWith('@')) {
        const parts = specifier.split('/');
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
    }
    return specifier.split('/')[0];
};
