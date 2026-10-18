export const LEGACY_PACKAGE_NAME = '@compodoc/compodoc';

/** Binary of this package; legacy `compodoc` invocations are rewritten to it. */
export const CLI_BIN = 'compodocx';

/**
 * The legacy `compodoc` binary in command position: at the start of a script,
 * after `&&`, `;` or `|`, or after `npx `, optionally as a path such as
 * `node_modules/.bin/compodoc`. Arguments such as `-d docs/compodoc` do not
 * match. Groups 1 and 2 keep what precedes the binary name for the rewrite.
 */
export const LEGACY_BIN_PATTERN = /(^\s*|(?:&&|;|\||\bnpx\s)\s*)(\S*\/)?compodoc(?!x)\b/g;

export const LEGACY_SCRIPT_KEY_PREFIX = 'compodoc:';

export const DEFAULT_SCRIPT_PREFIX = 'compodocx';

export const SCRIPT_PREFIX_PATTERN = /^[a-z][a-z0-9-]*$/;

export const TSCONFIG_DOC_TEMPLATE = {
    include: ['src/**/*.ts'],
    exclude: ['src/**/*.spec.ts']
};

export interface ScriptValueContext {
    prefix: string;
    tsconfigPath: string;
}

export const SCRIPT_VALUE_TEMPLATES: {
    build: (ctx: ScriptValueContext) => string;
    'build-and-serve': (ctx: ScriptValueContext) => string;
    serve: (ctx: ScriptValueContext) => string;
} = {
    build: ({ prefix, tsconfigPath }) => `${prefix} -p ${tsconfigPath}`,
    'build-and-serve': ({ prefix, tsconfigPath }) => `${prefix} -p ${tsconfigPath} -s`,
    serve: ({ prefix }) => `${prefix} -s`
};

export type GeneratedScriptKey = 'build' | 'build-and-serve' | 'serve';

export const GENERATED_SCRIPT_KEYS: readonly GeneratedScriptKey[] = [
    'build',
    'build-and-serve',
    'serve'
] as const;
