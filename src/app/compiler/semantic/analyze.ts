import type { ts } from 'ts-morph';

import { mapResult, type Result } from '../../../lib';
import { emptyModel, type SemanticModel } from './model';
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

/** Build the program over the documented files and derive the facts. */
export const analyzeProject = (input: SemanticInput): Result<SemanticState> =>
    mapResult(
        createSemanticProgram(input.tsconfigPath, input.files, input.previous?.program),
        program => ({ program, model: emptyModel() })
    );
