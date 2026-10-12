import { ts } from 'ts-morph';

/** A program over in-memory files below `/p`; nothing else resolves. */
export const memoryProgram = (files: Record<string, string>): ts.Program => {
    const options: ts.CompilerOptions = {
        noLib: true,
        types: [],
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler
    };
    const host = ts.createCompilerHost(options, true);
    host.fileExists = fileName => fileName in files;
    host.directoryExists = () => true;
    host.readFile = fileName => files[fileName];
    host.getSourceFile = (fileName, version) =>
        fileName in files
            ? ts.createSourceFile(fileName, files[fileName], version, true)
            : undefined;
    return ts.createProgram({ rootNames: Object.keys(files), options, host });
};
