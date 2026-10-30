import * as path from 'node:path';

import { ts } from 'ts-morph';

import { resolveAlias } from './declarations';
import type { EntryPoint } from './model';

const add = (map: Map<string, Set<string>>, name: string, file: string): void => {
    const files = map.get(name) ?? new Set<string>();
    files.add(file);
    map.set(name, files);
};

const declaredName = (declaration: ts.Declaration, fallback: string): string => {
    const name = ts.getNameOfDeclaration(declaration);
    return name && ts.isIdentifier(name) ? name.text : fallback;
};

/** Declarations behind the export `name` of `file`; empty when the file does not export it. */
const declarationsOf = (
    program: ts.Program,
    checker: ts.TypeChecker,
    name: string,
    file: string
): readonly ts.Declaration[] => {
    const sourceFile = program.getSourceFile(file);
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
        return [];
    }
    const target = resolveAlias(checker, checker.tryGetMemberInModuleExports(name, moduleSymbol));
    return target?.declarations ?? [];
};

/**
 * The public API map with every recorded (name, file) pair followed to the
 * declarations it exports: a name recorded against a barrel also allows the
 * declaring file and the declared name (re-exports, `export *`, aliases,
 * nested barrels). Recorded pairs are kept as they are.
 */
export const resolvePublicApi = (
    program: ts.Program,
    recorded: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, Set<string>> => {
    const checker = program.getTypeChecker();
    const resolved = new Map<string, Set<string>>();
    for (const [name, files] of recorded) {
        for (const file of files) {
            const absolute = path.resolve(file);
            add(resolved, name, absolute);
            for (const declaration of declarationsOf(program, checker, name, absolute)) {
                add(
                    resolved,
                    declaredName(declaration, name),
                    path.resolve(declaration.getSourceFile().fileName)
                );
            }
        }
    }
    return resolved;
};

/**
 * Names per import path (from a dist's `exports[*].types` files) recorded
 * against the entry file of the source entry point with that import path;
 * `unmatched` lists the import paths without one.
 */
export const recordEntryExports = (
    byImportPath: ReadonlyMap<string, ReadonlySet<string>>,
    entryPoints: readonly EntryPoint[]
): { readonly recorded: Map<string, Set<string>>; readonly unmatched: readonly string[] } => {
    const entryFiles = new Map(entryPoints.map(entry => [entry.importPath, entry.file]));
    const recorded = new Map<string, Set<string>>();
    const unmatched: string[] = [];
    for (const [importPath, names] of byImportPath) {
        const file = entryFiles.get(importPath);
        if (!file) {
            unmatched.push(importPath);
            continue;
        }
        for (const name of names) {
            add(recorded, name, path.resolve(file));
        }
    }
    return { recorded, unmatched: unmatched.sort() };
};
