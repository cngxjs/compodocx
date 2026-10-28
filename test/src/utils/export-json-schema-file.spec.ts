import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    buildExportSchema,
    schemaFileOf,
    serializeSchema
} from '../../../scripts/export-schema.mjs';
import {
    DEPRECATED_EXPORT_FIELDS,
    EXPORT_SCHEMA_VERSION
} from '../../../src/app/interfaces/export-data.interface';

/**
 * The checked-in JSON Schema of `documentation.json` is what
 * `node scripts/export-schema.mjs` generates from `ExportData`. A change of
 * the interface without regenerating fails here.
 */
describe('documentation.json JSON Schema', () => {
    const { schemaVersion, schema } = buildExportSchema();

    it('is generated for the current schema version', () => {
        expect(schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    });

    it('matches the checked-in file (run `npm run schema:export` after changing the interface)', () => {
        const file = schemaFileOf(EXPORT_SCHEMA_VERSION);
        expect(fs.existsSync(file)).toBe(true);
        expect(fs.readFileSync(file, 'utf8')).toBe(serializeSchema(schema));
    });

    it.each(
        DEPRECATED_EXPORT_FIELDS.filter(field => !field.undeclared)
    )('marks $path as deprecated', field => {
        const [list, property] = field.path.split('[].');
        const ref: string = schema.properties[list].items.$ref;
        const definition = schema.$defs[ref.replace('#/$defs/', '')];
        expect(definition.properties[property].deprecated).toBe(true);
    });
});
