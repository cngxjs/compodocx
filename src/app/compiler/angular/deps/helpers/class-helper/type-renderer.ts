import { SyntaxKind, ts } from 'ts-morph';
import { kindToType } from '../../../../../../utils/kind-to-type';

export class TypeRenderer {
    private visitTypeName(typeName: ts.Identifier) {
        if (typeName.escapedText) {
            return typeName.escapedText;
        }
        if (typeName.text) {
            return typeName.text;
        }
        if ((typeName as any).left && (typeName as any).right) {
            return (
                this.visitTypeName((typeName as any).left) +
                '.' +
                this.visitTypeName((typeName as any).right)
            );
        }
        return '';
    }

    public visitTypeIndex(node): string {
        const _return = '';

        if (!node) {
            return _return;
        }

        if (
            node.type &&
            node.type.kind === SyntaxKind.IndexedAccessType &&
            node.type.indexType?.literal
        ) {
            return this.visitTypeName(node.type.indexType.literal);
        }

        return _return;
    }

    public visitType(node): string {
        let _return = 'void';

        if (!node) {
            return _return;
        }

        if (node.typeName) {
            _return = this.visitTypeName(node.typeName);
        } else if (node.type) {
            if (
                node.type.kind &&
                !ts.isUnionTypeNode(node.type) &&
                !ts.isTupleTypeNode(node.type)
            ) {
                _return = kindToType(node.type.kind);
            }
            if (node.type.typeName) {
                _return = this.visitTypeName(node.type.typeName);
            }
            if (node.type.typeArguments) {
                _return += '<';
                const typeArguments = [];
                for (const argument of node.type.typeArguments) {
                    typeArguments.push(this.visitType(argument));
                }
                _return += typeArguments.join(', ');
                _return += '>';
            }
            if (node.type.elementType) {
                const _firstPart = this.visitType(node.type.elementType);
                _return = _firstPart + kindToType(node.type.kind);
                if (node.type.elementType.kind === SyntaxKind.ParenthesizedType) {
                    _return = `(${_firstPart})${kindToType(node.type.kind)}`;
                }
            }

            const parseTypesOrElements = (arr, separator) => {
                let i = 0;
                const len = arr.length;
                for (i; i < len; i++) {
                    const type = arr[i];

                    if (type.elementType) {
                        const _firstPart = this.visitType(type.elementType);
                        if (type.elementType.kind === SyntaxKind.ParenthesizedType) {
                            _return += `(${_firstPart})${kindToType(type.kind)}`;
                        } else {
                            _return += _firstPart + kindToType(type.kind);
                        }
                    } else {
                        if (ts.isLiteralTypeNode(type) && type.literal) {
                            if ((type.literal as any).text) {
                                _return += `"${(type.literal as any).text}"`;
                            } else {
                                _return += kindToType(type.literal.kind);
                            }
                        } else if ((type as any).typeName) {
                            _return += this.visitTypeName((type as any).typeName);
                        } else if (type.kind === SyntaxKind.RestType && type.type) {
                            _return += `...${this.visitType(type.type)}`;
                        } else {
                            _return += kindToType(type.kind);
                        }
                        if (type.typeArguments) {
                            _return += '<';
                            const typeArguments = [];
                            for (const argument of type.typeArguments) {
                                typeArguments.push(this.visitType(argument));
                            }
                            _return += typeArguments.join(', ');
                            _return += '>';
                        }
                    }
                    if (i < len - 1) {
                        _return += separator;
                    }
                }
            };

            if (node.type.elements && ts.isTupleTypeNode(node.type)) {
                _return = '[';
                parseTypesOrElements(node.type.elements, ', ');
                _return += ']';
            }
            if (node.type.types && ts.isUnionTypeNode(node.type)) {
                _return = '';
                parseTypesOrElements(node.type.types, ' | ');
            }
            if (node.type.elementTypes) {
                const elementTypes = node.type.elementTypes;
                let i = 0;
                const len = elementTypes.length;
                if (len > 0) {
                    _return = '[';

                    for (i; i < len; i++) {
                        const type = elementTypes[i];
                        if (type.kind === SyntaxKind.ArrayType && type.elementType) {
                            _return += kindToType(type.elementType.kind);
                            _return += kindToType(type.kind);
                        } else if ((type as any).typeName) {
                            // For type references, use the type name directly instead of kindToType + typeName
                            _return += this.visitTypeName((type as any).typeName);
                        } else {
                            _return += kindToType(type.kind);
                        }
                        if (ts.isLiteralTypeNode(type) && type.literal) {
                            if ((type.literal as any).text) {
                                _return += `"${(type.literal as any).text}"`;
                            } else {
                                _return += kindToType(type.literal.kind);
                            }
                        }
                        if (type.kind === SyntaxKind.RestType && type.type) {
                            _return += `...${this.visitType(type.type)}`;
                        }

                        if (
                            type.kind === SyntaxKind.TypeReference &&
                            type.typeName &&
                            typeof type.typeName.escapedText !== 'undefined' &&
                            type.typeName.escapedText === ''
                        ) {
                            continue;
                        }
                        if (i < len - 1) {
                            _return += ', ';
                        }
                    }
                    _return += ']';
                }
            }
            if (
                node.type &&
                node.type.kind === SyntaxKind.IndexedAccessType &&
                node.type.objectType?.typeName
            ) {
                _return = this.visitTypeName(node.type.objectType.typeName);
            }
        } else if (node.elementType) {
            _return = kindToType(node.elementType.kind) + kindToType(node.kind);
            if (node.elementType.typeName) {
                _return = this.visitTypeName(node.elementType.typeName) + kindToType(node.kind);
            }
        } else if (node.types && ts.isUnionTypeNode(node)) {
            _return = '';
            let i = 0;
            const len = node.types.length;
            for (i; i < len; i++) {
                const type = node.types[i];
                if (ts.isLiteralTypeNode(type) && type.literal) {
                    if ((type.literal as any).text) {
                        _return += `"${(type.literal as any).text}"`;
                    } else {
                        _return += kindToType(type.literal.kind);
                    }
                } else if ((type as any).typeName) {
                    _return += this.visitTypeName((type as any).typeName);
                } else {
                    _return += kindToType(type.kind);
                }
                if (i < len - 1) {
                    _return += ' | ';
                }
            }
        } else if (node.dotDotDotToken) {
            _return = 'any[]';
        } else {
            _return = kindToType(node.kind);
            if (
                (_return === '' || _return === 'unknown') &&
                node.initializer &&
                node.initializer.kind &&
                (node.kind === SyntaxKind.PropertyDeclaration || node.kind === SyntaxKind.Parameter)
            ) {
                _return = kindToType(node.initializer.kind);
            }
            if (node.kind === SyntaxKind.TypeParameter) {
                _return = node.name.text;
            }
            if (node.kind === SyntaxKind.LiteralType) {
                _return = node.literal.text;
            }
        }
        if (node.typeArguments && node.typeArguments.length > 0) {
            _return += '<';
            let i = 0,
                len = node.typeArguments.length;
            for (i; i < len; i++) {
                const argument = node.typeArguments[i];
                _return += this.visitType(argument);
                if (i >= 0 && i < len - 1) {
                    _return += ', ';
                }
            }
            _return += '>';
        }
        return _return;
    }
}
