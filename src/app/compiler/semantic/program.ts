import { ts } from 'ts-morph';

import { err, ok, type Result } from '../../../lib';

/** "No inputs were found": the root files come from the caller, not from the tsconfig. */
const NO_INPUTS = 18003;

const isInNodeModules = (fileName: string): boolean => /[\\/]node_modules[\\/]/.test(fileName);

const formatDiagnostic = (diagnostic: ts.Diagnostic): string =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

/**
 * Compiler options from the tsconfig, following `extends`, `paths` and
 * `baseUrl`. Nothing is emitted and no library or `@types` file is loaded.
 */
export const readSemanticOptions = (tsconfigPath: string): Result<ts.CompilerOptions> => {
    let unrecoverable: ts.Diagnostic | undefined;
    const parsed = ts.getParsedCommandLineOfConfigFile(
        tsconfigPath,
        {},
        {
            ...ts.sys,
            onUnRecoverableConfigFileDiagnostic: diagnostic => {
                unrecoverable = diagnostic;
            }
        }
    );
    if (unrecoverable || !parsed) {
        return err(unrecoverable ? formatDiagnostic(unrecoverable) : `cannot read ${tsconfigPath}`);
    }
    const errors = parsed.errors.filter(
        d => d.category === ts.DiagnosticCategory.Error && d.code !== NO_INPUTS
    );
    if (errors.length > 0) {
        return err(errors.map(formatDiagnostic).join('\n'));
    }
    return ok({ ...parsed.options, noEmit: true, noLib: true, types: [] });
};

/**
 * A compiler host that only loads project files: every path under
 * `node_modules` is reported missing, so imports of packages stay
 * unresolved and the program stays small. A file whose text is unchanged
 * since `oldProgram` is handed back as the same source file object.
 */
const projectOnlyHost = (options: ts.CompilerOptions, oldProgram?: ts.Program): ts.CompilerHost => {
    const host = ts.createCompilerHost(options, true);
    const unchanged = (fileName: string): ts.SourceFile | undefined => {
        const previous = oldProgram?.getSourceFile(fileName);
        return previous && host.readFile(fileName) === previous.text ? previous : undefined;
    };
    return {
        ...host,
        fileExists: fileName => !isInNodeModules(fileName) && host.fileExists(fileName),
        getSourceFile: (fileName, languageVersion, onError, shouldCreate) => {
            if (isInNodeModules(fileName)) {
                return undefined;
            }
            return (
                unchanged(fileName) ??
                host.getSourceFile(fileName, languageVersion, onError, shouldCreate)
            );
        }
    };
};

/**
 * One program over the documented files with the project's module
 * resolution. Files that `paths` pulls in from outside `rootFiles` load as
 * non-root files. `oldProgram` lets TypeScript reuse unchanged source files.
 */
export const createSemanticProgram = (
    tsconfigPath: string,
    rootFiles: readonly string[],
    oldProgram?: ts.Program
): Result<ts.Program> => {
    const options = readSemanticOptions(tsconfigPath);
    if (!options.ok) {
        return options;
    }
    return ok(
        ts.createProgram({
            rootNames: rootFiles,
            options: options.value,
            host: projectOnlyHost(options.value, oldProgram),
            oldProgram
        })
    );
};
