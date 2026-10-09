import * as path from 'node:path';

import type { ts } from 'ts-morph';

import { mapResult, type Result } from '../../../lib';
import { collectDeclarations, type Declaration } from './declarations';
import { analyzeDi, type DiAnalysis } from './di-facts';
import {
    barrelExports,
    type ExportFacts,
    exportFactsOf,
    findEntryPoints,
    toEntryPoint
} from './entry-points';
import { buildImportGraph } from './imports';
import { factKey, type SemanticModel, type SymbolFacts, type SymbolKey } from './model';
import { createSemanticProgram } from './program';
import { usedByEdges } from './used-by';

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

const symbolFacts = (
    declaration: Declaration,
    exportFacts: ExportFacts,
    di: DiAnalysis,
    usedBy: ReadonlyMap<string, readonly SymbolKey[]>
): SymbolFacts => {
    const key = factKey(declaration.key);
    const sourceFile = declaration.node.getSourceFile();
    return {
        key: declaration.key,
        line:
            sourceFile.getLineAndCharacterOfPosition(declaration.node.getStart(sourceFile)).line +
            1,
        entryPoint: exportFacts.entryPoint,
        exportedBy: exportFacts.exportedBy,
        notExported: exportFacts.notExported,
        di: di.di.get(key),
        token: di.tokens.get(key),
        usedBy: usedBy.get(key) ?? []
    };
};

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
    const declarations = collectDeclarations(sourceFiles, checker, cwd);
    const rootFiles = new Set(sourceFiles);
    const di = analyzeDi(declarations, checker, sourceFile => rootFiles.has(sourceFile));
    const usedBy = usedByEdges(declarations, checker);
    const facts = new Map<string, SymbolFacts>();
    for (const declaration of declarations) {
        const key = factKey(declaration.key);
        if (facts.has(key)) {
            continue;
        }
        const fileName = declaration.node.getSourceFile().fileName;
        facts.set(
            key,
            symbolFacts(
                declaration,
                exportFactsOf(declaration, fileName, entryPoints, exported),
                di,
                usedBy
            )
        );
    }
    const notExported = [...facts.values()].filter(f => f.notExported).length;
    return {
        entryPoints: entryPoints.map(entry => toEntryPoint(entry, cwd)),
        facts,
        summary: {
            entryPoints: entryPoints.length,
            providers: di.counts.providers,
            features: di.counts.features,
            injectionContext: {
                direct: di.counts.direct,
                viaCall: di.counts.viaCall,
                unresolved: di.counts.unresolved
            },
            notExported
        },
        imports: buildImportGraph(
            program,
            sourceFiles.map(sf => sf.fileName),
            cwd
        )
    };
};

/** Build the program over the documented files and derive the facts. */
export const analyzeProject = (input: SemanticInput): Result<SemanticState> =>
    mapResult(
        createSemanticProgram(input.tsconfigPath, input.files, input.previous?.program),
        program => ({ program, model: buildSemanticModel(program, input.tsconfigPath, input.cwd) })
    );
