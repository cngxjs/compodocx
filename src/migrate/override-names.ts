/**
 * The canonical set of override names compodocx exposes for `--templates`.
 *
 * Source-of-truth:
 *  - Page-level overrides: distinct values of `CONTEXT_TEMPLATE_MAP` in
 *    `src/app/engines/html.engine.ts`. Multiple contexts can map to the same
 *    template (e.g. `getting-started` + `readme` + `changelog` → `markdown`).
 *  - Block-level overrides: every `renderCustomTemplate('block-...')` call in
 *    `src/templates/blocks/*.tsx`.
 *
 * The published tarball does NOT include `src/app/` or `src/templates/`, so
 * runtime grep is not an option. The two arrays below are hand-mirrored from
 * those source files; `override-names.spec.ts` enforces parity by re-deriving
 * the lists from disk and comparing — drift fails the test suite.
 */

export const PAGE_LEVEL_OVERRIDES: readonly string[] = [
    'additional-page',
    'api-reference',
    'bucket-landing',
    'class',
    'component',
    'coverage-report',
    'directive',
    'entity',
    'guard',
    'injectable',
    'interceptor',
    'interface',
    'markdown',
    'menu',
    'miscellaneous-enumeration',
    'miscellaneous-enumerations',
    'miscellaneous-function',
    'miscellaneous-functions',
    'miscellaneous-typealias',
    'miscellaneous-typealiases',
    'miscellaneous-variable',
    'miscellaneous-variables',
    'overview',
    'package-dependencies',
    'package-properties',
    'pipe',
    'routes',
    'token',
    'unit-test-report'
];

export const BLOCK_LEVEL_OVERRIDES: readonly string[] = [
    'block-accessors',
    'block-constructor',
    'block-derived-state',
    'block-enum',
    'block-host-bindings',
    'block-host-listener',
    'block-host-listeners',
    'block-index',
    'block-index-signatures',
    'block-input',
    'block-method',
    'block-output',
    'block-playground',
    'block-property',
    'block-theming',
    'block-theming-token',
    'block-typealias',
    'playground-content',
    'referenced-by',
    'related',
    'version-switcher'
];

const ALL = new Set<string>([...PAGE_LEVEL_OVERRIDES, ...BLOCK_LEVEL_OVERRIDES]);

export const isWiredOverride = (name: string): boolean => ALL.has(name);

export const allWiredOverrides = (): readonly string[] => Array.from(ALL).sort();
