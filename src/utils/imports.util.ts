import { Project, SyntaxKind, type ts, VariableDeclaration } from 'ts-morph';
import FileEngine from '../app/engines/file.engine';

export class ImportsUtil {
    private static instance: ImportsUtil;
    /** Files read for import lookups; a new project per run, so a rebuild sees edited files. */
    private ast = new Project();
    private constructor() {}
    public static getInstance() {
        if (!ImportsUtil.instance) {
            ImportsUtil.instance = new ImportsUtil();
        }
        return ImportsUtil.instance;
    }

    /** Starts a new project; called at the start of each dependency crawl. */
    public resetProject(): void {
        this.ast = new Project();
    }
    /**
     * Find in imports something like myvar
     * @param  {string} inputVariableName              like myvar
     * @return {[type]}                                myvar value
     */
    public findValueInImportOrLocalVariables(
        inputVariableName: string,
        sourceFile: ts.SourceFile,
        decoratorType?: string
    ) {
        let metadataVariableName = inputVariableName,
            searchedImport,
            aliasOriginalName = '',
            foundWithNamedImport = false,
            _foundWithDefaultImport = false,
            foundWithAlias = false;

        const file =
            typeof this.ast.getSourceFile(sourceFile.fileName) !== 'undefined'
                ? this.ast.getSourceFile(sourceFile.fileName)
                : this.ast.addSourceFileAtPathIfExists(sourceFile.fileName); // tslint:disable-line
        const imports = file.getImportDeclarations();

        /**
         * Loop through all imports, and find one matching inputVariableName
         */
        imports.forEach(i => {
            let namedImports = i.getNamedImports(),
                namedImportsLength = namedImports.length,
                j = 0;

            if (namedImportsLength > 0) {
                for (j; j < namedImportsLength; j++) {
                    let importName = namedImports[j].getNameNode().getText() as string,
                        importAlias;

                    if (namedImports[j].getAliasNode()) {
                        importAlias = namedImports[j].getAliasNode().getText();
                    }
                    if (importName === metadataVariableName) {
                        foundWithNamedImport = true;
                        searchedImport = i;
                        break;
                    }
                    if (importAlias === metadataVariableName) {
                        foundWithNamedImport = true;
                        foundWithAlias = true;
                        aliasOriginalName = importName;
                        searchedImport = i;
                        break;
                    }
                }
            }
            const namespaceImport = i.getNamespaceImport();
            if (namespaceImport) {
                const namespaceImportLocalName = namespaceImport.getText();
                if (namespaceImportLocalName === metadataVariableName) {
                    searchedImport = i;
                }
            }

            if (!foundWithNamedImport) {
                const defaultImport = i.getDefaultImport();
                if (defaultImport) {
                    const defaultImportText = defaultImport.getText();
                    if (defaultImportText === metadataVariableName) {
                        _foundWithDefaultImport = true;
                        searchedImport = i;
                    }
                }
            }
        });

        function hasFoundValues(variableDeclaration) {
            const variableKind = variableDeclaration.getKind();

            if (variableKind && variableKind === SyntaxKind.VariableDeclaration) {
                const initializer = variableDeclaration.getInitializer();
                if (initializer) {
                    const initializerKind = initializer.getKind();
                    if (initializerKind && initializerKind === SyntaxKind.ObjectLiteralExpression) {
                        const compilerNode = initializer.compilerNode as ts.ObjectLiteralExpression;
                        return compilerNode.properties;
                    }
                }
            }
        }

        if (typeof searchedImport !== 'undefined') {
            const importPathReference = searchedImport.getModuleSpecifierSourceFile();
            let importPath;
            if (typeof importPathReference !== 'undefined') {
                importPath = importPathReference.compilerNode.fileName;

                const sourceFileImport =
                    typeof this.ast.getSourceFile(importPath) !== 'undefined'
                        ? this.ast.getSourceFile(importPath)
                        : this.ast.addSourceFileAtPathIfExists(importPath); // tslint:disable-line

                if (sourceFileImport) {
                    const variableName = foundWithAlias ? aliasOriginalName : metadataVariableName;
                    const variableDeclaration =
                        sourceFileImport.getVariableDeclaration(variableName);

                    if (variableDeclaration) {
                        return hasFoundValues(variableDeclaration);
                    } else {
                        // Try with exports
                        const exportDeclarations = sourceFileImport.getExportedDeclarations();

                        if (exportDeclarations && exportDeclarations.size > 0) {
                            for (const [
                                _exportDeclarationKey,
                                exportDeclarationValues
                            ] of exportDeclarations) {
                                const found = exportDeclarationValues.find(
                                    value =>
                                        value instanceof VariableDeclaration &&
                                        value.getName() === variableName
                                );
                                if (found) {
                                    return hasFoundValues(found);
                                }
                            }
                        }
                    }
                }
            }
            if (
                !importPathReference &&
                decoratorType === 'template' &&
                searchedImport.getModuleSpecifierValue().indexOf('.html') !== -1
            ) {
                // @ts-expect-error
                const originalSourceFilePath = sourceFile.path;
                const originalSourceFilePathFolder = originalSourceFilePath.substring(
                    0,
                    originalSourceFilePath.lastIndexOf('/')
                );
                const finalImportedPath = `${originalSourceFilePathFolder}/${searchedImport.getModuleSpecifierValue()}`;
                const finalImportedPathData = FileEngine.getSync(finalImportedPath);
                return finalImportedPathData;
            }
        } else {
            // Find in local variables of the file
            const variableDeclaration = file.getVariableDeclaration(metadataVariableName);
            if (variableDeclaration) {
                const variableKind = variableDeclaration.getKind();

                if (variableKind && variableKind === SyntaxKind.VariableDeclaration) {
                    const initializer = variableDeclaration.getInitializer();
                    if (initializer) {
                        const initializerKind = initializer.getKind();
                        if (
                            initializerKind &&
                            initializerKind === SyntaxKind.ObjectLiteralExpression
                        ) {
                            const compilerNode =
                                initializer.compilerNode as ts.ObjectLiteralExpression;
                            return compilerNode.properties;
                        } else if (
                            initializerKind &&
                            (initializerKind === SyntaxKind.StringLiteral ||
                                initializerKind === SyntaxKind.NoSubstitutionTemplateLiteral)
                        ) {
                            if (decoratorType === 'template') {
                                return initializer.getText();
                            } else {
                                return variableDeclaration.compilerNode;
                            }
                        } else if (initializerKind) {
                            return variableDeclaration.compilerNode;
                        }
                    }
                }
            }
        }

        return [];
    }
}

export default ImportsUtil.getInstance();
