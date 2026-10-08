import { SyntaxKind, type ts } from 'ts-morph';
import { v4 as uuidv4 } from 'uuid';
import type { JsdocParserUtil } from '../../../utils';
import { IsKindType, kindToType } from '../../../utils/kind-to-type';
import { markedAcl } from '../../../utils/marked.acl';
import { markedtags, mergeTagsAndArgs } from '../../../utils/utils';
import type { ClassHelper } from '../angular/deps/helpers/class-helper';
import type { JsdocTags } from './jsdoc-tags';

export class EntityVisitor {
    constructor(
        private readonly classHelper: ClassHelper,
        private readonly jsdocParserUtil: JsdocParserUtil,
        private readonly jsdocTags: JsdocTags
    ) {}

    public visitTypeDeclaration(node: ts.TypeAliasDeclaration) {
        const result: any = {
            deprecated: false,
            deprecationMessage: '',
            name: node.name.text,
            kind: node.kind
        };
        const jsdoctags = this.jsdocParserUtil.getJSDocs(node);

        if (jsdoctags && jsdoctags.length >= 1 && (jsdoctags[0] as any).tags) {
            this.jsdocTags.checkForDeprecation((jsdoctags[0] as any).tags, result);
            result.jsdoctags = markedtags((jsdoctags[0] as any).tags);
        }
        return result;
    }

    public visitArgument(arg) {
        if (arg.name && arg.name.kind === SyntaxKind.ObjectBindingPattern) {
            let results = [];

            const destrucuredGroupId = uuidv4();

            results = arg.name.elements.map(element => this.visitArgument(element));

            results = results.map(result => {
                result.destrucuredGroupId = destrucuredGroupId;
                return result;
            });

            if (arg.name.elements && arg.type?.members) {
                if (arg.name.elements.length === arg.type.members.length) {
                    for (let i = 0; i < arg.name.elements.length; i++) {
                        results[i].type = this.classHelper.visitType(arg.type.members[i]);
                    }
                }
            }

            if (arg.name.elements && arg.type?.typeName) {
                results[0].type = this.classHelper.visitType(arg.type);
            }

            return results;
        } else {
            const result: any = {
                name: arg.name.text,
                type: this.classHelper.visitType(arg),
                deprecated: false,
                deprecationMessage: ''
            };

            if (arg.dotDotDotToken) {
                result.dotDotDotToken = true;
            }
            if (arg.questionToken) {
                result.optional = true;
            }
            if (arg.initializer) {
                result.defaultValue = arg.initializer
                    ? this.classHelper.stringifyDefaultValue(arg.initializer)
                    : undefined;
            }
            const jsdoctags = this.jsdocParserUtil.getJSDocs(arg);

            if (jsdoctags && jsdoctags.length >= 1 && (jsdoctags[0] as any).tags) {
                this.jsdocTags.checkForDeprecation((jsdoctags[0] as any).tags, result);
            }
            return result;
        }
    }

    public hasPrivateJSDocTag(tags): boolean {
        let result = false;
        if (tags) {
            tags.forEach(tag => {
                if (tag.tagName?.text && tag.tagName.text === 'private') {
                    result = true;
                }
            });
        }
        return result;
    }

