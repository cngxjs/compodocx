import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
    DEPRECATED_EXPORT_FIELDS,
    EXPORT_SCHEMA_VERSION
} from '../../../src/app/interfaces/export-data.interface';

/**
 * `docs/json-export.md` is the schema history of `documentation.json`. A
 * schema bump without its section there, or a deprecated field missing from
 * its table, leaves export readers without the list of changes.
 */
const REPO_ROOT = path.resolve(__dirname, '../../..');
const doc = fs.readFileSync(path.join(REPO_ROOT, 'docs/json-export.md'), 'utf8');
const INTERFACE_FILE = path.join(REPO_ROOT, 'src/app/interfaces/export-data.interface.ts');
const source = ts.createSourceFile(
    INTERFACE_FILE,
    fs.readFileSync(INTERFACE_FILE, 'utf8'),
    ts.ScriptTarget.Latest,
    true
);

const interfaceNamed = (name: string): ts.InterfaceDeclaration | undefined =>
    source.statements.find(
        (s): s is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(s) && s.name.text === name
    );

const propertyOf = (
    declaration: ts.InterfaceDeclaration | undefined,
    name: string
): ts.PropertySignature | undefined =>
    declaration?.members.find(
        (m): m is ts.PropertySignature =>
            ts.isPropertySignature(m) && ts.isIdentifier(m.name) && m.name.text === name
    );

/** `components[].signal` -> the `signal` property of the element type of `ExportData.components`. */
const fieldDeclaration = (fieldPath: string): ts.PropertySignature | undefined => {
    const [list, field] = fieldPath.split('[].');
    const listType = propertyOf(interfaceNamed('ExportData'), list)?.type;
    const element =
        listType && ts.isArrayTypeNode(listType) ? listType.elementType.getText(source) : '';
    return propertyOf(interfaceNamed(element), field);
};

describe('docs/json-export.md', () => {
    it('has a section for the current schema version', () => {
        expect(doc).toMatch(new RegExp(`^## Schema ${EXPORT_SCHEMA_VERSION}$`, 'm'));
    });

    it('lists the current schema version in the versions table', () => {
        expect(doc).toMatch(new RegExp(`^\\| \`${EXPORT_SCHEMA_VERSION}\` \\|`, 'm'));
    });

    it.each(DEPRECATED_EXPORT_FIELDS)('lists the deprecated field $path', field => {
        expect(doc).toContain(
            `| \`${field.path}\` | ${field.since} | ${field.removedWithSchema} | ${field.replacement} |`
        );
    });
});

describe('DEPRECATED_EXPORT_FIELDS', () => {
    it.each(DEPRECATED_EXPORT_FIELDS)('$path goes with a later schema', field => {
        expect(field.removedWithSchema).toBeGreaterThan(EXPORT_SCHEMA_VERSION);
    });

    const declared = DEPRECATED_EXPORT_FIELDS.filter(field => !field.undeclared);

    it.each(declared)('$path is marked @deprecated in the interface', field => {
        const declaration = fieldDeclaration(field.path);
        expect(declaration, field.path).toBeDefined();
        const tags = ts.getJSDocTags(declaration as ts.PropertySignature).map(t => t.tagName.text);
        expect(tags).toContain('deprecated');
    });
});
