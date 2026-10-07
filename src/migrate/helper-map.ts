/**
 * Mapping from legacy compodoc Handlebars helper names to compodocx JS actions.
 *
 * The keys are the names users wrote in `.hbs` templates — i.e. the strings
 * passed to `Handlebars.registerHelper`. Source of truth: the
 * `registerHelper(...)` calls in `src/app/engines/html.engine.helpers.ts`,
 * plus the unregistered legacy link helpers listed in `helper-map.spec.ts`
 * (`functionSignature`, `linkType`, `parseDescription`, `relativeURL`).
 *
 * Five mapping kinds:
 * - `rename`        — legacy → modern barrel name; emit `helpers.<to>(...args)`.
 * - `lossy-rename`  — modern equivalent isn't byte-identical; same emit, yellow.
 * - `inline`        — pure JS replacement; emit function returns the source.
 * - `removed`       — no analog; emit empty string + warning.
 * - `unknown`       — never seen by the converter; emit TODO + red fidelity.
 *
 * Forward coverage (every registered helper has a mapping) and reverse
 * coverage (every `rename` target is exported by the modern helper barrel)
 * are both enforced in `helper-map.spec.ts`. Drift in either direction
 * fails the test suite.
 */

export type HelperMapping =
    | { readonly kind: 'rename'; readonly to: string }
    | { readonly kind: 'lossy-rename'; readonly to: string; readonly reason: string }
    | { readonly kind: 'inline'; readonly emit: (args: readonly string[]) => string }
    | { readonly kind: 'removed'; readonly reason: string }
    | { readonly kind: 'unknown'; readonly warn: string };

const COMPARE_OP_MAP: Readonly<Record<string, string>> = {
    '===': '===',
    '!==': '!==',
    '==': '==',
    '!=': '!=',
    '>': '>',
    '<': '<',
    '>=': '>=',
    '<=': '<=',
    indexof: 'indexof'
};

export const HELPER_MAP: Readonly<Record<string, HelperMapping>> = {
    // 1:1 renames — legacy registered name → modern barrel export.
    relativeURL: { kind: 'rename', to: 'relativeUrl' },
    t: { kind: 'rename', to: 't' },
    capitalize: { kind: 'rename', to: 'capitalize' },
    parseDescription: { kind: 'rename', to: 'parseDescription' },
    functionSignature: { kind: 'rename', to: 'functionSignature' },
    linkType: { kind: 'rename', to: 'linkTypeHtml' },
    modifIcon: { kind: 'rename', to: 'modifIcon' },
    modifKind: { kind: 'rename', to: 'modifKind' },
    isApiSection: { kind: 'rename', to: 'isApiSection' },
    isInfoSection: { kind: 'rename', to: 'isInfoSection' },
    isInitialTab: { kind: 'rename', to: 'isInitialTab' },
    isTabEnabled: { kind: 'rename', to: 'isTabEnabled' },
    indexableSignature: { kind: 'rename', to: 'indexableSignature' },
    'jsdoc-params': { kind: 'rename', to: 'extractJsdocParams' },
    'jsdoc-example': { kind: 'rename', to: 'extractJsdocExamples' },
    'jsdoc-code-example': { kind: 'rename', to: 'extractJsdocCodeExamples' },
    'jsdoc-returns-comment': { kind: 'rename', to: 'jsdocReturnsComment' },
    'parse-property': { kind: 'rename', to: 'parseProperty' },
    'one-parameter-has': { kind: 'rename', to: 'oneParameterHas' },
    'short-url': { kind: 'rename', to: 'shortUrl' },
    highlightCode: { kind: 'rename', to: 'highlightedCodeWrap' },

    // Lossy renames — close-enough modern equivalent, fidelity goes yellow.
    breaklines: {
        kind: 'lossy-rename',
        to: 'parseDescription',
        reason: String.raw`breaklines was a one-shot \n→<br>; parseDescription runs full markdown`
    },

    // Inline JS replacements — HBS-only constructs with no helper analog.
    compare: {
        kind: 'inline',
        emit: ([a, op, b]) => {
            const stripped = (op ?? '').replaceAll(/^['"]|['"]$/g, '');
            const jsOp = COMPARE_OP_MAP[stripped];
            if (!jsOp) {
                return `/* TODO(migrate): unknown compare operator ${op} */`;
            }
            return jsOp === 'indexof' ? `(${b}.indexOf(${a}) !== -1)` : `(${a} ${jsOp} ${b})`;
        }
    },
    or: {
        kind: 'inline',
        emit: args => (args.length > 0 ? `(${args.join(' || ')})` : 'false')
    },
    ifEqualString: {
        kind: 'inline',
        emit: ([a, b]) => `(String(${a}) === String(${b}))`
    },
    ifString: {
        kind: 'inline',
        emit: ([a]) => `(typeof ${a} === 'string')`
    },
    hasOwn: {
        kind: 'inline',
        emit: ([entity, key]) => `Object.hasOwn(${entity}, ${key})`
    },
    objectLength: {
        kind: 'inline',
        emit: ([obj]) => `Object.keys(${obj} ?? {}).length`
    },
    orLength: {
        kind: 'inline',
        emit: ([a, b]) => `((${a}?.length || 0) + (${b}?.length || 0))`
    },
    breakComma: {
        kind: 'inline',
        emit: ([str]) => `String(${str} ?? '').replaceAll(',', ',<br/>')`
    },
    'clean-paragraph': {
        kind: 'inline',
        emit: ([str]) => String.raw`String(${str} ?? '').replaceAll(/<\/?p>/g, '')`
    },
    escapeSimpleQuote: {
        kind: 'inline',
        emit: ([str]) => String.raw`String(${str} ?? '').replaceAll("'", "\\'")`
    },
    object: {
        kind: 'inline',
        emit: () => '({})'
    },
    'strip-url': {
        kind: 'inline',
        emit: ([prefix, url]) => `(${prefix} + String(${url}).split('/').pop())`
    },

    // Stripped — debug-only or replaced by Configuration access.
    debug: { kind: 'removed', reason: 'debugging helper, no equivalent' },
    isNotToggle: {
        kind: 'removed',
        reason: 'reads Configuration.mainData.toggleMenuItems — port to a JS check inline'
    },
    filterAngular2Modules: {
        kind: 'removed',
        reason: 'simple inline check against the NG2_MODULES list'
    },
    'jsdoc-default': {
        kind: 'removed',
        reason: 'iterate jsdoctags inline — no modern helper'
    },
    'jsdoc-params-valid': {
        kind: 'removed',
        reason: 'check if any tag.tagName.text === "param" inline'
    },
    'element-alone': {
        kind: 'unknown',
        warn: 'rare/unused helper; emit as TODO comment'
    }
};

export const lookupHelper = (name: string): HelperMapping | undefined => HELPER_MAP[name];

/** All legacy helper names this map covers — used by coverage specs. */
export const knownLegacyHelpers = (): readonly string[] => Object.keys(HELPER_MAP);

/** All modern helper names referenced as `rename` / `lossy-rename` targets. */
export const renameTargets = (): readonly string[] =>
    Object.values(HELPER_MAP)
        .filter(m => m.kind === 'rename' || m.kind === 'lossy-rename')
        .map(m => (m as { to: string }).to);
