import * as crypto from 'node:crypto';
import { SyntaxKind, ts } from 'ts-morph';
import { isIgnore } from '../../../../../../utils';
import AngularVersionUtil from '../../../../../..//utils/angular-version.util';
import { StringifyArrowFunction } from '../../../../../../utils/arrow-function.util';
import BasicTypeUtil from '../../../../../../utils/basic-type.util';
import { JsdocParserUtil } from '../../../../../../utils/jsdoc-parser.util';
import { kindToType } from '../../../../../../utils/kind-to-type';
import { getNodeDecorators, nodeHasDecorator } from '../../../../../../utils/node.util';
import { StringifyObjectLiteralExpression } from '../../../../../../utils/object-literal-expression.util';
import { getNamesCompareFn, markedtags, mergeTagsAndArgs } from '../../../../../../utils/utils';
import Configuration from '../../../../../configuration';
import DependenciesEngine from '../../../../../engines/dependencies.engine';
import type { DecoratorInspector } from './decorator-inspector';
import type { JsdocExtractor } from './jsdoc-extractor';
import type { TypeRenderer } from './type-renderer';

export class MemberVisitor {
    private jsdocParserUtil = new JsdocParserUtil();

    constructor(
        private typeChecker: ts.TypeChecker,
        private typeRenderer: TypeRenderer,
        private jsdocExtractor: JsdocExtractor,
        private decoratorInspector: DecoratorInspector
    ) {}

