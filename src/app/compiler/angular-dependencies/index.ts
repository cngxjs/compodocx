import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { Project, SyntaxKind, ts } from 'ts-morph';
import { isIgnore, JsdocParserUtil } from '../../../utils';
import ExtendsMerger from '../../../utils/extends-merger.util';
import ImportsUtil from '../../../utils/imports.util';
import { logger } from '../../../utils/logger';
import { markedAcl } from '../../../utils/marked.acl';
import { getNodeDecorators, nodeHasDecorator } from '../../../utils/node.util';
import { cleanLifecycleHooksFromMethods } from '../../../utils/utils';
import Configuration from '../../configuration';
import ComponentsTreeEngine from '../../engines/components-tree.engine';
import type {
    IDep,
    IEnumDecDep,
    IFunctionDecDep,
    IInjectableDep,
    IInterfaceDep,
    IPipeDep,
    IServiceDep,
    ITypeAliasDecDep
} from '../angular/dependencies.interfaces';
import { ComponentDepFactory } from '../angular/deps/component-dep.factory';
import { DirectiveDepFactory } from '../angular/deps/directive-dep.factory';
import { EntityDepFactory } from '../angular/deps/entity-dep.factory';
import { JsDocHelper } from '../angular/deps/helpers/js-doc-helper';
import { FrameworkDependencies } from '../framework-dependencies';
import { type LegacyFinding, scanLegacy, sortLegacyFindings } from '../legacy-scan';
import { isAngularServiceDecorator, serviceOptions } from './angular-service';
import { EntityVisitor } from './entity-visitor';
import { ExpressionFinder } from './expression-finder';
import { isExportedFromFile, localExportNames } from './file-exports';
import { IoExtractor } from './io-extractor';
import { JsdocTags } from './jsdoc-tags';
import { MetadataPredicates } from './metadata-predicates';
import { ProviderDetector } from './provider-detector';
import { PublicApiFilter } from './public-api-filter';

// TypeScript reference : https://github.com/Microsoft/TypeScript/blob/master/lib/typescript.d.ts

/**
 * A variable statement with a declaration annotated with the bare type name
 * `Routes`. Such a variable is documented only when it is exported (the
 * behaviour of the former route parser, kept so the documented set of
 * variables does not change).
 */
const hasBareRoutesType = (node: ts.VariableStatement): boolean =>
    node.declarationList.declarations.some(
        declaration =>
            declaration.type !== undefined &&
            ts.isTypeReferenceNode(declaration.type) &&
            ts.isIdentifier(declaration.type.typeName) &&
            declaration.type.typeName.text === 'Routes'
    );

export class AngularDependencies extends FrameworkDependencies {
    private jsDocHelper = new JsDocHelper();
    private jsdocParserUtil = new JsdocParserUtil();
    private metadataPredicates = new MetadataPredicates();
    private jsdocTags = new JsdocTags(this.jsdocParserUtil);
    private publicApiFilter = new PublicApiFilter();
    /** Files read for import aliases; a new project per crawl, so a rebuild sees edited files. */
    private project = new Project();
    private expressionFinder = new ExpressionFinder();
    private providerDetector = new ProviderDetector();
    private ioExtractor: IoExtractor;
    private entityVisitor: EntityVisitor;

    constructor(files: string[], options: any) {
        super(files, options);
        this.ioExtractor = new IoExtractor(this.classHelper);
        this.entityVisitor = new EntityVisitor(
            this.classHelper,
            this.jsdocParserUtil,
            this.jsdocTags
        );
        this.publicApiFilter.initializePublicApiFiltering();
    }

    public getDependencies() {
        this.project = new Project();
        ImportsUtil.resetProject();
        let deps = {
            aliases: {},
            components: [],
            entities: [],
            injectables: [],
            services: [],
            tokens: [],
            interceptors: [],
            guards: [],
            pipes: [],
            directives: [],
            classes: [],
            interfaces: [],
            typescriptImports: [],
            miscellaneous: {
                variables: [],
                functions: [],
                typealiases: [],
                enumerations: []
            },
            appConfig: [],
            legacyFindings: [] as readonly LegacyFinding[]
        };

        const sourceFiles = this.program.getSourceFiles() || [];

        sourceFiles.map((file: ts.SourceFile) => {
            const filePath = file.fileName;

            if (path.extname(filePath) === '.ts' || path.extname(filePath) === '.tsx') {
                if (
                    filePath.lastIndexOf('.d.ts') === -1 &&
                    filePath.lastIndexOf('spec.ts') === -1
                ) {
                    logger.info('parsing', filePath);
                    this.getTypescriptExportsAliases(file, deps);
                    this.getTypescriptImportsAliases(file, deps);
                    this.getSourceFileDecorators(file, deps);
                    deps.legacyFindings = [...deps.legacyFindings, ...scanLegacy(file)];
                }
            }

            return deps;
        });

        /**
         * If one thing extends another, merge them, only for internal sources
         * - classes
         * - components
         * - injectables
         * - directives
         * for
         * - inputs
         * - outputs
         * - properties
         * - methods
         */
        deps = ExtendsMerger.merge(deps);
        deps.legacyFindings = sortLegacyFindings(deps.legacyFindings);

        return deps;
    }

