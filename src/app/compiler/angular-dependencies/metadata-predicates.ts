import { LEGACY_CLASS_DECORATORS } from '../legacy-scan';

export class MetadataPredicates {
    public parseDecorators(decorators, type: string): boolean {
        let result = false;
        if (decorators.length > 1) {
            decorators.forEach((decorator: any) => {
                if (decorator.expression.expression) {
                    if (decorator.expression.expression.text === type) {
                        result = true;
                    }
                }
            });
        } else if (decorators[0].expression.expression) {
            if (decorators[0].expression.expression.text === type) {
                result = true;
            }
        }
        return result;
    }

    public parseDecorator(decorator, type: string): boolean {
        let result = false;
        if (decorator.expression.expression) {
            if (decorator.expression.expression.text === type) {
                result = true;
            }
        }
        return result;
    }

    public isEntity(metadata) {
        return this.parseDecorator(metadata, 'Entity');
    }

    public isComponent(metadata) {
        return this.parseDecorator(metadata, 'Component');
    }

    public isPipe(metadata) {
        return this.parseDecorator(metadata, 'Pipe');
    }

    public isDirective(metadata) {
        return this.parseDecorator(metadata, 'Directive');
    }

    public isInjectable(metadata) {
        return this.parseDecorator(metadata, 'Injectable');
    }

    public hasInternalDecorator(metadatas) {
        return (
            this.parseDecorators(metadatas, 'Component') ||
            this.parseDecorators(metadatas, 'Pipe') ||
            this.parseDecorators(metadatas, 'Directive') ||
            this.parseDecorators(metadatas, 'Injectable') ||
            LEGACY_CLASS_DECORATORS.some(name => this.parseDecorators(metadatas, name))
        );
    }
}
