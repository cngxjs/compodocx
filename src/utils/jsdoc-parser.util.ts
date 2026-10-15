import { SyntaxKind, ts } from 'ts-morph';

import * as _ts from './ts-internal';

export class JsdocParserUtil {
    public isVariableLike(node: ts.Node): node is ts.VariableLikeDeclaration {
        if (node) {
            switch (node.kind) {
                case SyntaxKind.BindingElement:
                case SyntaxKind.EnumMember:
                case SyntaxKind.Parameter:
                case SyntaxKind.PropertyAssignment:
                case SyntaxKind.PropertyDeclaration:
                case SyntaxKind.PropertySignature:
                case SyntaxKind.ShorthandPropertyAssignment:
                case SyntaxKind.VariableDeclaration:
                    return true;
            }
        }
        return false;
    }

    isTopmostModuleDeclaration(node: ts.ModuleDeclaration): boolean {
        if (
            (node as any).nextContainer &&
            (node as any).nextContainer.kind === ts.SyntaxKind.ModuleDeclaration
        ) {
            const next = <ts.ModuleDeclaration>(node as any).nextContainer;
            if (node.name.end + 1 === next.name.pos) {
                return false;
            }
        }

        return true;
    }

    getRootModuleDeclaration(node: ts.ModuleDeclaration): ts.Node {
        while (node.parent && node.parent.kind === ts.SyntaxKind.ModuleDeclaration) {
            const parent = <ts.ModuleDeclaration>node.parent;
            if (node.name.pos === parent.name.end + 1) {
                node = parent;
            } else {
                break;
            }
        }

        return node;
    }

    public getMainCommentOfNode(node: ts.Node, sourceFile?: ts.SourceFile): string {
        let description: string = '';

        if (node.parent && node.parent.kind === ts.SyntaxKind.VariableDeclarationList) {
            node = node.parent.parent;
        } else if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
            if (!this.isTopmostModuleDeclaration(<ts.ModuleDeclaration>node)) {
                return null;
            } else {
                node = this.getRootModuleDeclaration(<ts.ModuleDeclaration>node);
            }
        }