    private processClass(node, file, srcFile, outputSymbols, fileBody, astFile) {
        const name = this.expressionFinder.getSymboleName(node);
        const IO = this.ioExtractor.getClassIO(file, srcFile, node, fileBody, astFile);
        const sourceCode = srcFile.getText();
        const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
        const deps: any = {
            name,
            id: `class-${name}-${hash}`,
            file: file,
            deprecated: IO.deprecated,
            deprecationMessage: IO.deprecationMessage,
            type: 'class',
            sourceCode: srcFile.getText(),
            storybookUrl: IO.storybookUrl || '',
            figmaUrl: IO.figmaUrl || '',
            stackblitzUrl: IO.stackblitzUrl || '',
            githubUrl: IO.githubUrl || '',
            docsUrl: IO.docsUrl || '',
            ...(IO.aiGenerated && { aiGenerated: IO.aiGenerated }),
            ...(IO.since && { since: IO.since }),
            ...(IO.wcagLevel && { wcagLevel: IO.wcagLevel }),
            ...(IO.a11yNote && { a11yNote: IO.a11yNote }),
            ...(IO.taggedSelector && { taggedSelector: IO.taggedSelector }),
            ...(IO.relatedTo && IO.relatedTo.length > 0 && { relatedTo: IO.relatedTo })
        };

        if (IO.constructor && !Configuration.mainData.disableConstructors) {
            deps.constructorObj = IO.constructor;
        }
        deps.inputsClass = IO.inputs ?? [];
        deps.outputsClass = IO.outputs ?? [];
        if (IO.properties) {
            const { inputSignals, outputSignals, properties } =
                this.componentHelper.getInputOutputSignals(IO.properties);

            deps.inputsClass = deps.inputsClass.concat(inputSignals);
            deps.outputsClass = deps.outputsClass.concat(outputSignals);
            deps.properties = properties;
        }
        if (IO.description) {
            deps.description = IO.description;
        }
        if (IO.rawdescription) {
            deps.rawdescription = IO.rawdescription;
        }
        if (IO.methods) {
            deps.methods = IO.methods;
        }
        if (IO.indexSignatures) {
            deps.indexSignatures = IO.indexSignatures;
        }
        if (IO.extends) {
            deps.extends = IO.extends;
        }
        if (IO.jsdoctags && IO.jsdoctags.length > 0) {
            deps.jsdoctags = (IO.jsdoctags[0] as any).tags;
        }
        if (IO.accessors) {
            deps.accessors = IO.accessors;
        }

        if (IO.hostBindings) {
            deps.hostBindings = IO.hostBindings;
        }
        if (IO.hostListeners) {
            deps.hostListeners = IO.hostListeners;
        }
        if (Configuration.mainData.disableLifeCycleHooks) {
            deps.methods = cleanLifecycleHooksFromMethods(deps.methods);
        }
        if (IO.implements && IO.implements.length > 0) {
            deps.implements = IO.implements;
        }
        if (typeof IO.ignore === 'undefined') {
            this.debug(deps);

            outputSymbols.classes.push(deps);
        } else {
            this.ignore(deps);
        }
    }

    private getTypescriptImportsAliases(initialSrcFile: ts.SourceFile, outputSymbols: any): void {
        const astFile =
            typeof this.project.getSourceFile(initialSrcFile.fileName) !== 'undefined'
                ? this.project.getSourceFile(initialSrcFile.fileName)
                : this.project.addSourceFileAtPath(initialSrcFile.fileName);

        if (astFile) {
            const importDeclarations = astFile.getImportDeclarations();
            if (importDeclarations && importDeclarations.length > 0) {
                importDeclarations.forEach(importDeclaration => {
                    const namedImports = importDeclaration.getNamedImports();
                    if (namedImports && namedImports.length > 0) {
                        namedImports.forEach(namedImport => {
                            if (namedImport.getAliasNode()) {
                                if (Object.hasOwn(outputSymbols.aliases, namedImport.getName())) {
                                    outputSymbols.aliases[namedImport.getName()].push(
                                        namedImport.getAliasNode().getText()
                                    );
                                } else {
                                    outputSymbols.aliases[namedImport.getName()] = [
                                        namedImport.getAliasNode().getText()
                                    ];
                                }
                            }
                        });
                    }
                });
            }
        }
    }

