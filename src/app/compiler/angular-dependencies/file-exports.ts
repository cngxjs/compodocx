import { ts } from 'ts-morph';

const hasExportKeyword = (node: ts.Node): boolean =>
    !!ts.canHaveModifiers(node) &&
    !!ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword);

/**
 * Local names a module file exports without the `export` keyword on the
 * declaration: `export { a, b as c }` (no module specifier), `export default a`
 * and `export = a`. Re-exports from other modules are not local declarations.
 */
export const localExportNames = (sourceFile: ts.SourceFile): ReadonlySet<string> => {
    const names = new Set<string>();
    for (const statement of sourceFile.statements) {
        if (
            ts.isExportDeclaration(statement) &&
            !statement.moduleSpecifier &&
            statement.exportClause &&
            ts.isNamedExports(statement.exportClause)
        ) {
            for (const element of statement.exportClause.elements) {
                names.add((element.propertyName ?? element.name).text);
            }
        }
        if (ts.isExportAssignment(statement) && ts.isIdentifier(statement.expression)) {
            names.add(statement.expression.text);
        }
    }
    return names;
};

/**
 * Whether a top-level declaration is part of what its file exports. A script
 * file (no import or export) has no module boundary, so all of it counts.
 */
export const isExportedFromFile = (
    node: ts.Node,
    name: string,
    sourceFile: ts.SourceFile,
    exportNames: ReadonlySet<string>
): boolean => !ts.isExternalModule(sourceFile) || hasExportKeyword(node) || exportNames.has(name);