        const comments = _ts.getJSDocCommentRanges(node, sourceFile.text);
        if (comments?.length) {
            let comment: ts.CommentRange;
            if (node.kind === ts.SyntaxKind.SourceFile) {
                if (comments.length === 1) {
                    return null;
                }
                comment = comments[0];
            } else {
                comment = comments[comments.length - 1];
            }

            description = sourceFile.text.substring(comment.pos, comment.end);
        }
        return description;
    }

    public parseComment(text: string): string {
        let comment = '';
        let shortText = 0;

        function readBareLine(line: string) {
            comment += `\n${line}`;
            if (line === '' && shortText === 0) {
                // Ignore
            } else if (line === '' && shortText === 1) {
                shortText = 2;
            } else {
                if (shortText === 2) {
                    comment += (comment === '' ? '' : '\n') + line;
                }
            }
        }

        const CODE_FENCE = /^\s*```(?!.*```)/;
        let inCode = false;
        let inExample = false; // first line with @example, end line with empty string or string or */
        let exampleHasCodeFence = false; // track if the example already has code fences
        function readLine(line: string, index: number) {
            const _originalLine = line;
            line = line.replace(/^\s*\*? ?/, '');
            line = line.replace(/\s*$/, '');

            if (CODE_FENCE.test(line)) {
                inCode = !inCode;
                if (inExample) {
                    exampleHasCodeFence = true;
                }
            }

            if (line.indexOf('@example') !== -1) {
                inExample = true;
                exampleHasCodeFence = false;
                // Check if the next non-empty line has a code fence
                const lines = text.split(/\r\n?|\n/);
                for (let i = index + 1; i < lines.length; i++) {
                    const nextLine = lines[i].replace(/^\s*\*? ?/, '').replace(/\s*$/, '');
                    if (nextLine === '') {
                        continue; // Skip empty lines
                    }
                    if (CODE_FENCE.test(nextLine)) {
                        exampleHasCodeFence = true;
                    }
                    break; // Only check the first non-empty line
                }

                if (!exampleHasCodeFence) {
                    line = '```html';
                } else {
                    // Skip the @example line if it already has code fences
                    return;
                }
            }

            // Preserve empty lines within code blocks by using a placeholder
            if (inCode && inExample && exampleHasCodeFence && line === '') {
                line = '___COMPODOC_EMPTY_LINE___';
            }

            if (inExample && line === '') {
                inExample = false;
                if (!exampleHasCodeFence) {
                    line = '```';
                } else {
                    // Don't add closing fence if example has its own
                    return;
                }
            }

            if (!inCode) {
                const tag = /^@(\S+)/.exec(line);
                const SeeTag = /^@see/.exec(line);

                if (SeeTag) {
                    line = line.replace(/^@see/, 'See');
                }

                if (tag && !SeeTag) {
                    return;
                }
            }

            readBareLine(line);
        }

        text = text.replace(/^\s*\/\*+/, '');
        text = text.replace(/\*+\/\s*$/, '');

        text.split(/\r\n?|\n/).forEach((line, index) => readLine(line, index));

        return comment;
    }

    private getJSDocTags(node: ts.Node, kind: SyntaxKind): ts.JSDocTag[] {
        const docs = this.getJSDocs(node);
        if (docs) {
            const result: ts.JSDocTag[] = [];
            for (const doc of docs) {
                if (ts.isJSDocParameterTag(doc)) {
                    if (doc.kind === kind) {
                        result.push(doc);
                    }
                } else if (ts.isJSDoc(doc)) {
                    result.push(...(doc.tags ?? []).filter(tag => tag.kind === kind));
                } else {
                    throw new Error('Unexpected type');
                }
            }
            return result;
        }
    }

    public getJSDocs(node: ts.Node): ReadonlyArray<ts.JSDoc | ts.JSDocTag> {
        // TODO: jsDocCache is internal, see if there's a way around it
        let cache: ReadonlyArray<ts.JSDoc | ts.JSDocTag> = (node as any).jsDocCache;
        if (!cache) {
            cache = this.getJSDocsWorker(node, []).filter(x => x);
            (node as any).jsDocCache = cache;
        }
        return cache;
    }

    // Try to recognize this pattern when node is initializer
    // of variable declaration and JSDoc comments are on containing variable statement.
    // /**
    //   * @param {number} name
    //   * @returns {number}
    //   */
    // var x = function(name) { return name.length; }
    private getJSDocsWorker(node: ts.Node, cache): ReadonlyArray<any> {
        const parent = node.parent;
        const isInitializerOfVariableDeclarationInStatement =
            this.isVariableLike(parent) &&
            (parent as any).initializer === node &&
            ts.isVariableStatement(parent.parent.parent);
        const isVariableOfVariableDeclarationStatement =
            this.isVariableLike(node) && ts.isVariableStatement(parent.parent);
        const variableStatementNode = isInitializerOfVariableDeclarationInStatement
            ? parent.parent.parent
            : isVariableOfVariableDeclarationStatement
              ? parent.parent
              : undefined;
        if (variableStatementNode) {
            cache = this.getJSDocsWorker(variableStatementNode, cache);
        }

        // Also recognize when the node is the RHS of an assignment expression
        const isSourceOfAssignmentExpressionStatement =
            parent?.parent &&
            ts.isBinaryExpression(parent) &&
            parent.operatorToken.kind === SyntaxKind.EqualsToken &&
            ts.isExpressionStatement(parent.parent);
        if (isSourceOfAssignmentExpressionStatement) {
            cache = this.getJSDocsWorker(parent.parent, cache);
        }

        const isModuleDeclaration =
            ts.isModuleDeclaration(node) && parent && ts.isModuleDeclaration(parent);
        const isPropertyAssignmentExpression = parent && ts.isPropertyAssignment(parent);
        if (isModuleDeclaration || isPropertyAssignmentExpression) {
            cache = this.getJSDocsWorker(parent, cache);
        }

        // Pull parameter comments from declaring function as well
        if (ts.isParameter(node)) {
            cache = [...cache, ...(this.getJSDocParameterTags(node) ?? [])];
        }

        if (this.isVariableLike(node) && (node as any).initializer) {
            const initializerJsDoc = ((node as any).initializer as any).jsDoc;
            if (initializerJsDoc) {
                cache = [...cache, ...initializerJsDoc];
            }
        }

        const nodeJsDoc = (node as any).jsDoc;
        if (nodeJsDoc) {
            cache = [...cache, ...nodeJsDoc];
        }

        return cache;
    }

    private getJSDocParameterTags(
        param: ts.ParameterDeclaration
    ): ReadonlyArray<ts.JSDocParameterTag> {
        const func = param.parent as ts.FunctionLikeDeclaration;
        const tags = this.getJSDocTags(
            func,
            SyntaxKind.JSDocParameterTag
        ) as ts.JSDocParameterTag[];

        if (!param.name) {
            // this is an anonymous jsdoc param from a `function(type1, type2): type3` specification
            const i = func.parameters.indexOf(param);
            const paramTags = tags.filter(tag => ts.isJSDocParameterTag(tag));

            if (paramTags && 0 <= i && i < paramTags.length) {
                return [paramTags[i]];
            }
        } else if (ts.isIdentifier(param.name)) {
            const name = param.name.text;
            return tags.filter(tag => {
                if (ts?.isJSDocParameterTag(tag)) {
                    const t = tag as any;
                    if (typeof t.parameterName !== 'undefined') {
                        return t.parameterName.text === name;
                    } else if (typeof t.name !== 'undefined') {
                        if (typeof t.name.escapedText !== 'undefined') {
                            return t.name.escapedText === name;
                        }
                    }
                }
            });
        } else {
            // TODO: it's a destructured parameter, so it should look up an "object type" series of multiple lines
            // But multi-line object types aren't supported yet either
            return undefined;
        }
    }

    public parseJSDocNode(node): string {
        let rawDescription = '';

        if (typeof node.comment === 'string') {
            rawDescription += node.comment;
        } else {
            if (node.comment) {
                const len = node.comment.length;

                for (let i = 0; i < len; i++) {
                    const JSDocNode = node.comment[i];
                    switch (JSDocNode.kind) {
                        case SyntaxKind.JSDocComment:
                            rawDescription += JSDocNode.comment;
                            break;
                        case SyntaxKind.JSDocText:
                            rawDescription += JSDocNode.text;
                            break;
                        case SyntaxKind.JSDocLink:
                        case SyntaxKind.JSDocLinkCode:
                        case SyntaxKind.JSDocLinkPlain:
                            rawDescription += linkSource(JSDocNode);
                            break;
                        default:
                            break;
                    }
                }
                rawDescription = joinOpenLinks(rawDescription);
            }
        }

        return rawDescription;
    }
}

