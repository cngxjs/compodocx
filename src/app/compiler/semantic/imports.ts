import * as path from 'node:path';

import { ts } from 'ts-morph';

import { relativeFile } from './declarations';
import { compareText } from './model';

/** Static imports between project files. */
export interface ImportGraph {
    /** File -> imported files, both relative to the cwd, targets sorted. */
    readonly edges: ReadonlyMap<string, readonly string[]>;
}

const isInNodeModules = (fileName: string): boolean => /[\\/]node_modules([\\/]|$)/.test(fileName);

const moduleSpecifiers = (sourceFile: ts.SourceFile): readonly ts.StringLiteral[] =>
    sourceFile.statements.flatMap(statement =>
        (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
        statement.moduleSpecifier &&
        ts.isStringLiteral(statement.moduleSpecifier)
            ? [statement.moduleSpecifier]
            : []
    );

/**
 * Edges from every `import` and `export ... from` of `files` to the project
 * files they resolve to, resolved with the program's compiler options
 * (relative and path-mapped specifiers; `node_modules` is never searched). Type-only imports count. Targets outside the
 * program, declaration files and self imports are dropped.
 */
export const buildImportGraph = (
    program: ts.Program,
    files: readonly string[],
    cwd: string
): ImportGraph => {
    const options = program.getCompilerOptions();
    const host: ts.ModuleResolutionHost = {
        fileExists: fileName => !isInNodeModules(fileName) && ts.sys.fileExists(fileName),
        readFile: fileName => ts.sys.readFile(fileName),
        directoryExists: dir => !isInNodeModules(dir) && ts.sys.directoryExists(dir),
        realpath: ts.sys.realpath,
        getCurrentDirectory: () => ts.sys.getCurrentDirectory()
    };
    const cache = ts.createModuleResolutionCache(
        ts.sys.getCurrentDirectory(),
        fileName => (ts.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase()),
        options
    );
    const edges = new Map<string, readonly string[]>();
    for (const fileName of files) {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            continue;
        }
        const from = relativeFile(cwd, sourceFile.fileName);
        const targets = new Set<string>();
        for (const specifier of moduleSpecifiers(sourceFile)) {
            const resolved = ts.resolveModuleName(
                specifier.text,
                sourceFile.fileName,
                options,
                host,
                cache
            ).resolvedModule?.resolvedFileName;
            const target = resolved && program.getSourceFile(resolved);
            if (!target || target.isDeclarationFile || target === sourceFile) {
                continue;
            }
            targets.add(relativeFile(cwd, path.resolve(target.fileName)));
        }
        if (targets.size > 0) {
            edges.set(from, [...targets].sort(compareText));
        }
    }
    return { edges };
};
