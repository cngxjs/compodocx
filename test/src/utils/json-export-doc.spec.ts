import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXPORT_SCHEMA_VERSION } from '../../../src/app/interfaces/export-data.interface';

/**
 * `docs/json-export.md` is the schema history of `documentation.json`. A
 * schema bump without its section there leaves export readers without the
 * list of changes.
 */
const doc = fs.readFileSync(path.resolve(__dirname, '../../../docs/json-export.md'), 'utf8');

describe('docs/json-export.md', () => {
    it('has a section for the current schema version', () => {
        expect(doc).toMatch(new RegExp(`^## Schema ${EXPORT_SCHEMA_VERSION}$`, 'm'));
    });

    it('lists the current schema version in the versions table', () => {
        expect(doc).toMatch(new RegExp(`^\\| \`${EXPORT_SCHEMA_VERSION}\` \\|`, 'm'));
    });
});
