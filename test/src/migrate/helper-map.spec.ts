import * as fs from 'node:fs';
import * as path from 'node:path';
import { HELPER_MAP, knownLegacyHelpers, renameTargets } from '../../../src/migrate/helper-map';
import * as modernHelpers from '../../../src/templates/helpers';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const REGISTRATION_FILE = path.join(REPO_ROOT, 'src/app/engines/html.engine.helpers.ts');

/**
 * Source-of-truth: every `registerHelper(bars, '<name>', ...)` call in
 * `html.engine.helpers.ts`. Parsing the registration file directly means a
 * new legacy helper added to compodoc's engine fails this spec until the
 * mapping is added.
 */
/**
 * Legacy link helpers that are no longer registered (the templates resolve
 * links through the page layout now) but that users still write in `.hbs`
 * templates, so `compodocx migrate` must keep mapping them.
 */
const UNREGISTERED_LEGACY_HELPERS = [
    'functionSignature',
    'linkType',
    'parseDescription',
    'relativeURL'
] as const;

const registeredHelpers = (): readonly string[] => {
    const source = fs.readFileSync(REGISTRATION_FILE, 'utf8');
    const matches = source.matchAll(/registerHelper\(\s*bars\s*,\s*['"]([^'"]+)['"]/g);
    return [...Array.from(matches, m => m[1]), ...UNREGISTERED_LEGACY_HELPERS];
};

describe('migrate/helper-map — forward coverage', () => {
    it('every registered legacy helper has a HELPER_MAP entry', () => {
        const known = new Set(knownLegacyHelpers());
        const missing = registeredHelpers().filter(name => !known.has(name));
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