    private stringifyDefaultValue(node: ts.Node): string {
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

    /**
     * Detect Angular signal primitives from a property's stringified default value.
     * Returns the signal kind and optional extracted type.
     */
    private detectSignalKind(
        defaultValue: string
    ): { kind: string; signalType?: string; required?: boolean } | undefined {
        if (!defaultValue) {
            return undefined;
        }
        const cleaned = defaultValue.replaceAll('\n', '');

        // Order matters: check specific patterns before generic ones
        const patterns: Array<{ pattern: RegExp; kind: string }> = [
            {
                pattern: /^input\.required\s*<([^>]+)>\s*\(/,
                kind: 'input-signal'
            },
            { pattern: /^input\s*(?:<([^>]+)>)?\s*\(/, kind: 'input-signal' },
            { pattern: /^output\s*(?:<([^>]+)>)?\s*\(/, kind: 'output-signal' },
            { pattern: /^model\s*(?:<([^>]+)>)?\s*\(/, kind: 'model' },
            { pattern: /^model\.required\s*<([^>]+)>\s*\(/, kind: 'model' },
            {
                pattern: /^linkedSignal\s*(?:<([^>]+)>)?\s*\(/,
                kind: 'linked-signal'
            },
            { pattern: /^computed\s*(?:<([^>]+)>)?\s*\(/, kind: 'computed' },
            { pattern: /^signal\s*(?:<([^>]+)>)?\s*\(/, kind: 'signal' },
            { pattern: /^effect\s*\(/, kind: 'effect' },
            { pattern: /^resource\s*(?:<([^>]+)>)?\s*\(/, kind: 'resource' },
            {
                pattern: /^rxResource\s*(?:<([^>]+)>)?\s*\(/,
                kind: 'rx-resource'
            },
            { pattern: /^viewChild\s*(?:<([^>]+)>)?\s*\(/, kind: 'view-child' },
            {
                pattern: /^viewChildren\s*(?:<([^>]+)>)?\s*\(/,
                kind: 'view-children'
            },
            {
                pattern: /^contentChild\s*(?:<([^>]+)>)?\s*\(/,
                kind: 'content-child'
            },
            {
                pattern: /^contentChildren\s*(?:<([^>]+)>)?\s*\(/,
                kind: 'content-children'
            },
            { pattern: /^afterRenderEffect\s*\(/, kind: 'after-render-effect' },
            { pattern: /^afterEveryRender\s*\(/, kind: 'after-every-render' },
            { pattern: /^afterNextRender\s*\(/, kind: 'after-next-render' },
            { pattern: /^afterRender\s*\(/, kind: 'after-render' },
            { pattern: /^inject\s*\(\s*([A-Z_]\w*)/, kind: 'inject' }
        ];

        for (const { pattern, kind } of patterns) {
            const match = pattern.exec(cleaned);
            if (match) {
                const result: {
                    kind: string;
                    signalType?: string;
                    required?: boolean;
                } = { kind };
                if (match[1]) {
                    result.signalType = match[1].trim();
                }
                if (cleaned.includes('.required')) {
                    result.required = true;
                }
                return result;
            }
        }
        return undefined;
    }

    private initializeDocumentationFields(): {
        deprecated: boolean;
        deprecationMessage: string;
        category: string;
    } {
        return {
            deprecated: false,
            deprecationMessage: '',
            category: ''
        };
    }

    /**
     * Extract and filter modifier kinds from a node
     */
    private extractModifierKinds(node: any): number[] | undefined {
        if (!node.modifiers || node.modifiers.length === 0) {
            return undefined;
        }
        let kinds = node.modifiers.map(modifier => modifier.kind);
        if (
            kinds.indexOf(SyntaxKind.PublicKeyword) !== -1 &&
            kinds.indexOf(SyntaxKind.StaticKeyword) !== -1
        ) {
            kinds = kinds.filter(kind => kind !== SyntaxKind.PublicKeyword);
        }
        return kinds;
    }

    /**
     * Ensure private keyword is added for ECMAScript private fields
     */
    private ensurePrivateKeyword(result: any, node: any): void {
        if (this.decoratorInspector.isPrivate(node)) {
            if (!result.modifierKind) {
                result.modifierKind = [];
            }
            const hasAlreadyPrivateKeyword = result.modifierKind.includes(
                SyntaxKind.PrivateKeyword
            );
            if (!hasAlreadyPrivateKeyword) {
                result.modifierKind.push(SyntaxKind.PrivateKeyword);
            }
        }
    }

    private formatDecorators(decorators) {
        const _decorators = [];

        decorators.forEach((decorator: any) => {
            if (decorator.expression) {
                if (decorator.expression.text) {
                    _decorators.push({ name: decorator.expression.text });
                }
                if (decorator.expression.expression) {
                    const info: any = {
                        name: decorator.expression.expression.text
                    };
                    if (decorator.expression.arguments) {
                        info.stringifiedArguments = this.stringifyArguments(
                            decorator.expression.arguments
                        );
                    }
                    _decorators.push(info);
                }
            }
        });

        return _decorators;
    }

    private handleFunction(arg): string {
        if (arg.function.length === 0) {
            return `${arg.name}${this.getOptionalString(arg)}: () => void`;
        }

        const argums = arg.function.map(argu => {
            const _result = DependenciesEngine.find(argu.type);
            if (_result) {
                if (_result.source === 'internal') {
                    let path = _result.data.type;
                    if (_result.data.type === 'class') {
                        path = 'classe';
                    }
                    return `${argu.name}${this.getOptionalString(arg)}: <a href="../${path}s/${
                        _result.data.name
                    }.html">${argu.type}</a>`;
                } else {
                    const path = AngularVersionUtil.getApiLink(
                        _result.data,
                        Configuration.mainData.angularVersion
                    );
                    return `${argu.name}${this.getOptionalString(
                        arg
                    )}: <a href="${path}" target="_blank">${argu.type}</a>`;
                }
            } else if (BasicTypeUtil.isKnownType(argu.type)) {
                const path = BasicTypeUtil.getTypeUrl(argu.type);
                return `${argu.name}${this.getOptionalString(
                    arg
                )}: <a href="${path}" target="_blank">${argu.type}</a>`;
            } else {
                if (argu.name && argu.type) {
                    return `${argu.name}${this.getOptionalString(arg)}: ${argu.type}`;
                } else {
                    if (argu.name) {
                        return `${argu.name.text}`;
                    } else {
                        return '';
                    }
                }
            }
        });
        return `${arg.name}${this.getOptionalString(arg)}: (${argums}) => void`;
    }

    private getOptionalString(arg): string {
        return arg.optional ? '?' : '';
    }

    private stringifyArguments(args) {
        let stringifyArgs = [];

        stringifyArgs = args
            .map(arg => {
                const _result = DependenciesEngine.find(arg.type);
                if (_result) {
                    if (_result.source === 'internal') {
                        let path = _result.data.type;
                        if (_result.data.type === 'class') {
                            path = 'classe';
                        }
                        return `${arg.name}${this.getOptionalString(arg)}: <a href="../${path}s/${
                            _result.data.name
                        }.html">${arg.type}</a>`;
                    } else {
                        const path = AngularVersionUtil.getApiLink(
                            _result.data,
                            Configuration.mainData.angularVersion
                        );
                        return `${arg.name}${this.getOptionalString(
                            arg
                        )}: <a href="${path}" target="_blank">${arg.type}</a>`;
                    }
                } else if (arg.dotDotDotToken) {
                    return `...${arg.name}: ${arg.type}`;
                } else if (arg.function) {
                    return this.handleFunction(arg);
                } else if (arg.expression && arg.name) {
                    return `${arg.expression.text}.${arg.name.text}`;
                } else if (arg.expression && arg.kind === SyntaxKind.NewExpression) {
                    return `new ${arg.expression.text}()`;
                } else if (arg.kind && arg.kind === SyntaxKind.StringLiteral) {
                    return `'${arg.text}'`;
                } else if (
                    arg.kind &&
                    arg.kind === SyntaxKind.ArrayLiteralExpression &&
                    arg.elements &&
                    arg.elements.length > 0
                ) {
                    let i = 0,
                        len = arg.elements.length,
                        result = '[';
                    for (i; i < len; i++) {
                        result += `'${arg.elements[i].text}'`;
                        if (i < len - 1) {
                            result += ', ';
                        }
                    }
                    result += ']';
                    return result;
                } else if (
                    arg.kind &&
                    arg.kind === SyntaxKind.ArrowFunction &&
                    arg.parameters &&
                    arg.parameters.length > 0
                ) {
                    return StringifyArrowFunction(arg);
                } else if (arg.kind && arg.kind === SyntaxKind.ObjectLiteralExpression) {
                    return StringifyObjectLiteralExpression(arg);
                } else if (BasicTypeUtil.isKnownType(arg.type)) {
                    const path = BasicTypeUtil.getTypeUrl(arg.type);
                    return `${arg.name}${this.getOptionalString(
                        arg
                    )}: <a href="${path}" target="_blank">${arg.type}</a>`;
                } else {
                    if (arg.type) {
                        let finalStringifiedArgument = '';
                        let separator = ':';
                        if (arg.name) {
                            finalStringifiedArgument += arg.name;
                        }
                        if (
                            arg.kind === SyntaxKind.AsExpression &&
                            arg.expression &&
                            arg.expression.text
                        ) {
                            finalStringifiedArgument += arg.expression.text;
                            separator = ' as';
                        }
                        if (arg.optional) {
                            finalStringifiedArgument += this.getOptionalString(arg);
                        }
                        if (arg.type) {
                            finalStringifiedArgument += `${separator} ${this.typeRenderer.visitType(arg.type)}`;
                        }
                        return finalStringifiedArgument;
                    } else if (arg.text) {
                        return `${arg.text}`;
                    } else {
                        return `${arg.name}${this.getOptionalString(arg)}`;
                    }
                }
            })
            .join(', ');

        return stringifyArgs;
    }

    private getPosition(node: ts.Node, sourceFile: ts.SourceFile): ts.LineAndCharacter {
        let position: ts.LineAndCharacter;
        if ((node as any).name?.end) {
            position = ts.getLineAndCharacterOfPosition(sourceFile, (node as any).name.end);
        } else {
            position = ts.getLineAndCharacterOfPosition(sourceFile, node.pos);
        }
        return position;
    }

    private addAccessor(accessors, nodeAccessor, sourceFile) {
        let nodeName = '';
        if (nodeAccessor.name) {
            nodeName = nodeAccessor.name.text;
            const jsdoctags = this.jsdocParserUtil.getJSDocs(nodeAccessor);

            if (!accessors[nodeName]) {
                accessors[nodeName] = {
                    name: nodeName,
                    setSignature: undefined,
                    getSignature: undefined
                };
            }

            if (nodeAccessor.kind === SyntaxKind.SetAccessor) {
                const setSignature: any = {
                    name: nodeName,
                    type: 'void',
                    ...this.initializeDocumentationFields(),
                    args: nodeAccessor.parameters.map(param => this.visitArgument(param)),
                    returnType: nodeAccessor.type
                        ? this.typeRenderer.visitType(nodeAccessor.type)
                        : 'void',
                    line: this.getPosition(nodeAccessor, sourceFile).line + 1
                };

                this.jsdocExtractor.extractAndProcessJSDocComment(
                    nodeAccessor,
                    sourceFile,
                    setSignature
                );
                this.jsdocExtractor.processJSDocTags(jsdoctags, setSignature);

                if (setSignature.jsdoctags && setSignature.jsdoctags.length > 0) {
                    setSignature.jsdoctags = mergeTagsAndArgs(
                        setSignature.args,
                        setSignature.jsdoctags
                    );
                } else if (setSignature.args && setSignature.args.length > 0) {
                    setSignature.jsdoctags = mergeTagsAndArgs(setSignature.args);
                }

                accessors[nodeName].setSignature = setSignature;
            }
            if (nodeAccessor.kind === SyntaxKind.GetAccessor) {
                const getSignature: any = {
                    name: nodeName,
                    type: nodeAccessor.type ? kindToType(nodeAccessor.type.kind) : '',
                    returnType: nodeAccessor.type
                        ? this.typeRenderer.visitType(nodeAccessor.type)
                        : '',
                    line: this.getPosition(nodeAccessor, sourceFile).line + 1
                };

                this.jsdocExtractor.extractAndProcessJSDocComment(
                    nodeAccessor,
                    sourceFile,
                    getSignature
                );
                this.jsdocExtractor.processJSDocTags(jsdoctags, getSignature);

                accessors[nodeName].getSignature = getSignature;
            }
        }
    }

    public visitMembers(members: any, sourceFile: any) {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const inputs = [];
        const outputs = [];
        const hostBindings = [];
        const hostListeners = [];
        const methods = [];
        const properties = [];
        const indexSignatures = [];
        let kind;
        let constructor;
        const accessors = {};
        let result = {};

        // A constructor with parameters on an Angular class is injection, which
        // is not documented; plain classes keep their constructor.
        const injectsThroughConstructor =
            members.length > 0 && this.decoratorInspector.isAngularClass(members[0].parent);

        for (let i = 0; i < members.length; i++) {
            // Allows typescript guess type when using ts.is*
            const member = members[i];

            kind = member.kind;

            if (isIgnore(member)) {
                continue;
            }

            if (
                this.decoratorInspector.isInternal(member) &&
                Configuration.mainData.disableInternal
            ) {
                continue;
            }

            if (!this.decoratorInspector.isHiddenMember(member)) {
                if (
                    !(
                        this.decoratorInspector.isPrivate(member) &&
                        Configuration.mainData.disablePrivate
                    )
                ) {
                    if (
                        !(
                            this.decoratorInspector.isInternal(member) &&
                            Configuration.mainData.disableInternal
                        )
                    ) {
                        if (
                            !(
                                this.decoratorInspector.isProtected(member) &&
                                Configuration.mainData.disableProtected
                            )
                        ) {
                            if (ts.isMethodDeclaration(member) || ts.isMethodSignature(member)) {
                                methods.push(this.visitMethodDeclaration(member, sourceFile));
                            } else if (
                                ts.isPropertyDeclaration(member) ||
                                ts.isPropertySignature(member)
                            ) {
                                properties.push(this.visitProperty(member, sourceFile));
                            } else if (ts.isCallSignatureDeclaration(member)) {
                                properties.push(this.visitCallDeclaration(member, sourceFile));
                            } else if (
                                ts.isGetAccessorDeclaration(member) ||
                                ts.isSetAccessorDeclaration(member)
                            ) {
                                this.addAccessor(accessors, members[i], sourceFile);
                            } else if (ts.isIndexSignatureDeclaration(member)) {
                                indexSignatures.push(
                                    this.visitIndexDeclaration(member, sourceFile)
                                );
                            } else if (
                                ts.isConstructorDeclaration(member) &&
                                !(injectsThroughConstructor && member.parameters.length > 0)
                            ) {
                                const _constructorProperties = this.visitConstructorProperties(
                                    member,
                                    sourceFile
                                );
                                let j = 0;
                                const len = _constructorProperties.length;
                                for (j; j < len; j++) {
                                    properties.push(_constructorProperties[j]);
                                }
                                constructor = this.visitConstructorDeclaration(member, sourceFile);
                            }
                        }
                    }
                }
            }
        }

        inputs.sort(getNamesCompareFn());
        outputs.sort(getNamesCompareFn());
        hostBindings.sort(getNamesCompareFn());
        hostListeners.sort(getNamesCompareFn());
        properties.sort(getNamesCompareFn());
        methods.sort(getNamesCompareFn());
        indexSignatures.sort(getNamesCompareFn());

        result = {
            inputs,
            outputs,
            hostBindings,
            hostListeners,
            methods,
            properties,
            indexSignatures,
            kind,
            constructor
        };

        if (Object.keys(accessors).length) {
            result['accessors'] = accessors;
        }

        return result;
    }

    private visitCallDeclaration(method: ts.CallSignatureDeclaration, sourceFile: ts.SourceFile) {
        const sourceCode = sourceFile.getText();
        const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
        const result: any = {
            id: `call-declaration-${hash}`,
            args: method.parameters ? method.parameters.map(prop => this.visitArgument(prop)) : [],
            returnType: this.typeRenderer.visitType(method.type),
            line: this.getPosition(method, sourceFile).line + 1,
            ...this.initializeDocumentationFields()
        };
        this.jsdocExtractor.extractAndProcessJSDocComment(method, sourceFile, result);
        const jsdoctags = this.jsdocParserUtil.getJSDocs(method);
        this.jsdocExtractor.processJSDocTags(jsdoctags, result);
        return result;
    }

    private visitIndexDeclaration(
        method: ts.IndexSignatureDeclaration,
        sourceFile?: ts.SourceFile
    ) {
        const sourceCode = sourceFile.getText();
        const hash = crypto.createHash('sha512').update(sourceCode).digest('hex');
        const result = {
            id: `index-declaration-${hash}`,
            args: method.parameters ? method.parameters.map(prop => this.visitArgument(prop)) : [],
            returnType: this.typeRenderer.visitType(method.type),
            line: this.getPosition(method, sourceFile).line + 1,
            ...this.initializeDocumentationFields()
        };
        this.jsdocExtractor.extractAndProcessJSDocComment(method, sourceFile, result);
        const jsdoctags = this.jsdocParserUtil.getJSDocs(method);
        this.jsdocExtractor.processJSDocTags(jsdoctags, result);
        return result;
    }

    private visitConstructorDeclaration(
        method: ts.ConstructorDeclaration,
        sourceFile?: ts.SourceFile
    ) {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const result: any = {
            name: 'constructor',
            description: '',
            ...this.initializeDocumentationFields(),
            args: method.parameters ? method.parameters.map(prop => this.visitArgument(prop)) : [],
            line: this.getPosition(method, sourceFile).line + 1
        };
        this.jsdocExtractor.extractAndProcessJSDocComment(method, sourceFile, result);

        const kinds = this.extractModifierKinds(method);
        if (kinds) {
            result.modifierKind = kinds;
        }

        const jsdoctags = this.jsdocParserUtil.getJSDocs(method);
        this.jsdocExtractor.processJSDocTags(jsdoctags, result);

        if (result.jsdoctags && result.jsdoctags.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args, result.jsdoctags);
        } else if (result.args.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args);
        }

        // Thread @param descriptions back into `result.args` so downstream
        // consumers (e.g. `DependenciesSection`) that don't walk
        // `jsdoctags` still see the per-parameter description text.
        if (result.args.length > 0 && result.jsdoctags?.length > 0) {
            const commentByName = new Map<string, any>();
            for (const tag of result.jsdoctags) {
                const tagName = tag.name?.text ?? tag.name;
                if (tagName && tag.comment) {
                    commentByName.set(String(tagName), tag.comment);
                }
            }
            for (const arg of result.args) {
                const comment = commentByName.get(arg.name);
                if (comment != null) {
                    arg.description = comment;
                }
            }
        }
        return result;
    }

    private visitProperty(property: ts.PropertyDeclaration | ts.PropertySignature, sourceFile) {
        // PropertySignature (interfaces) don't have initializer, PropertyDeclaration (classes) do
        const initializer = ts.isPropertyDeclaration(property) ? property.initializer : undefined;

        // Extract property name, handling different node types:
        // - Identifier: regular property names
        // - PrivateIdentifier: ECMAScript private fields like #privateField
        // - ComputedPropertyName: computed names like ['__allAnd']
        let propertyName = '';
        // Check for mock objects first (for testing)
        if ((property.name as any).text) {
            propertyName = (property.name as any).text;
        } else if (ts.isIdentifier(property.name)) {
            propertyName = property.name.text;
        } else if (ts.isPrivateIdentifier(property.name)) {
            propertyName = property.name.text; // includes the # prefix
        } else if (ts.isComputedPropertyName(property.name)) {
            // Handle computed property names like ['__allAnd']
            if (ts.isStringLiteral(property.name.expression)) {
                propertyName = property.name.expression.text;
            } else if (ts.isIdentifier(property.name.expression)) {
                propertyName = property.name.expression.text;
            }
        }

        const result: any = {
            name: propertyName,
            defaultValue: initializer ? this.stringifyDefaultValue(initializer) : undefined,
            ...this.initializeDocumentationFields(),
            type: this.typeRenderer.visitType(property),
            indexKey: this.typeRenderer.visitTypeIndex(property),
            optional: typeof property.questionToken !== 'undefined',
            description: '',
            line: this.getPosition(property, sourceFile).line + 1
        };

        if (initializer && initializer.kind === SyntaxKind.ArrowFunction) {
            result.defaultValue = '() => {...}';
        }

        // Detect signal primitives from initializer
        if (result.defaultValue) {
            const signalKind = this.detectSignalKind(result.defaultValue);
            if (signalKind) {
                result.signalKind = signalKind.kind;
                if (signalKind.signalType) {
                    result.type = signalKind.signalType;
                }
                if (signalKind.required) {
                    result.required = true;
                }
            }
        }

        // Extract signal dependency names for computed/linkedSignal.
        // `this.xxx()` → recorded as 'xxx()'; `this.xxx` (plain access) → recorded as 'xxx'.
        if (
            initializer &&
            (result.signalKind === 'computed' || result.signalKind === 'linked-signal')
        ) {
            const deps: string[] = [];
            const walk = (node: any, parent: any): void => {
                if (
                    node.kind === SyntaxKind.PropertyAccessExpression &&
                    node.expression?.kind === SyntaxKind.ThisKeyword
                ) {
                    const isCalled =
                        parent &&
                        parent.kind === SyntaxKind.CallExpression &&
                        parent.expression === node;
                    deps.push(isCalled ? `${node.name.text}()` : node.name.text);
                }
                ts.forEachChild(node, child => walk(child, node));
            };
            ts.forEachChild(initializer, child => walk(child, initializer));
            if (deps.length > 0) {
                result.signalDeps = [...new Set(deps)];
            }
        }

        if (typeof result.name === 'undefined' && (property.name as any).expression) {
            result.name = (property.name as any).expression.text;
        }

        this.jsdocExtractor.extractAndProcessJSDocComment(property, sourceFile, result);

        if (nodeHasDecorator(property)) {
            const propertyDecorators = getNodeDecorators(property);
            result.decorators = this.formatDecorators(propertyDecorators);
        }

        const kinds = this.extractModifierKinds(property);
        if (kinds) {
            result.modifierKind = kinds;
        }
        // Check for ECMAScript Private Fields
        this.ensurePrivateKeyword(result, property);

        const jsdoctags = this.jsdocParserUtil.getJSDocs(property);
        if (jsdoctags && jsdoctags.length >= 1) {
            const jsdoc = jsdoctags[0] as any;
            if (jsdoc?.tags) {
                this.jsdocExtractor.checkForDeprecation(jsdoc.tags, result);
                if ((property as any).jsDoc) {
                    result.jsdoctags = markedtags(jsdoc.tags);
                }
            }
        }

        return result;
    }

    private visitConstructorProperties(constr, sourceFile) {
        if (constr.parameters) {
            const _parameters = [];
            let i = 0;
            const len = constr.parameters.length;
            for (i; i < len; i++) {
                const parameterOfConstructor = constr.parameters[i];
                if (isIgnore(parameterOfConstructor)) {
                    continue;
                }
                if (
                    this.decoratorInspector.isInternal(parameterOfConstructor) &&
                    Configuration.mainData.disableInternal
                ) {
                    continue;
                }
                if (this.decoratorInspector.isPublic(parameterOfConstructor)) {
                    _parameters.push(this.visitProperty(constr.parameters[i], sourceFile));
                }
            }
            /**
             * Merge JSDoc tags description from constructor with parameters
             */
            if (constr.jsDoc) {
                if (constr.jsDoc.length > 0) {
                    const constrTags = constr.jsDoc[0].tags;
                    if (constrTags && constrTags.length > 0) {
                        constrTags.forEach(tag => {
                            _parameters.forEach(param => {
                                if (
                                    tag.tagName?.escapedText &&
                                    tag.tagName.escapedText === 'param'
                                ) {
                                    if (
                                        tag.name?.escapedText &&
                                        tag.name.escapedText === param.name
                                    ) {
                                        param.description = tag.comment;
                                    }
                                }
                            });
                        });
                    }
                }
            }
            return _parameters;
        } else {
            return [];
        }
    }

    private visitMethodDeclaration(
        method: ts.MethodDeclaration | ts.MethodSignature,
        sourceFile: ts.SourceFile
    ) {
        const result: any = {
            name:
                (method.name as any).text || (ts.isIdentifier(method.name) ? method.name.text : ''),
            args: method.parameters ? method.parameters.map(prop => this.visitArgument(prop)) : [],
            optional: typeof method.questionToken !== 'undefined',
            returnType: this.typeRenderer.visitType(method.type),
            typeParameters: [],
            line: this.getPosition(method, sourceFile).line + 1,
            ...this.initializeDocumentationFields()
        };

        if (typeof method.type === 'undefined') {
            // Try to get inferred type
            if ((method as any).symbol) {
                const symbol: ts.Symbol = (method as any).symbol;
                if (symbol.valueDeclaration) {
                    const symbolType = this.typeChecker.getTypeOfSymbolAtLocation(
                        symbol,
                        symbol.valueDeclaration
                    );
                    if (symbolType) {
                        try {
                            const signature = this.typeChecker.getSignatureFromDeclaration(method);
                            const returnType = signature.getReturnType();
                            result.returnType = this.typeChecker.typeToString(returnType);
                            // tslint:disable-next-line:no-empty
                        } catch (_error) {}
                    }
                }
            }
        }

        if (method.typeParameters && method.typeParameters.length > 0) {
            result.typeParameters = method.typeParameters.map(typeParameter =>
                this.typeRenderer.visitType(typeParameter)
            );
        }

        this.jsdocExtractor.extractAndProcessJSDocComment(method, sourceFile, result);

        if (nodeHasDecorator(method)) {
            const methodDecorators = getNodeDecorators(method);
            result.decorators = this.formatDecorators(methodDecorators);
        }

        const kinds = this.extractModifierKinds(method);
        if (kinds) {
            result.modifierKind = kinds;
        }
        // Check for ECMAScript Private Fields
        this.ensurePrivateKeyword(result, method);

        const jsdoctags = this.jsdocParserUtil.getJSDocs(method);
        this.jsdocExtractor.processJSDocTags(jsdoctags, result);

        if (result.jsdoctags && result.jsdoctags.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args, result.jsdoctags);
        } else if (result.args.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args);
        }
        return result;
    }

    private visitArgument(arg: ts.ParameterDeclaration) {
        const _result: any = {
            name: (arg.name as any).text || (ts.isIdentifier(arg.name) ? arg.name.text : ''),
            type: this.typeRenderer.visitType(arg),
            optional: !!arg.questionToken,
            dotDotDotToken: !!arg.dotDotDotToken,
            ...this.initializeDocumentationFields()
        };
        if (arg.type?.kind && ts.isFunctionTypeNode(arg.type)) {
            _result.function = arg.type.parameters
                ? arg.type.parameters.map(prop => this.visitArgument(prop))
                : [];
        }
        if (arg.initializer) {
            _result.defaultValue = this.stringifyDefaultValue(arg.initializer);
        }
        const jsdoctags = this.jsdocParserUtil.getJSDocs(arg);
        this.jsdocExtractor.processJSDocTags(jsdoctags, _result, false);
        return _result;
    }
}
