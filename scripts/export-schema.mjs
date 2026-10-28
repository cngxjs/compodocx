// JSON Schema (draft 2020-12) of documentation.json, generated from the
// ExportData interface with the TypeScript checker. `node scripts/export-schema.mjs`
// writes src/data/schemas/documentation.v<schema>.schema.json; the drift spec
// compares a fresh generation with the checked-in file.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INTERFACE_FILE = path.join(ROOT, 'src/app/interfaces/export-data.interface.ts');

export const schemaFileOf = version =>
    path.join(ROOT, 'src/data/schemas', `documentation.v${version}.schema.json`);

const isLibType = (program, symbol) =>
    (symbol?.declarations ?? []).some(d => program.isSourceFileDefaultLibrary(d.getSourceFile()));

const docOf = (checker, symbol) =>
    ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();

const isDeprecated = symbol =>
    (symbol.declarations ?? []).some(d =>
        ts.getJSDocTags(d).some(t => t.tagName.text === 'deprecated')
    );

const dedupe = schemas => {
    const seen = new Map();
    for (const schema of schemas) {
        seen.set(JSON.stringify(schema), schema);
    }
    return [...seen.values()];
};

/** `{ schemaVersion, schema }` for the current `ExportData`. */
export const buildExportSchema = () => {
    const program = ts.createProgram([INTERFACE_FILE], {
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler
    });
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(INTERFACE_FILE);
    const declarationOf = name =>
        source.statements.find(
            s =>
                (ts.isInterfaceDeclaration(s) || ts.isVariableStatement(s)) &&
                namesOf(s).includes(name)
        );
    const namesOf = s =>
        ts.isInterfaceDeclaration(s)
            ? [s.name.text]
            : s.declarationList.declarations.map(d => d.name.getText());

    const versionDeclaration =
        declarationOf('EXPORT_SCHEMA_VERSION').declarationList.declarations[0];
    const schemaVersion = checker.getTypeAtLocation(versionDeclaration).value;

    const defs = new Map();

    /** A named, non-generic interface or alias from the project gets a `$defs` entry. */
    const definitionName = type => {
        const symbol = type.aliasSymbol ?? type.getSymbol();
        if (!symbol || isLibType(program, symbol)) {
            return undefined;
        }
        if (type.aliasTypeArguments?.length || checker.getTypeArguments?.(type)?.length) {
            return undefined;
        }
        const name = symbol.getName();
        return name.startsWith('__') ? undefined : name;
    };

    const objectSchema = type => {
        const properties = {};
        const required = [];
        for (const property of checker.getPropertiesOfType(type)) {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration ?? source);
            const schema = { ...toSchema(propertyType) };
            const description = docOf(checker, property);
            if (description) {
                schema.description = description;
            }
            if (isDeprecated(property)) {
                schema.deprecated = true;
            }
            properties[property.getName()] = schema;
            if (!(property.flags & ts.SymbolFlags.Optional)) {
                required.push(property.getName());
            }
        }
        const schema = { type: 'object', properties };
        if (required.length > 0) {
            schema.required = required;
        }
        const index = checker
            .getIndexInfosOfType(type)
            .find(info => info.keyType.flags & ts.TypeFlags.String);
        schema.additionalProperties = index ? toSchema(index.type) : true;
        return schema;
    };

    const unionSchema = type => {
        const members = type.types.filter(t => !(t.flags & ts.TypeFlags.Undefined));
        const booleans = members.filter(t => t.flags & ts.TypeFlags.BooleanLiteral);
        const rest = members.filter(t => !(t.flags & ts.TypeFlags.BooleanLiteral));
        const parts = booleans.length === 2 ? [{ type: 'boolean' }] : booleans.map(toSchema);
        const literals = rest.filter(
            t => t.flags & (ts.TypeFlags.StringLiteral | ts.TypeFlags.NumberLiteral)
        );
        if (literals.length > 1) {
            parts.push({ enum: literals.map(t => t.value) });
        } else {
            parts.push(...literals.map(toSchema));
        }
        parts.push(...rest.filter(t => !literals.includes(t)).map(toSchema));
        const unique = dedupe(parts);
        if (unique.some(p => Object.keys(p).length === 0)) {
            return {};
        }
        return unique.length === 1 ? unique[0] : { anyOf: unique };
    };

    function toSchema(type) {
        const flags = type.flags;
        if (flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) {
            return {};
        }
        if (flags & ts.TypeFlags.Union) {
            return unionSchema(type);
        }
        if (flags & ts.TypeFlags.StringLiteral || flags & ts.TypeFlags.NumberLiteral) {
            return { const: type.value };
        }
        if (flags & ts.TypeFlags.BooleanLiteral) {
            return { const: type.intrinsicName === 'true' };
        }
        if (flags & ts.TypeFlags.String) {
            return { type: 'string' };
        }
        if (flags & ts.TypeFlags.Number) {
            return { type: 'number' };
        }
        if (flags & ts.TypeFlags.Boolean) {
            return { type: 'boolean' };
        }
        if (flags & ts.TypeFlags.Null) {
            return { type: 'null' };
        }
        if (checker.isTupleType(type)) {
            const items = checker.getTypeArguments(type).map(toSchema);
            return { type: 'array', prefixItems: items, items: false };
        }
        if (checker.isArrayType(type)) {
            return { type: 'array', items: toSchema(checker.getTypeArguments(type)[0]) };
        }
        if (flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) {
            const name = definitionName(type);
            if (!name) {
                return objectSchema(type);
            }
            if (!defs.has(name)) {
                defs.set(name, {});
                const schema = objectSchema(type);
                const description = docOf(checker, type.aliasSymbol ?? type.getSymbol());
                defs.set(name, description ? { description, ...schema } : schema);
            }
            return { $ref: `#/$defs/${name}` };
        }
        throw new Error(`export-schema: no JSON Schema for type ${checker.typeToString(type)}`);
    }

    const exportData = checker.getTypeAtLocation(declarationOf('ExportData'));
    const root = objectSchema(exportData);
    const schema = {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: `compodocx documentation.json, schema ${schemaVersion}`,
        description:
            'Written by `compodocx --exportFormat json`. Generated from src/app/interfaces/export-data.interface.ts; see docs/json-export.md for the version history and the compatibility policy.',
        ...root,
        $defs: Object.fromEntries([...defs.entries()].sort(([a], [b]) => a.localeCompare(b)))
    };
    return { schemaVersion, schema };
};

/** The file content: 4-space JSON with a trailing newline. */
export const serializeSchema = schema => `${JSON.stringify(schema, null, 4)}\n`;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const { schemaVersion, schema } = buildExportSchema();
    const file = schemaFileOf(schemaVersion);
    writeFileSync(file, serializeSchema(schema));
    console.log(`Wrote ${path.relative(ROOT, file)}`);
}
