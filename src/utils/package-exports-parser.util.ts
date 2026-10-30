import * as path from 'node:path';
import fg from 'fast-glob';
import * as fs from 'fs-extra';
import { ts } from 'ts-morph';

/** Public names per import path, read from the declaration files a dist's `package.json` files name. */
export interface PackageTypesExports {
    /** `@scope/pkg` or `@scope/pkg/sub` -> names its declaration file exports. */
    readonly byImportPath: Map<string, Set<string>>;
    /** Declaration files read. */
    readonly typesFiles: number;
}

/** The `types` target of one `exports` entry, searched through nested conditions. */
export const typesTarget = (entry: unknown): string | undefined => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return undefined;
    }
    const conditions = entry as Record<string, unknown>;
    if (typeof conditions.types === 'string') {
        return conditions.types;
    }
    for (const value of Object.values(conditions)) {
        const found = typesTarget(value);
        if (found) {
            return found;
        }
    }
    return undefined;
};

/** `.` -> `name`, `./sub` -> `name/sub`. */
const importPathOf = (name: string, subpath: string): string =>
    subpath === '.' ? name : `${name}/${subpath.replace(/^\.\//, '')}`;

/**
 * Import path -> declaration file (relative to the manifest) for every
 * `exports` entry with a `types` target; wildcard subpaths are skipped.
 * Without an `exports` map, the top-level `types` or `typings` is the root entry.
 */
export const typesEntries = (manifest: Record<string, unknown>): ReadonlyMap<string, string> => {
    const name = manifest.name;
    const entries = new Map<string, string>();
    if (typeof name !== 'string') {
        return entries;
    }
    const exportsMap = manifest.exports;
    if (exportsMap && typeof exportsMap === 'object' && !Array.isArray(exportsMap)) {
        for (const [subpath, entry] of Object.entries(exportsMap as Record<string, unknown>)) {
            const target = typesTarget(entry);
            if (subpath.startsWith('.') && !subpath.includes('*') && target) {
                entries.set(importPathOf(name, subpath), target);
            }
        }
        return entries;
    }
    const root = manifest.types ?? manifest.typings;
    if (typeof root === 'string') {
        entries.set(name, root);
    }
    return entries;
};

const hasExportModifier = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(m => m.kind === ts.SyntaxKind.ExportKeyword);

const declaredNames = (statement: ts.Statement): readonly string[] => {
    if (ts.isVariableStatement(statement)) {
        return statement.declarationList.declarations
            .map(d => d.name)
            .filter(ts.isIdentifier)
            .map(n => n.text);
    }
    const name = ts.getNameOfDeclaration(statement as ts.DeclarationStatement);
    return name && ts.isIdentifier(name) ? [name.text] : [];
};

/**
 * Names a flattened declaration file exports: `export { a, b as c }`,
 * `export type { ... }`, `export * as ns` and exported declarations.
 * `export *` lists no names and is not followed.
 */
export const exportedNames = (fileName: string, text: string): ReadonlySet<string> => {
    const sourceFile = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
    const names = new Set<string>();
    for (const statement of sourceFile.statements) {
        if (ts.isExportDeclaration(statement)) {
            const clause = statement.exportClause;
            if (clause && ts.isNamedExports(clause)) {
                for (const element of clause.elements) {
                    names.add(element.name.text);
                }
            } else if (clause && ts.isNamespaceExport(clause)) {
                names.add(clause.name.text);
            }
        } else if (hasExportModifier(statement)) {
            for (const name of declaredNames(statement)) {
                names.add(name);
            }
        }
    }
    return names;
};

const readManifest = (file: string): Record<string, unknown> | undefined => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
};

/**
 * Public names per import path from every `package.json` below `distPath`
 * (Angular Package Format: `exports[*].types` -> `types/<pkg>.d.ts`).
 */
export async function parsePackageTypesExports(distPath: string): Promise<PackageTypesExports> {
    const root = path.resolve(distPath);
    const byImportPath = new Map<string, Set<string>>();
    let typesFiles = 0;
    if (!fs.existsSync(root)) {
        return { byImportPath, typesFiles };
    }
    // The pattern stays relative: Windows backslashes or a `(` in the folder
    // name would be read as glob syntax.
    const manifests = await fg('**/package.json', {
        cwd: root,
        absolute: true,
        ignore: ['**/node_modules/**']
    });
    for (const manifestFile of manifests.sort()) {
        const manifest = readManifest(manifestFile);
        if (!manifest) {
            continue;
        }
        for (const [importPath, target] of typesEntries(manifest)) {
            const typesFile = path.resolve(path.dirname(manifestFile), target);
            if (!fs.existsSync(typesFile)) {
                continue;
            }
            typesFiles++;
            const names = byImportPath.get(importPath) ?? new Set<string>();
            for (const name of exportedNames(typesFile, fs.readFileSync(typesFile, 'utf8'))) {
                names.add(name);
            }
            byImportPath.set(importPath, names);
        }
    }
    return { byImportPath, typesFiles };
}
