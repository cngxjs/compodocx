import * as path from 'node:path';

import type { ts } from 'ts-morph';

import { mapResult, type Result } from '../../../lib';
import { collectDeclarations, type Declaration } from './declarations';
import {
    barrelExports,
    type ExportFacts,
    exportFactsOf,
    findEntryPoints,
    toEntryPoint
} from './entry-points';
import { factKey, type SemanticModel, type SymbolFacts } from './model';
import { createSemanticProgram } from './program';

/** The program and the facts derived from it, kept for one run. */
export interface SemanticState {
    readonly program: ts.Program;
    readonly model: SemanticModel;
}

export interface SemanticInput {
    /** Absolute path of the `-p` tsconfig. */
    readonly tsconfigPath: string;
    /** The documented files, as handed to the crawler. */
    readonly files: readonly string[];
    /** Base of every relative path in the model. */
    readonly cwd: string;
    /** Program of the previous run in watch mode. */
    readonly previous?: SemanticState;
}

const isSameOrInside = (dir: string, other: string): boolean =>
    other === dir || other.startsWith(dir + path.sep);

/**
 * The directory searched for entry points: the cwd when the tsconfig lies
 * inside it or above it, else the tsconfig's directory.
 */
export const workspaceRootOf = (tsconfigPath: string, cwd: string): string => {
    const tsconfigDir = path.dirname(tsconfigPath);
    return isSameOrInside(cwd, tsconfigDir) || isSameOrInside(tsconfigDir, cwd) ? cwd : tsconfigDir;
};

const rootSourceFiles = (program: ts.Program): readonly ts.SourceFile[] =>
    program
        .getRootFileNames()
        .map(file => program.getSourceFile(file))
        .filter((sf): sf is ts.SourceFile => sf !== undefined);

const symbolFacts = (declaration: Declaration, exportFacts: ExportFacts): SymbolFacts => ({
    key: declaration.key,
    entryPoint: exportFacts.entryPoint,
    exportedBy: exportFacts.exportedBy,
    notExported: exportFacts.notExported,
    usedBy: []
});

/** Derive the facts of every top-level declaration of the root files. */
export const buildSemanticModel = (
    program: ts.Program,
    tsconfigPath: string,
    cwd: string
): SemanticModel => {
    const checker = program.getTypeChecker();
    const sourceFiles = rootSourceFiles(program);
    const entryPoints = findEntryPoints(
        program,
        sourceFiles.map(sf => sf.fileName),
        workspaceRootOf(tsconfigPath, cwd),
        cwd
    );
    const exported = barrelExports(program, checker, entryPoints);
    const facts = new Map<string, SymbolFacts>();
    for (const declaration of collectDeclarations(sourceFiles, checker, cwd)) {
        const key = factKey(declaration.key);
        if (facts.has(key)) {
            continue;
        }
        const fileName = declaration.node.getSourceFile().fileName;
        facts.set(
            key,
            symbolFacts(declaration, exportFactsOf(declaration, fileName, entryPoints, exported))
        );
    }
    const notExported = [...facts.values()].filter(f => f.notExported).length;
    return {
        entryPoints: entryPoints.map(entry => toEntryPoint(entry, cwd)),
        facts,
        summary: {
            entryPoints: entryPoints.length,
            providers: 0,
            features: 0,
            injectionContext: { direct: 0, viaCall: 0, unresolved: 0 },
            notExported
        }
    };
};

/** Build the program over the documented files and derive the facts. */
export const analyzeProject = (input: SemanticInput): Result<SemanticState> =>
    mapResult(
        createSemanticProgram(input.tsconfigPath, input.files, input.previous?.program),
        program => ({ program, model: buildSemanticModel(program, input.tsconfigPath, input.cwd) })
    );
