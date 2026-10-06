import * as fs from 'node:fs';
import * as path from 'node:path';

import { ts } from 'ts-morph';

import { type Declaration, relativeFile, resolveAlias } from './declarations';
import { compareText, type EntryPoint } from './model';

/** An entry point with absolute paths, as used during the analysis. */
export interface ResolvedEntryPoint {
    readonly importPath: string;
    readonly file: string;
    readonly root: string;
    readonly source: EntryPoint['source'];
}

const NG_PACKAGE = 'ng-package.json';
const DEFAULT_ENTRY_FILE = 'src/public-api.ts';

const isInside = (dir: string, file: string): boolean => file.startsWith(dir + path.sep);

const readJson = (file: string): Record<string, unknown> | undefined => {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return undefined;
    }
};

/** Directories from `dir` up to and including `top`; empty when `dir` is outside `top`. */
const ancestors = (dir: string, top: string): readonly string[] => {
    if (dir !== top && !isInside(top, dir)) {
        return [];
    }
    return dir === top ? [dir] : [dir, ...ancestors(path.dirname(dir), top)];
};

/** Import path from the nearest `package.json` at or above `dir`, inside the workspace. */
const importPathOf = (dir: string, workspaceRoot: string): string | undefined => {
    for (const candidate of ancestors(dir, workspaceRoot)) {
        const manifest = path.join(candidate, 'package.json');
        if (!fs.existsSync(manifest)) {
            continue;
        }
        const name = readJson(manifest)?.name;
        if (typeof name !== 'string') {
            return undefined;
        }
        const sub = path.relative(candidate, dir).split(path.sep).join('/');
        return sub ? `${name}/${sub}` : name;
    }
    return undefined;
};

/**
 * `ng-package.json` files that own at least one root file, found by walking
 * up from each root file's directory to the workspace root.
 */
const ngPackageEntryPoints = (
    rootFiles: readonly string[],
    workspaceRoot: string,
    cwd: string
): readonly ResolvedEntryPoint[] => {
    const visited = new Set<string>();
    const found: ResolvedEntryPoint[] = [];
    for (const file of rootFiles) {
        for (const dir of ancestors(path.dirname(file), workspaceRoot)) {
            if (visited.has(dir)) {
                break;
            }
            visited.add(dir);
            const manifest = path.join(dir, NG_PACKAGE);
            if (!fs.existsSync(manifest)) {
                continue;
            }
            const lib = readJson(manifest)?.lib as { entryFile?: unknown } | undefined;
            const entryFile =
                typeof lib?.entryFile === 'string' ? lib.entryFile : DEFAULT_ENTRY_FILE;
            const entry = path.resolve(dir, entryFile);
            found.push({
                importPath: importPathOf(dir, workspaceRoot) ?? relativeFile(cwd, entry),
                file: entry,
                root: dir,
                source: 'ng-package'
            });
        }
    }
    return found;
};

const isBarrel = (sourceFile: ts.SourceFile): boolean =>
    sourceFile.statements.some(
        statement => ts.isExportDeclaration(statement) && statement.moduleSpecifier !== undefined
    );

/**
 * tsconfig `paths` keys without a wildcard and with exactly one target that
 * is a project file shaped like a barrel (at least one `export ... from`).
 */
const pathsEntryPoints = (program: ts.Program): readonly ResolvedEntryPoint[] => {
    const options = program.getCompilerOptions();
    const base = options.baseUrl ?? (options.pathsBasePath as string | undefined);
    if (!options.paths || !base) {
        return [];
    }
    return Object.entries(options.paths).flatMap(([key, targets]) => {
        if (key.includes('*') || targets.length !== 1) {
            return [];
        }
        const file = path.resolve(base, targets[0]);
        const sourceFile = program.getSourceFile(file);
        if (!sourceFile || sourceFile.isDeclarationFile || !isBarrel(sourceFile)) {
            return [];
        }
        return [{ importPath: key, file, root: path.dirname(file), source: 'tsconfig-paths' }];
    });
};

/**
 * The project's entry points: `ng-package.json` entry files and barrel-shaped
 * tsconfig `paths` targets. An entry file found by both keeps `ng-package`.
 * Only entry files that are part of the program count.
 */
export const findEntryPoints = (
    program: ts.Program,
    rootFiles: readonly string[],
    workspaceRoot: string,
    cwd: string
): readonly ResolvedEntryPoint[] => {
    const byFile = new Map<string, ResolvedEntryPoint>();
    const all = [
        ...ngPackageEntryPoints(rootFiles, workspaceRoot, cwd),
        ...pathsEntryPoints(program)
    ];
    for (const entry of all) {
        if (!byFile.has(entry.file) && program.getSourceFile(entry.file)) {
            byFile.set(entry.file, entry);
        }
    }
    return [...byFile.values()].sort((a, b) => compareText(a.importPath, b.importPath));
};

/** Resolved symbol -> import paths of every barrel that exports it. */
export const barrelExports = (
    program: ts.Program,
    checker: ts.TypeChecker,
    entryPoints: readonly ResolvedEntryPoint[]
): ReadonlyMap<ts.Symbol, ReadonlySet<string>> => {
    const exported = new Map<ts.Symbol, Set<string>>();
    for (const entry of entryPoints) {
        const sourceFile = program.getSourceFile(entry.file);
        const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
        if (!moduleSymbol) {
            continue;
        }
        for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
            const target = resolveAlias(checker, symbol);
            if (!target) {
                continue;
            }
            const importPaths = exported.get(target) ?? new Set<string>();
            importPaths.add(entry.importPath);
            exported.set(target, importPaths);
        }
    }
    return exported;
};

const isInternal = (declaration: Declaration): boolean =>
    ts.getJSDocTags(declaration.node).some(tag => tag.tagName.text === 'internal');

export interface ExportFacts {
    readonly entryPoint?: string;
    readonly exportedBy: readonly string[];
    readonly notExported: boolean;
}

const byLengthThenText = (a: string, b: string): number =>
    a.length === b.length ? compareText(a, b) : a.length - b.length;

/**
 * Entry point, exporting barrels and the "not exported" flag of one
 * declaration. The owner is the entry point whose root is the longest
 * prefix of the declaring file; when it does not export the symbol, the
 * shortest exporting import path wins.
 */
export const exportFactsOf = (
    declaration: Declaration,
    fileName: string,
    entryPoints: readonly ResolvedEntryPoint[],
    exported: ReadonlyMap<ts.Symbol, ReadonlySet<string>>
): ExportFacts => {
    const owner = entryPoints
        .filter(entry => isInside(entry.root, fileName))
        .reduce<ResolvedEntryPoint | undefined>(
            (best, entry) => (!best || entry.root.length > best.root.length ? entry : best),
            undefined
        );
    const importPaths = declaration.symbol ? exported.get(declaration.symbol) : undefined;
    if (importPaths && importPaths.size > 0) {
        const exportedBy = [...importPaths].sort(compareText);
        const entryPoint =
            owner && importPaths.has(owner.importPath)
                ? owner.importPath
                : [...exportedBy].sort(byLengthThenText)[0];
        return { entryPoint, exportedBy, notExported: false };
    }
    const notExported = declaration.exported && owner !== undefined && !isInternal(declaration);
    return { exportedBy: [], notExported };
};

export const toEntryPoint = (entry: ResolvedEntryPoint, cwd: string): EntryPoint => ({
    importPath: entry.importPath,
    file: relativeFile(cwd, entry.file),
    root: relativeFile(cwd, entry.root),
    source: entry.source
});