    private getTypescriptExportsAliases(initialSrcFile: ts.SourceFile, outputSymbols: any): void {
        const astFile =
            typeof this.project.getSourceFile(initialSrcFile.fileName) !== 'undefined'
                ? this.project.getSourceFile(initialSrcFile.fileName)
                : this.project.addSourceFileAtPath(initialSrcFile.fileName);

        if (astFile) {
            const exportDeclarations = astFile.getExportDeclarations();
            if (exportDeclarations && exportDeclarations.length > 0) {
                exportDeclarations.forEach(exportDeclaration => {
                    const hasNamedExports = exportDeclaration.hasNamedExports();
                    if (hasNamedExports) {
                        const namedExports = exportDeclaration.getNamedExports();
                        if (namedExports && namedExports.length > 0) {
                            namedExports.forEach(namedExport => {
                                if (namedExport.getAliasNode()) {
                                    if (
                                        Object.hasOwn(outputSymbols.aliases, namedExport.getName())
                                    ) {
                                        outputSymbols.aliases[namedExport.getName()].push(
                                            namedExport.getAliasNode().getText()
                                        );
                                    } else {
                                        outputSymbols.aliases[namedExport.getName()] = [
                                            namedExport.getAliasNode().getText()
                                        ];
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }
    }

    private getSourceFileDecorators(initialSrcFile: ts.SourceFile, outputSymbols: any): void {
        const cleaner = (process.cwd() + path.sep).replace(/\\/g, '/');
        const fileName = initialSrcFile.fileName.replace(cleaner, '');
        const scannedFile = initialSrcFile;

        const astFile =
            typeof this.project.getSourceFile(initialSrcFile.fileName) !== 'undefined'
                ? this.project.getSourceFile(initialSrcFile.fileName)
                : this.project.addSourceFileAtPath(initialSrcFile.fileName);
        const exportNames = localExportNames(scannedFile);

        ts.forEachChild(scannedFile, (initialNode: ts.Node) => {
            if (
                this.jsDocHelper.hasJSDocInternalTag(fileName, scannedFile, initialNode) &&
                Configuration.mainData.disableInternal
            ) {
                return;
            }
            const parseNode = (file, srcFile, node, fileBody, astFile) => {
                const sourceCode = srcFile.getText();
                const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
                // Only what the file exports is documented; namespace members keep their
                // own scope and stay as they are.
                const isFileLocal = (declaration: ts.Node, name: string): boolean => {
                    if (fileBody || isExportedFromFile(declaration, name, srcFile, exportNames)) {
                        return false;
                    }
                    logger.debug(`Skipping ${name} (not exported from ${file})`);
                    return true;
                };

                if (nodeHasDecorator(node)) {
                    let classWithCustomDecorator = false;
                    const nodeDecorators = getNodeDecorators(node);
                    const visitDecorator = (visitedDecorator, _index) => {
                        let deps: IDep;

                        const name = this.expressionFinder.getSymboleName(node);

                        // Check if this decorated class is allowed by public API filter
                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                            logger.debug(`Skipping decorated class ${name} (not in public API)`);
                            return;
                        }

                        const props = this.expressionFinder.findProperties(
                            visitedDecorator,
                            srcFile
                        );
                        const IO = this.componentHelper.getComponentIO(
                            file,
                            srcFile,
                            node,
                            fileBody,
                            astFile
                        );

                        if (this.metadataPredicates.isComponent(visitedDecorator)) {
                            if (props.length === 0) {
                                return;
                            }
                            const componentDep = new ComponentDepFactory(
                                this.componentHelper
                            ).create(file, srcFile, name, props, IO, node);
                            deps = componentDep;
                            if (typeof IO.ignore === 'undefined') {
                                ComponentsTreeEngine.addComponent(componentDep);
                                outputSymbols.components.push(componentDep);
                            }
                        } else if (this.metadataPredicates.isEntity(visitedDecorator)) {
                            const entityDep = new EntityDepFactory().create(
                                file,
                                srcFile,
                                name,
                                props,
                                IO
                            );
                            deps = entityDep;

                            if (typeof IO.ignore === 'undefined') {
                                outputSymbols.entities.push(entityDep);
                            }
                        } else if (this.metadataPredicates.isInjectable(visitedDecorator)) {
                            const providedIn = this.componentHelper.getInjectableProvidedIn(
                                props,
                                srcFile
                            );
                            const injectableDeps = this.injectableDep(
                                'injectable',
                                name,
                                hash,
                                file,
                                srcFile,
                                node,
                                IO,
                                providedIn && { providedIn }
                            );
                            deps = injectableDeps;
                            if (typeof IO.ignore === 'undefined') {
                                injectableDeps.type = 'injectable';
                                this.addNewEntityInStore(injectableDeps, outputSymbols.injectables);
                            }
                        } else if (isAngularServiceDecorator(visitedDecorator, srcFile)) {
                            const serviceDeps: IServiceDep = this.injectableDep(
                                'service',
                                name,
                                hash,
                                file,
                                srcFile,
                                node,
                                IO,
                                serviceOptions(visitedDecorator, srcFile)
                            );
                            deps = serviceDeps;
                            if (typeof IO.ignore === 'undefined') {
                                serviceDeps.type = 'service';
                                this.addNewEntityInStore(serviceDeps, outputSymbols.services);
                            }
                        } else if (this.metadataPredicates.isPipe(visitedDecorator)) {
                            const pipeDeps: IPipeDep = {
                                name,
                                id: `pipe-${name}-${hash}`,
                                file: file,
                                type: 'pipe',
                                deprecated: IO.deprecated,
                                deprecationMessage: IO.deprecationMessage,
                                description: IO.description,
                                rawdescription: IO.rawdescription,
                                properties: IO.properties,
                                methods: IO.methods,
                                // Custom JSDoc tags
                                ...(IO.beta && { beta: true }),
                                ...(IO.since && { since: IO.since }),
                                ...(IO.aiGenerated && { aiGenerated: IO.aiGenerated }),
                                ...(IO.storybookUrl && { storybookUrl: IO.storybookUrl }),
                                ...(IO.figmaUrl && { figmaUrl: IO.figmaUrl }),
                                ...(IO.stackblitzUrl && { stackblitzUrl: IO.stackblitzUrl }),
                                ...(IO.githubUrl && { githubUrl: IO.githubUrl }),
                                ...(IO.docsUrl && { docsUrl: IO.docsUrl }),
                                standalone: !!this.componentHelper.getComponentStandalone(
                                    props,
                                    srcFile
                                ),
                                pure: this.componentHelper.getComponentPure(props, srcFile),
                                ngname: this.componentHelper.getComponentName(props, srcFile),
                                sourceCode: srcFile.getText(),
                                exampleUrls: this.componentHelper.getExampleUrlsOf(node)
                            };
                            if (Configuration.mainData.disableLifeCycleHooks) {
                                pipeDeps.methods = cleanLifecycleHooksFromMethods(pipeDeps.methods);
                            }
                            if (IO.jsdoctags && IO.jsdoctags.length > 0) {
                                pipeDeps.jsdoctags = (IO.jsdoctags[0] as any).tags;
                            }
                            deps = pipeDeps;
                            if (typeof IO.ignore === 'undefined') {
                                outputSymbols.pipes.push(pipeDeps);
                            }
                        } else if (this.metadataPredicates.isDirective(visitedDecorator)) {
                            const directiveDeps = new DirectiveDepFactory(
                                this.componentHelper
                            ).create(file, srcFile, name, props, IO, node);
                            deps = directiveDeps;
                            if (typeof IO.ignore === 'undefined') {
                                outputSymbols.directives.push(directiveDeps);
                            }
                        } else {
                            const hasMultipleDecoratorsWithInternalOne =
                                this.metadataPredicates.hasInternalDecorator(
                                    nodeDecorators,
                                    srcFile
                                );
                            // Just a class
                            if (
                                !classWithCustomDecorator &&
                                !hasMultipleDecoratorsWithInternalOne
                            ) {
                                classWithCustomDecorator = true;
                                this.processClass(
                                    node,
                                    file,
                                    srcFile,
                                    outputSymbols,
                                    fileBody,
                                    astFile
                                );
                            }
                        }
                        if (typeof IO.ignore === 'undefined') {
                            this.debug(deps);
                        } else {
                            this.ignore(deps);
                        }
                    };

                    const filterByDecorators = filteredNode => {
                        if (filteredNode.expression?.expression) {
                            let _test = /(Component|Injectable|Pipe|Directive)/.test(
                                filteredNode.expression.expression.text
                            );
                            if (!_test && ts.isClassDeclaration(node)) {
                                _test = true;
                            }
                            return _test;
                        }
                        if (ts.isClassDeclaration(node)) {
                            return true;
                        }
                        return false;
                    };

                    nodeDecorators.filter(filterByDecorators).forEach(visitDecorator);
                } else if (node.symbol) {
                    if (node.symbol.flags === ts.SymbolFlags.Class) {
                        // Check if class is allowed by public API filter
                        const className = this.expressionFinder.getSymboleName(node);
                        if (!this.publicApiFilter.isSymbolAllowed(className, file)) {
                            logger.debug(`Skipping class ${className} (not in public API)`);
                            return;
                        }
                        this.processClass(node, file, srcFile, outputSymbols, fileBody, astFile);
                    } else if (node.symbol.flags === ts.SymbolFlags.Interface) {
                        const name = this.expressionFinder.getSymboleName(node);
                        if (isFileLocal(node, name)) {
                            return;
                        }

                        // Check if interface is allowed by public API filter
                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                            logger.debug(`Skipping interface ${name} (not in public API)`);
                            return;
                        }

                        const IO = this.ioExtractor.getInterfaceIO(
                            file,
                            srcFile,
                            node,
                            fileBody,
                            astFile
                        );
                        const interfaceDeps: IInterfaceDep = {
                            name,
                            id: `interface-${name}-${hash}`,
                            file: file,
                            deprecated: IO.deprecated,
                            deprecationMessage: IO.deprecationMessage,
                            type: 'interface',
                            sourceCode: srcFile.getText(),
                            storybookUrl: IO.storybookUrl || '',
                            figmaUrl: IO.figmaUrl || '',
                            stackblitzUrl: IO.stackblitzUrl || '',
                            githubUrl: IO.githubUrl || '',
                            docsUrl: IO.docsUrl || '',
                            ...(IO.wcagLevel && { wcagLevel: IO.wcagLevel }),
                            ...(IO.a11yNote && { a11yNote: IO.a11yNote }),
                            ...(IO.taggedSelector && { taggedSelector: IO.taggedSelector }),
                            ...(IO.relatedTo &&
                                IO.relatedTo.length > 0 && { relatedTo: IO.relatedTo })
                        };
                        if (IO.properties) {
                            interfaceDeps.properties = IO.properties;
                        }
                        if (IO.indexSignatures) {
                            interfaceDeps.indexSignatures = IO.indexSignatures;
                        }
                        if (IO.kind) {
                            interfaceDeps.kind = IO.kind;
                        }
                        if (IO.description) {
                            interfaceDeps.description = IO.description;
                            interfaceDeps.rawdescription = IO.rawdescription;
                        }
                        if (IO.methods) {
                            interfaceDeps.methods = IO.methods;
                        }
                        if (IO.extends) {
                            interfaceDeps.extends = IO.extends;
                        }
                        if (typeof IO.ignore === 'undefined') {
                            this.debug(interfaceDeps);
                            outputSymbols.interfaces.push(interfaceDeps);
                        } else {
                            this.ignore(interfaceDeps);
                        }
                    } else if (ts.isFunctionDeclaration(node)) {
                        const infos = this.entityVisitor.visitFunctionDeclaration(node);
                        const name = infos.name;

                        if (isFileLocal(node, name)) {
                            return;
                        }

                        // Check if function is allowed by public API filter
                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                            logger.debug(`Skipping function ${name} (not in public API)`);
                            return;
                        }

                        const deprecated = infos.deprecated;
                        const deprecationMessage = infos.deprecationMessage;
                        const functionDep: IFunctionDecDep = {
                            name,
                            file: file,
                            ctype: 'miscellaneous',
                            subtype: 'function',
                            deprecated,
                            deprecationMessage,
                            description:
                                this.entityVisitor.visitEnumTypeAliasFunctionDeclarationDescription(
                                    node
                                ),
                            ...(infos.wcagLevel && { wcagLevel: infos.wcagLevel }),
                            ...(infos.a11yNote && { a11yNote: infos.a11yNote })
                        };
                        // Detect functional guard/resolver/interceptor from return type
                        const functionalKind = this.providerDetector.detectFunctionalAngularKind(
                            infos.returnType,
                            name
                        );
                        if (functionalKind) {
                            (functionDep as any).functionalKind = functionalKind;
                        }
                        // Custom JSDoc tags
                        if (infos.signal) {
                            (functionDep as any).signal = true;
                        }
                        if (infos.beta) {
                            (functionDep as any).beta = true;
                        }
                        if (infos.since) {
                            (functionDep as any).since = infos.since;
                        }
                        if (infos.aiGenerated) {
                            (functionDep as any).aiGenerated = infos.aiGenerated;
                        }
                        if (infos.args) {
                            functionDep.args = infos.args;
                        }
                        if (infos.returnType) {
                            functionDep.returnType = infos.returnType;
                        }
                        if (infos.jsdoctags && infos.jsdoctags.length > 0) {
                            functionDep.jsdoctags = infos.jsdoctags;
                        }
                        if (typeof infos.ignore === 'undefined') {
                            if (
                                !(
                                    this.entityVisitor.hasPrivateJSDocTag(functionDep.jsdoctags) &&
                                    Configuration.mainData.disablePrivate
                                )
                            ) {
                                this.debug(functionDep);
                                outputSymbols.miscellaneous.functions.push(functionDep);
                            }
                        }
                    } else if (ts.isEnumDeclaration(node)) {
                        const infos = this.entityVisitor.visitEnumDeclaration(node);
                        const name = infos.name;

                        if (isFileLocal(node, name)) {
                            return;
                        }

                        // Check if enum is allowed by public API filter
                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                            logger.debug(`Skipping enum ${name} (not in public API)`);
                            return;
                        }

                        const deprecated = infos.deprecated;
                        const deprecationMessage = infos.deprecationMessage;
                        const enumDeps: IEnumDecDep = {
                            name,
                            childs: infos.members,
                            ctype: 'miscellaneous',
                            subtype: 'enum',
                            deprecated,
                            deprecationMessage,
                            description:
                                this.entityVisitor.visitEnumTypeAliasFunctionDeclarationDescription(
                                    node
                                ),
                            file: file,
                            ...(infos.wcagLevel && { wcagLevel: infos.wcagLevel }),
                            ...(infos.a11yNote && { a11yNote: infos.a11yNote })
                        };

                        if (!isIgnore(node)) {
                            this.debug(enumDeps);
                            outputSymbols.miscellaneous.enumerations.push(enumDeps);
                        }
                    } else if (ts.isTypeAliasDeclaration(node)) {
                        const infos = this.entityVisitor.visitTypeDeclaration(node);
                        const name = infos.name;

                        if (isFileLocal(node, name)) {
                            return;
                        }

                        // Check if type alias is allowed by public API filter
                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                            logger.debug(`Skipping type alias ${name} (not in public API)`);
                            return;
                        }

                        const deprecated = infos.deprecated;
                        const deprecationMessage = infos.deprecationMessage;
                        const typeAliasDeps: ITypeAliasDecDep = {
                            name,
                            ctype: 'miscellaneous',
                            subtype: 'typealias',
                            rawtype: this.classHelper.visitType(node),
                            file: file,
                            deprecated,
                            deprecationMessage,
                            description:
                                this.entityVisitor.visitEnumTypeAliasFunctionDeclarationDescription(
                                    node
                                ),
                            ...(infos.wcagLevel && { wcagLevel: infos.wcagLevel }),
                            ...(infos.a11yNote && { a11yNote: infos.a11yNote })
                        };
                        if (node.type) {
                            typeAliasDeps.kind = node.type.kind;
                            if (typeAliasDeps.rawtype === '') {
                                typeAliasDeps.rawtype = this.classHelper.visitType(node);
                            }
                        }

                        if (
                            typeAliasDeps.kind &&
                            typeAliasDeps.kind === SyntaxKind.TemplateLiteralType &&
                            node.type
                        ) {
                            typeAliasDeps.rawtype = srcFile.text.substring(
                                node.type.pos,
                                node.type.end
                            );
                        }

                        if (!isIgnore(node)) {
                            outputSymbols.miscellaneous.typealiases.push(typeAliasDeps);
                        }

                        if (typeof infos.ignore === 'undefined') {
                            this.debug(typeAliasDeps);
                        }
                    } else if (ts.isModuleDeclaration(node)) {
                        if (node.body) {
                            if (
                                (node.body as any).statements &&
                                (node.body as any).statements.length > 0
                            ) {
                                (node.body as any).statements.forEach(statement =>
                                    parseNode(file, srcFile, statement, node.body, astFile)
                                );
                            }
                        }
                    }
                } else {
                    // Every class, function, enum and type alias declaration is bound,
                    // so it carries node.symbol and is handled above; only variable
                    // statements (no symbol of their own) reach this branch.
                    if (ts.isVariableStatement(node)) {
                        const isRoutesVariable = hasBareRoutesType(node);
                        // Process all variables, including exported routes variables for miscellaneous
                        if (!isRoutesVariable || this.ioExtractor.isExportedVariable(node)) {
                            let isDestructured = false;
                            // Check for destructuring array
                            const nodeVariableDeclarations = node.declarationList.declarations;
                            if (nodeVariableDeclarations) {
                                if (nodeVariableDeclarations.length > 0) {
                                    if (
                                        nodeVariableDeclarations[0].name &&
                                        nodeVariableDeclarations[0].name.kind ===
                                            SyntaxKind.ArrayBindingPattern
                                    ) {
                                        isDestructured = true;
                                    }
                                }
                            }

                            const visitVariableNode = variableNode => {
                                const infos: any =
                                    this.entityVisitor.visitVariableDeclaration(variableNode);
                                if (infos) {
                                    const name = infos.name;
                                    if (isFileLocal(node, name)) {
                                        return;
                                    }
                                    const deprecated = infos.deprecated;
                                    const deprecationMessage = infos.deprecationMessage;
                                    const deps: any = {
                                        name,
                                        ctype: 'miscellaneous',
                                        subtype: 'variable',
                                        file: file,
                                        deprecated,
                                        deprecationMessage,
                                        ...(infos.wcagLevel && { wcagLevel: infos.wcagLevel }),
                                        ...(infos.a11yNote && { a11yNote: infos.a11yNote })
                                    };
                                    deps.type = infos.type ? infos.type : '';
                                    if (infos.defaultValue) {
                                        deps.defaultValue = infos.defaultValue;
                                    }
                                    if (infos.initializer) {
                                        deps.initializer = infos.initializer;
                                    }
                                    if (
                                        variableNode.jsDoc &&
                                        variableNode.jsDoc.length > 0 &&
                                        variableNode.jsDoc[0].comment
                                    ) {
                                        const rawDescription = this.jsdocParserUtil.parseJSDocNode(
                                            variableNode.jsDoc[0]
                                        );
                                        deps.rawdescription = rawDescription;
                                        deps.description = markedAcl(rawDescription);
                                    }
                                    // Detect ApplicationConfig declarations
                                    if (infos.type === 'ApplicationConfig' && infos.initializer) {
                                        const providers =
                                            this.providerDetector.extractProviderCalls(
                                                infos.initializer
                                            );
                                        // Zoneless detection: if zone.js is not in package.json
                                        // dependencies, the app is zoneless - regardless of
                                        // which provider function is used.
                                        const hasZoneJs = Configuration.mainData.hasZoneJs ?? true;
                                        const isZoneless = !hasZoneJs;
                                        const appConfigDep: any = {
                                            name,
                                            file,
                                            type: 'app-config',
                                            description: deps.description || '',
                                            rawdescription: deps.rawdescription || '',
                                            providers,
                                            deprecated: deps.deprecated || false,
                                            deprecationMessage: deps.deprecationMessage || '',
                                            since: infos.since || '',
                                            zoneless: isZoneless
                                        };
                                        if (!isIgnore(variableNode)) {
                                            if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                                                logger.debug(
                                                    `Skipping ApplicationConfig ${name} (not in public API)`
                                                );
                                                return;
                                            }
                                            this.debug(appConfigDep);
                                            if (!outputSymbols.appConfig) {
                                                outputSymbols.appConfig = [];
                                            }
                                            outputSymbols.appConfig.push(appConfigDep);
                                        }
                                        return;
                                    }

                                    // Detect InjectionToken / HttpContextToken declarations
                                    // - DI keys, semantically distinct from `@Injectable()`
                                    // service classes. Routed to a separate `tokens`
                                    // collection so the docs surface them under a dedicated
                                    // `tokens/<name>.html` URL with a Token-specific page
                                    // template (no methods / inputs / outputs tab).
                                    if (this.providerDetector.isInjectionToken(infos.initializer)) {
                                        const factory =
                                            this.providerDetector.getInjectionTokenFactory(
                                                infos.initializer
                                            );
                                        const tokenDep: IInjectableDep = {
                                            name,
                                            id:
                                                'token-' +
                                                name +
                                                '-' +
                                                crypto
                                                    .createHash('sha512')
                                                    .update(name + file)
                                                    .digest('hex'),
                                            file,
                                            type: 'token',
                                            properties: [],
                                            methods: [],
                                            deprecated: deps.deprecated || false,
                                            deprecationMessage: deps.deprecationMessage || '',
                                            description: deps.description || '',
                                            rawdescription: deps.rawdescription || '',
                                            sourceCode: '',
                                            isToken: true,
                                            tokenClass:
                                                this.providerDetector.getTokenConstructorName(
                                                    infos.initializer
                                                ),
                                            tokenType: this.providerDetector.getInjectionTokenType(
                                                infos.initializer
                                            ),
                                            providedIn:
                                                this.providerDetector.getInjectionTokenProvidedIn(
                                                    infos.initializer
                                                ),
                                            ...(factory && { factory }),
                                            since: infos.since || '',
                                            githubUrl: infos.githubUrl || '',
                                            ...(infos.wcagLevel && {
                                                wcagLevel: infos.wcagLevel
                                            }),
                                            ...(infos.a11yNote && { a11yNote: infos.a11yNote }),
                                            ...(infos.taggedSelector && {
                                                taggedSelector: infos.taggedSelector
                                            }),
                                            ...(infos.relatedTo &&
                                                infos.relatedTo.length > 0 && {
                                                    relatedTo: infos.relatedTo
                                                })
                                        };
                                        if (!isIgnore(variableNode)) {
                                            if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                                                logger.debug(
                                                    `Skipping InjectionToken ${name} (not in public API)`
                                                );
                                                return;
                                            }
                                            this.debug(tokenDep);
                                            outputSymbols.tokens.push(tokenDep);
                                        }
                                        return;
                                    }

                                    // Detect functional guard/interceptor from type annotation.
                                    // Resolvers have no collection of their own; they stay
                                    // regular variables tagged with `functionalKind`.
                                    const functionalKind =
                                        this.providerDetector.detectFunctionalAngularKind(
                                            infos.type,
                                            name
                                        );
                                    const isFunctionalGuardOrInterceptor =
                                        functionalKind === 'guard' ||
                                        functionalKind === 'interceptor';
                                    if (isFunctionalGuardOrInterceptor && !isIgnore(variableNode)) {
                                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                                            logger.debug(
                                                `Skipping functional ${functionalKind} ${name} (not in public API)`
                                            );
                                            return;
                                        }
                                        const guardDep: any = {
                                            name,
                                            id: `${functionalKind}-${name}-${crypto
                                                .createHash('sha512')
                                                .update(name + file)
                                                .digest('hex')}`,
                                            file,
                                            type: functionalKind,
                                            properties: [],
                                            methods: [],
                                            deprecated: deps.deprecated || false,
                                            deprecationMessage: deps.deprecationMessage || '',
                                            description: deps.description || '',
                                            rawdescription: deps.rawdescription || '',
                                            sourceCode: srcFile.getText(),
                                            functionalKind
                                        };
                                        if (infos.since) {
                                            guardDep.since = infos.since;
                                        }
                                        if (infos.beta) {
                                            guardDep.beta = true;
                                        }
                                        if (infos.aiGenerated) {
                                            (guardDep as any).aiGenerated = infos.aiGenerated;
                                        }
                                        if (infos.storybookUrl) {
                                            guardDep.storybookUrl = infos.storybookUrl;
                                        }
                                        if (infos.figmaUrl) {
                                            guardDep.figmaUrl = infos.figmaUrl;
                                        }
                                        if (infos.stackblitzUrl) {
                                            guardDep.stackblitzUrl = infos.stackblitzUrl;
                                        }
                                        if (infos.githubUrl) {
                                            guardDep.githubUrl = infos.githubUrl;
                                        }
                                        if (infos.docsUrl) {
                                            guardDep.docsUrl = infos.docsUrl;
                                        }
                                        this.debug(guardDep);
                                        if (functionalKind === 'guard') {
                                            outputSymbols.guards.push(guardDep);
                                        } else if (functionalKind === 'interceptor') {
                                            outputSymbols.interceptors.push(guardDep);
                                        }
                                        return;
                                    }
                                    if (functionalKind === 'resolver') {
                                        deps.functionalKind = functionalKind;
                                    }

                                    if (!isIgnore(variableNode)) {
                                        // Check if variable is allowed by public API filter
                                        if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                                            logger.debug(
                                                `Skipping variable ${name} (not in public API)`
                                            );
                                            return;
                                        }
                                        this.debug(deps);
                                        outputSymbols.miscellaneous.variables.push(deps);
                                    }
                                }
                            };

                            if (isDestructured) {
                                if ((nodeVariableDeclarations[0].name as any).elements) {
                                    const destructuredVariables = (
                                        nodeVariableDeclarations[0].name as any
                                    ).elements;

                                    for (let i = 0; i < destructuredVariables.length; i++) {
                                        const destructuredVariable = destructuredVariables[i];
                                        const name = destructuredVariable.name
                                            ? destructuredVariable.name.escapedText
                                            : '';
                                        if (isFileLocal(node, name)) {
                                            continue;
                                        }
                                        const deps: any = {
                                            name,
                                            ctype: 'miscellaneous',
                                            subtype: 'variable',
                                            file: file
                                        };
                                        if (nodeVariableDeclarations[0].initializer) {
                                            if (
                                                (nodeVariableDeclarations[0].initializer as any)
                                                    .elements
                                            ) {
                                                deps.initializer = (
                                                    nodeVariableDeclarations[0].initializer as any
                                                ).elements[i];
                                            }
                                            deps.defaultValue = deps.initializer
                                                ? this.classHelper.stringifyDefaultValue(
                                                      deps.initializer
                                                  )
                                                : undefined;
                                        }

                                        if (!isIgnore(destructuredVariables[i])) {
                                            // Check if variable is allowed by public API filter
                                            if (!this.publicApiFilter.isSymbolAllowed(name, file)) {
                                                logger.debug(
                                                    `Skipping destructured variable ${name} (not in public API)`
                                                );
                                                continue;
                                            }
                                            this.debug(deps);
                                            outputSymbols.miscellaneous.variables.push(deps);
                                        }
                                    }
                                }
                            } else {
                                visitVariableNode(node);
                            }
                        } // End of new if condition for isRoutesVariable || isExportedVariable
                    }
                }
            };

            parseNode(fileName, scannedFile, initialNode, null, astFile);
        });
    }

