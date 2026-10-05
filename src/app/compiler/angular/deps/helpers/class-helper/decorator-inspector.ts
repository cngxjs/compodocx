import { SyntaxKind, type ts } from 'ts-morph';
import { getNodeDecorators } from '../../../../../../utils/node.util';

export class DecoratorInspector {
    public hasDecoratorType(decorator: ts.Decorator, ...types: string[]): boolean {
        if ((decorator.expression as any).expression) {
            const decoratorText = (decorator.expression as any).expression.text;
            return types.includes(decoratorText);
        }
        return false;
    }

    public isDirectiveDecorator(decorator: ts.Decorator): boolean {
        return this.hasDecoratorType(decorator, 'Directive', 'Component');
    }

    public isServiceDecorator(decorator) {
        return this.hasDecoratorType(decorator, 'Injectable');
    }

    /** A class decorated with @Component, @Directive, @Pipe or @Injectable. */
    public isAngularClass(node): boolean {
        return (
            !!node &&
            getNodeDecorators(node).some((decorator: ts.Decorator) =>
                this.hasDecoratorType(decorator, 'Component', 'Directive', 'Pipe', 'Injectable')
            )
        );
    }

    public isPipeDecorator(decorator) {
        return this.hasDecoratorType(decorator, 'Pipe');
    }

    public isPrivate(member): boolean {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        if (member.modifiers) {
            const isPrivate: boolean = member.modifiers.some(
                modifier => modifier.kind === SyntaxKind.PrivateKeyword
            );
            if (isPrivate) {
                return true;
            }
        }
        // Check for ECMAScript Private Fields
        if (member.name?.escapedText) {
            const isPrivate: boolean = member.name.escapedText.indexOf('#') === 0;
            if (isPrivate) {
                return true;
            }
        }
        return this.isHiddenMember(member);
    }

    public isProtected(member): boolean {
        if (member.modifiers) {
            const isProtected: boolean = member.modifiers.some(
                modifier => modifier.kind === SyntaxKind.ProtectedKeyword
            );
            if (isProtected) {
                return true;
            }
        }
        return this.isHiddenMember(member);
    }

    public isInternal(member): boolean {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const internalTags: string[] = ['internal'];
        if (member.jsDoc) {
            for (const doc of member.jsDoc) {
                if (doc.tags) {
                    for (const tag of doc.tags) {
                        if (internalTags.indexOf(tag.tagName.text) > -1) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    public isPublic(member): boolean {
        if (member.modifiers) {
            const isPublic: boolean = member.modifiers.some(
                modifier => modifier.kind === SyntaxKind.PublicKeyword
            );
            if (isPublic) {
                return true;
            }
        }
        return this.isHiddenMember(member);
    }

    public isHiddenMember(member): boolean {
        /**
         * Copyright https://github.com/ng-bootstrap/ng-bootstrap
         */
        const internalTags: string[] = ['hidden'];
        if (member.jsDoc) {
            for (const doc of member.jsDoc) {
                if (doc.tags) {
                    for (const tag of doc.tags) {
                        if (internalTags.indexOf(tag.tagName.text) > -1) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }
}