/**
 * TypeScript ends a link node at a line break and leaves the rest, comment
 * star included, in the next text node; a link left open at a line end is
 * joined with the next line by one space.
 */
const OPEN_LINK_LINE_RE = /(\{@link(?:code|plain)?\s[^}\n]*)\r?\n\s*\*?\s*/;
const joinOpenLinks = (text: string): string => {
    let joined = text;
    while (OPEN_LINK_LINE_RE.test(joined)) {
        joined = joined.replace(OPEN_LINK_LINE_RE, '$1 ');
    }
    return joined;
};

const LINK_KEYWORD: Readonly<Record<number, string>> = {
    [SyntaxKind.JSDocLink]: 'link',
    [SyntaxKind.JSDocLinkCode]: 'linkcode',
    [SyntaxKind.JSDocLinkPlain]: 'linkplain'
};

/** `Foo`, `Foo.bar` or `Foo#bar` of a link name node. */
const linkName = (name: any): string => {
    if (!name) {
        return '';
    }
    if (name.escapedText !== undefined) {
        return String(name.escapedText);
    }
    const sep = name.kind === SyntaxKind.JSDocMemberName ? '#' : '.';
    return `${linkName(name.left)}${sep}${linkName(name.right)}`;
};

/**
 * An inline `{@link}`, `{@linkcode}` or `{@linkplain}` as written: label,
 * pipe and URL kept, so the one resolver (`parseDescription`) sees the
 * source form. Without a source file the link is rebuilt from its parts.
 */
const linkSource = (node: any): string => {
    const sourceFile = typeof node.getSourceFile === 'function' ? node.getSourceFile() : undefined;
    if (sourceFile?.text) {
        return sourceFile.text.slice(node.pos, node.end);
    }
    const name = linkName(node.name);
    const text: string = node.text ?? '';
    const sep = !name || !text || /^[|#:]/.test(text) ? '' : ' ';
    return `{@${LINK_KEYWORD[node.kind]} ${name}${sep}${text}}`;
};
