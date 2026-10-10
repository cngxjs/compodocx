import { SyntaxKind, ts } from 'ts-morph';
import { isIgnore } from '../../../../../../utils';
import { JsdocParserUtil } from '../../../../../../utils/jsdoc-parser.util';
import { markedAcl } from '../../../../../../utils/marked.acl';
import { getNodeDecorators, nodeHasDecorator } from '../../../../../../utils/node.util';
import { markedtags } from '../../../../../../utils/utils';
import { DecoratorInspector } from './decorator-inspector';
import { JsdocExtractor } from './jsdoc-extractor';
import { MemberVisitor } from './member-visitor';
import { TypeRenderer } from './type-renderer';

export class ClassHelper {
    private jsdocParserUtil = new JsdocParserUtil();
    private typeRenderer = new TypeRenderer();
    private jsdocExtractor = new JsdocExtractor();
    private decoratorInspector = new DecoratorInspector();
    private memberVisitor: MemberVisitor;

    constructor(private typeChecker: ts.TypeChecker) {
        this.memberVisitor = new MemberVisitor(
            typeChecker,
            this.typeRenderer,
            this.jsdocExtractor,
            this.decoratorInspector
        );
    }

    public stringifyDefaultValue(node: ts.Node): string {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        if (node && (node as any).getText && node.getText()) {
            return node.getText();
        } else if (node && node.kind === SyntaxKind.FalseKeyword) {
            return 'false';
        } else if (node && node.kind === SyntaxKind.TrueKeyword) {
            return 'true';
        }
        return '';
    }

    private initializeDocumentationFields(): {
        deprecated: boolean;
        deprecationMessage: string;
    } {
        return {
            deprecated: false,
            deprecationMessage: ''
        };
    }

    public visitTypeIndex(node): string {
        return this.typeRenderer.visitTypeIndex(node);
    }

    public visitType(node): string {
        return this.typeRenderer.visitType(node);
    }

