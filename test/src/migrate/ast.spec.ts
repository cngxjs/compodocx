import {
    type AstMustacheStatement,
    type AstPathExpression,
    isValidIdentifier,
    normalizePath,
    parse,
    ROOT_SCOPE,
    type ScopeFrame
} from '../../../src/migrate/ast';

const firstMustache = (source: string): AstPathExpression => {
    const program = parse(source);
    const stmt = program.body[0] as AstMustacheStatement;
    return stmt.path as AstPathExpression;
};

describe('migrate/ast — normalizePath', () => {
    describe('top-level identifier', () => {
        it('emits scope.binding.identifier', () => {
            const path = firstMustache('{{name}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.name');
        });

        it('uses the active scope binding inside #each', () => {
            const path = firstMustache('{{name}}');
            const itemScope: ScopeFrame = { binding: 'item', optional: false };
            expect(normalizePath(path, [ROOT_SCOPE, itemScope])).toBe('item.name');
        });
    });

    describe('dotted access', () => {
        it('uses optional chaining for second+ segments only', () => {
            const path = firstMustache('{{a.b.c}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.a?.b?.c');
        });
    });

    describe('bracket numeric access', () => {
        it('emits computed numeric index with optional chaining', () => {
            const path = firstMustache('{{a.[0]}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.a?.[0]');
        });

        it('emits computed numeric for first segment when scope already optional', () => {
            const path = firstMustache('{{[2]}}');
            const optScope: ScopeFrame = { binding: 'item', optional: true };
            expect(normalizePath(path, [optScope])).toBe('item?.[2]');
        });
    });

    describe('bracket string access', () => {
        it('quotes keys with spaces', () => {
            const path = firstMustache('{{a.[key with space]}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.a?.["key with space"]');
        });

        it('quotes keys with hyphens via bracket syntax', () => {
            const path = firstMustache('{{a.[my-key]}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.a?.["my-key"]');
        });
    });

    describe('this / current scope', () => {
        it('emits the bare scope binding', () => {
            const path = firstMustache('{{this}}');
            const itemScope: ScopeFrame = { binding: 'item', optional: false };
            expect(normalizePath(path, [ROOT_SCOPE, itemScope])).toBe('item');
        });
    });

    describe('parent context', () => {
        it('walks up the scope stack with ../', () => {
            const path = firstMustache('{{../name}}');
            const itemScope: ScopeFrame = { binding: 'item', optional: false };
            expect(normalizePath(path, [ROOT_SCOPE, itemScope])).toBe('data.name');
        });

        it('emits a TODO when ../ exceeds the stack', () => {
            const path = firstMustache('{{../../missing}}');
            const itemScope: ScopeFrame = { binding: 'item', optional: false };
            expect(normalizePath(path, [ROOT_SCOPE, itemScope])).toMatch(
                /TODO\(migrate\):.*parent depth/
            );
        });
    });

    describe('reserved JS words in path parts', () => {
        it('emits reserved words via bracket-string when raw access would shadow', () => {
            const path = firstMustache('{{a.[class]}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('data.a?.["class"]');
        });
    });

    describe('private vars', () => {
        it('rebinds @index / @key to placeholders the emitter resolves', () => {
            const path = firstMustache('{{@index}}');
            expect(normalizePath(path, [ROOT_SCOPE])).toBe('__hbs_index');
        });
    });

    describe('throws on empty scope stack', () => {
        it('rejects an empty scopes array', () => {
            const path = firstMustache('{{name}}');
            expect(() => normalizePath(path, [])).toThrow(/empty scope stack/);
        });
    });
});

describe('migrate/ast — isValidIdentifier', () => {
    it('accepts plain identifiers', () => {
        expect(isValidIdentifier('foo')).toBe(true);
        expect(isValidIdentifier('foo_bar')).toBe(true);
        expect(isValidIdentifier('$foo')).toBe(true);
        expect(isValidIdentifier('_foo')).toBe(true);
    });

    it('rejects reserved words', () => {
        expect(isValidIdentifier('class')).toBe(false);
        expect(isValidIdentifier('return')).toBe(false);
        expect(isValidIdentifier('this')).toBe(false);
    });

    it('rejects identifiers with whitespace, hyphens or other punctuation', () => {
        expect(isValidIdentifier('foo bar')).toBe(false);
        expect(isValidIdentifier('foo-bar')).toBe(false);
        expect(isValidIdentifier('1foo')).toBe(false);
    });
});