    public visitFunctionDeclaration(method: ts.FunctionDeclaration) {
        const methodName = method.name ? method.name.text : 'Unnamed function';
        const resultArguments = [];
        const result: any = {
            deprecated: false,
            deprecationMessage: '',
            name: methodName
        };

        for (const element of method.parameters) {
            const argument = element;
            if (argument) {
                const argumentParsed = this.visitArgument(argument);
                if (argumentParsed.length > 0) {
                    for (const element of argumentParsed) {
                        const argumentParsedInside = element;
                        argumentParsedInside.destructuredParameter = true;
                        resultArguments.push(argumentParsedInside);
                    }
                } else {
                    resultArguments.push(argumentParsed);
                }
            }
        }

        result.args = resultArguments;

        const jsdoctags = this.jsdocParserUtil.getJSDocs(method);

        if (typeof method.type !== 'undefined') {
            result.returnType = this.classHelper.visitType(method.type);
        }

        if (method.modifiers) {
            if (method.modifiers.length > 0) {
                let kinds = method.modifiers
                    .map(modifier => {
                        return modifier.kind;
                    })
                    .reverse();
                if (
                    kinds.indexOf(SyntaxKind.PublicKeyword) !== -1 &&
                    kinds.indexOf(SyntaxKind.StaticKeyword) !== -1
                ) {
                    kinds = kinds.filter(kind => kind !== SyntaxKind.PublicKeyword);
                }
            }
        }
        if (jsdoctags && jsdoctags.length >= 1 && (jsdoctags[0] as any).tags) {
            this.jsdocTags.checkForDeprecation((jsdoctags[0] as any).tags, result);
            result.jsdoctags = markedtags((jsdoctags[0] as any).tags);
            (jsdoctags[0] as any).tags.forEach(tag => {
                if (tag.tagName) {
                    if (tag.tagName.text) {
                        if (tag.tagName.text.indexOf('ignore') > -1) {
                            result.ignore = true;
                        }
                    }
                }
            });
        }
        if (result.jsdoctags && result.jsdoctags.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args, result.jsdoctags);
        } else if (result.args.length > 0) {
            result.jsdoctags = mergeTagsAndArgs(result.args);
        }
        return result;
    }

    public visitVariableDeclaration(node) {
        const decl = node.declarationList?.declarations?.[0];
        if (decl) {
            const result: any = {
                name: decl.name.text,
                defaultValue: decl.initializer
                    ? this.classHelper.stringifyDefaultValue(decl.initializer)
                    : undefined,
                deprecated: false,
                deprecationMessage: ''
            };
            if (decl.initializer) {
                result.initializer = decl.initializer;
            }
            if (decl.type) {
                result.type = this.classHelper.visitType(decl.type);
            }
            if (typeof result.type === 'undefined' && result.initializer) {
                result.type = kindToType(result.initializer.kind);
            }
            const jsdoctags = this.jsdocParserUtil.getJSDocs(decl);
            if (jsdoctags && jsdoctags.length >= 1 && (jsdoctags[0] as any).tags) {
                this.jsdocTags.checkForDeprecation((jsdoctags[0] as any).tags, result);
            }
            return result;
        }
    }

    public visitEnumTypeAliasFunctionDeclarationDescription(node): string {
        let description: string = '';
        if (node.jsDoc) {
            if (node.jsDoc.length > 0) {
                if (typeof node.jsDoc[0].comment !== 'undefined') {
                    const rawDescription = this.jsdocParserUtil.parseJSDocNode(node.jsDoc[0]);
                    description = markedAcl(rawDescription);
                }
            }
        }
        return description;
    }

    public visitEnumDeclaration(node: ts.EnumDeclaration) {
        const result: any = {
            deprecated: false,
            deprecationMessage: '',
            name: node.name.text,
            members: []
        };
        if (node.members) {
            let i = 0;
            const len = node.members.length;
            let memberjsdoctags = [];
            for (i; i < len; i++) {
                const member: any = {
                    name: (node.members[i].name as any).text,
                    deprecated: false,
                    deprecationMessage: ''
                };
                if (node.members[i].initializer) {
                    // if the initializer kind is a number do cast to the number type
                    member.value = IsKindType.NUMBER(node.members[i].initializer.kind)
                        ? Number((node.members[i].initializer as any).text)
                        : (node.members[i].initializer as any).text;
                }
                memberjsdoctags = [...this.jsdocParserUtil.getJSDocs(node.members[i])];
                if (
                    memberjsdoctags &&
                    memberjsdoctags.length >= 1 &&
                    (memberjsdoctags[0] as any).tags
                ) {
                    this.jsdocTags.checkForDeprecation((memberjsdoctags[0] as any).tags, member);
                }
                result.members.push(member);
            }
        }
        const jsdoctags = this.jsdocParserUtil.getJSDocs(node);
        if (jsdoctags && jsdoctags.length >= 1 && (jsdoctags[0] as any).tags) {
            this.jsdocTags.checkForDeprecation((jsdoctags[0] as any).tags, result);
        }
        return result;
    }
}
