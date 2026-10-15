import { HELPER_MAP, knownLegacyHelpers, renameTargets } from '../../../src/migrate/helper-map';
import * as modernHelpers from '../../../src/templates/helpers';

/**
 * Every Handlebars helper name a compodoc `.hbs` template can call: the
 * helpers compodoc registered, plus the legacy link helpers that were no
 * longer registered (the templates resolve links through the page layout)
 * but that users still write. The list is frozen: compodocx renders with
 * TSX and registers no Handlebars helpers, so `compodocx migrate` must keep
 * mapping exactly these names.
 */
const LEGACY_HELPERS = [
    'compare',
    'or',
    'isNotToggle',
    'isInitialTab',
    'isTabEnabled',
    'ifString',
    'ifEqualString',
    'orLength',
    'filterAngular2Modules',
    'debug',
    'breaklines',
    'clean-paragraph',
    'escapeSimpleQuote',
    'breakComma',
    'modifKind',
    'modifIcon',
    'jsdoc-returns-comment',
    'jsdoc-code-example',
    'jsdoc-example',
    'jsdoc-params',
    'jsdoc-params-valid',
    'jsdoc-default',
    'indexableSignature',
    'object',
    'objectLength',
    'one-parameter-has',
    'hasOwn',
    'short-url',
    'strip-url',
    't',
    'capitalize',
    'parse-property',
    'isInfoSection',
    'isApiSection',
    'highlightCode',
    'functionSignature',
    'linkType',
    'parseDescription',
    'relativeURL'
] as const;

describe('migrate/helper-map — forward coverage', () => {
    it('every legacy helper has a HELPER_MAP entry', () => {
        const known = new Set(knownLegacyHelpers());
        const missing = LEGACY_HELPERS.filter(name => !known.has(name));
        expect(missing).toEqual([]);
    });
});

describe('migrate/helper-map — reverse coverage', () => {
    it('every rename target points to a name exported from src/templates/helpers', () => {
        const exported = new Set(Object.keys(modernHelpers));
        const broken = renameTargets().filter(name => !exported.has(name));
        expect(broken).toEqual([]);
    });
});

describe('migrate/helper-map — mapping shape', () => {
    it('every entry has a discriminating kind', () => {
        const valid = new Set(['rename', 'inline', 'removed', 'unknown', 'lossy-rename']);
        for (const [name, mapping] of Object.entries(HELPER_MAP)) {
            expect(valid.has(mapping.kind), `entry ${name} kind=${mapping.kind}`).toBe(true);
        }
    });

    it('rename entries point to non-empty target names', () => {
        for (const [name, mapping] of Object.entries(HELPER_MAP)) {
            if (mapping.kind === 'rename' || mapping.kind === 'lossy-rename') {
                expect(mapping.to.length, `entry ${name}`).toBeGreaterThan(0);
            }
        }
    });
});