    public visitClassDeclaration(
        fileName: string,
        classDeclaration: ts.ClassDeclaration | ts.InterfaceDeclaration,
        sourceFile?: ts.SourceFile,
        astFile?: ts.SourceFile
    ): any {
        const symbol = this.typeChecker.getSymbolAtLocation(classDeclaration.name);
        let rawdescription = '';
        const deprecation = this.initializeDocumentationFields();
        let description = '';
        let jsdoctags: any[] = [];

        if (symbol) {
            const comment = this.jsdocParserUtil.getMainCommentOfNode(classDeclaration, sourceFile);
            rawdescription = this.jsdocParserUtil.parseComment(comment);
            description = markedAcl(rawdescription);
            if (symbol.valueDeclaration && isIgnore(symbol.valueDeclaration)) {
                return [{ ignore: true }];
            }
            if (symbol.declarations && symbol.declarations.length > 0) {
                const declarationsjsdoctags = this.jsdocParserUtil.getJSDocs(
                    symbol.declarations[0]
                );
                this.jsdocExtractor.processJSDocTags(declarationsjsdoctags, deprecation, false);
                if (isIgnore(symbol.declarations[0])) {
                    return [{ ignore: true }];
                }
            }
            if (symbol.valueDeclaration) {
                jsdoctags = this.jsdocParserUtil.getJSDocs(
                    symbol.valueDeclaration
                ) as unknown as any[];
                if (jsdoctags && jsdoctags.length >= 1) {
                    const jsdoc = jsdoctags[0] as any;
                    if (jsdoc?.tags) {
                        this.jsdocExtractor.checkForDeprecation(jsdoc.tags, deprecation);
                        jsdoctags = markedtags(jsdoc.tags);
                    }
                }
            }
        }

        const className = classDeclaration.name.text;
        let members;
        const implementsElements = [];
        let extendsElements = [];

        if (typeof (ts as any).getEffectiveImplementsTypeNodes !== 'undefined') {
            const implementedTypes = (ts as any).getEffectiveImplementsTypeNodes(classDeclaration);
            if (implementedTypes) {
                let i = 0;
                const len = implementedTypes.length;
                for (i; i < len; i++) {
                    if (implementedTypes[i].expression) {
                        implementsElements.push(implementedTypes[i].expression.text);
                    }
                }
            }
        }

        if (typeof (ts as any).getClassExtendsHeritageElement !== 'undefined') {
            if (astFile) {
                let interfaceOrClassNode = (astFile as any).getInterface(className);
                if (!interfaceOrClassNode) {
                    interfaceOrClassNode = (astFile as any).getClass(className);
                }
                if (interfaceOrClassNode) {
                    const extendsListRaw = interfaceOrClassNode.getExtends();
                    const extendsList = [];
                    if (extendsListRaw) {
                        if (Array.isArray(extendsListRaw)) {
                            if (extendsListRaw.length > 0) {
                                extendsListRaw.forEach(extendElement => {
                                    const extendElementExpression = extendElement.getExpression();
                                    if (extendElementExpression) {
                                        const text = extendElementExpression.getText();
                                        if (text) {
                                            extendsList.push(text);
                                        }
                                    }
                                });
                            }
                        } else {
                            const extendElementExpression = extendsListRaw.getExpression();
                            if (extendElementExpression) {
                                const text = extendElementExpression.getText();
                                if (text) {
                                    extendsList.push(text);
                                }
                            }
                        }
                    }
                    extendsElements = extendsList;
                }
            }
        }
        members = this.memberVisitor.visitMembers(classDeclaration.members, sourceFile);

        if (nodeHasDecorator(classDeclaration)) {
            const classDecorators = getNodeDecorators(classDeclaration);
            // Loop and search for Angular decorators:
            // @Component, @Directive, @Injectable, @Pipe
            let isDirective = false;
            let isService = false;
            let isPipe = false;
            for (let a = 0; a < classDecorators.length; a++) {
                //console.log(classDeclaration.decorators[i].expression);

                // RETURN TOO EARLY FOR MANY DECORATORS !!!!
                // iterating through the decorators array we have to keep the flags `true` values from the previous loop iteration
                isDirective =
                    isDirective || this.decoratorInspector.isDirectiveDecorator(classDecorators[a]);
                isService =
                    isService || this.decoratorInspector.isServiceDecorator(classDecorators[a]);
                isPipe = isPipe || this.decoratorInspector.isPipeDecorator(classDecorators[a]);
            }
            if (isDirective) {
                return {
                    ...deprecation,
                    description,
                    rawdescription: rawdescription,
                    inputs: members.inputs,
                    outputs: members.outputs,
                    hostBindings: members.hostBindings,
                    hostListeners: members.hostListeners,
                    properties: members.properties,
                    methods: members.methods,
                    indexSignatures: members.indexSignatures,
                    kind: members.kind,
                    constructor: members.constructor,
                    jsdoctags: jsdoctags,
                    extends: extendsElements,
                    implements: implementsElements,
                    accessors: members.accessors
                };
            } else if (isService) {
                return [
                    {
                        fileName,
                        className,
                        ...deprecation,
                        description,
                        rawdescription: rawdescription,
                        methods: members.methods,
                        indexSignatures: members.indexSignatures,
                        properties: members.properties,
                        kind: members.kind,
                        constructor: members.constructor,
                        jsdoctags: jsdoctags,
                        extends: extendsElements,
                        implements: implementsElements,
                        accessors: members.accessors
                    }
                ];
            } else if (isPipe) {
                return [
                    {
                        fileName,
                        className,
                        ...deprecation,
                        description,
                        rawdescription: rawdescription,
                        jsdoctags: jsdoctags,
                        properties: members.properties,
                        methods: members.methods
                    }
                ];
            } else {
                return [
                    {
                        ...deprecation,
                        description,
                        rawdescription: rawdescription,
                        methods: members.methods,
                        indexSignatures: members.indexSignatures,
                        properties: members.properties,
                        kind: members.kind,
                        constructor: members.constructor,
                        jsdoctags: jsdoctags,
                        extends: extendsElements,
                        implements: implementsElements,
                        accessors: members.accessors
                    }
                ];
            }
        }
        if (description) {
            return [
                {
                    ...deprecation,
                    description,
                    rawdescription: rawdescription,
                    inputs: members.inputs,
                    outputs: members.outputs,
                    hostBindings: members.hostBindings,
                    hostListeners: members.hostListeners,
                    methods: members.methods,
                    indexSignatures: members.indexSignatures,
                    properties: members.properties,
                    kind: members.kind,
                    constructor: members.constructor,
                    jsdoctags: jsdoctags,
                    extends: extendsElements,
                    implements: implementsElements,
                    accessors: members.accessors
                }
            ];
        } else {
            return [
                {
                    ...deprecation,
                    methods: members.methods,
                    inputs: members.inputs,
                    outputs: members.outputs,
                    hostBindings: members.hostBindings,
                    hostListeners: members.hostListeners,
                    indexSignatures: members.indexSignatures,
                    properties: members.properties,
                    kind: members.kind,
                    constructor: members.constructor,
                    jsdoctags: jsdoctags,
                    extends: extendsElements,
                    implements: implementsElements,
                    accessors: members.accessors
                }
            ];
        }
    }
}