    /**
     * Entry of an `@Injectable` or `@Service` class. `options` (providedIn, or
     * the Service options) sit where `providedIn` always sat in the entry.
     */
    private injectableDep(
        idPrefix: 'injectable' | 'service',
        name: string,
        hash: string,
        file,
        srcFile: ts.SourceFile,
        node: ts.Node,
        IO,
        options: object | undefined
    ): IInjectableDep {
        const injectableDeps: IInjectableDep = {
            name,
            id: `${idPrefix}-${name}-${hash}`,
            file: file,
            properties: IO.properties,
            methods: IO.methods,
            deprecated: IO.deprecated,
            deprecationMessage: IO.deprecationMessage,
            description: IO.description,
            rawdescription: IO.rawdescription,
            sourceCode: srcFile.getText(),
            exampleUrls: this.componentHelper.getExampleUrlsOf(node),
            ...options,
            // Custom JSDoc tags
            ...(IO.beta && { beta: true }),
            ...(IO.since && { since: IO.since }),
            ...(IO.breaking && { breaking: IO.breaking }),
            ...(IO.aiGenerated && { aiGenerated: IO.aiGenerated }),
            ...(IO.storybookUrl && { storybookUrl: IO.storybookUrl }),
            ...(IO.figmaUrl && { figmaUrl: IO.figmaUrl }),
            ...(IO.stackblitzUrl && { stackblitzUrl: IO.stackblitzUrl }),
            ...(IO.githubUrl && { githubUrl: IO.githubUrl }),
            ...(IO.docsUrl && { docsUrl: IO.docsUrl }),
            ...(IO.wcagLevel && { wcagLevel: IO.wcagLevel }),
            ...(IO.a11yNote && { a11yNote: IO.a11yNote }),
            ...(IO.taggedSelector && { taggedSelector: IO.taggedSelector }),
            ...(IO.relatedTo && IO.relatedTo.length > 0 && { relatedTo: IO.relatedTo })
        };
        if (IO.constructor && !Configuration.mainData.disableConstructors) {
            injectableDeps.constructorObj = IO.constructor;
        }
        if (IO.jsdoctags && IO.jsdoctags.length > 0) {
            injectableDeps.jsdoctags = (IO.jsdoctags[0] as any).tags;
        }
        if (IO.accessors) {
            injectableDeps.accessors = IO.accessors;
        }
        if (IO.extends) {
            injectableDeps.extends = IO.extends;
        }
        if (Configuration.mainData.disableLifeCycleHooks) {
            injectableDeps.methods = cleanLifecycleHooksFromMethods(injectableDeps.methods);
        }
        return injectableDeps;
    }

    /**
     * Function to in a specific store an entity, and check before is there is not the same one
     * in that store : same name, id and file
     * @param entity Entity to store
     * @param store Store
     */
    private addNewEntityInStore(entity, store) {
        const findSameEntityInStore = store.filter(
            el => el.name === entity.name && el.id === entity.id && el.file === entity.file
        );
        if (findSameEntityInStore.length === 0) {
            store.push(entity);
        }
    }

    private debug(deps: IDep) {
        if (deps) {
            logger.debug('found', `${deps.name}`);
        } else {
            return;
        }
        const providers = deps['providers'];
        if (providers && providers.length > 0) {
            logger.debug('', '- providers:');
            providers
                .map(i => i.name)
                .forEach(d => {
                    logger.debug('', `\t- ${d}`);
                });
        }
    }

    private ignore(deps: IDep) {
        if (deps) {
            logger.warn('ignore', `${deps.name}`);
        } else {
            return;
        }
    }
}
