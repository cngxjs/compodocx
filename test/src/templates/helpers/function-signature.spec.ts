import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { functionSignature } from '../../../../src/templates/helpers/function-signature';
import BasicTypeUtil from '../../../../src/utils/basic-type.util';
import { hrefTo } from '../../helpers/pages';

const internal = (data: Record<string, unknown>) => ({ source: 'internal', data }) as any;

/** Resolve only the listed type names; everything else is unknown. */
const resolving = (types: Record<string, unknown>) =>
    vi
        .spyOn(DependenciesEngine, 'find')
        .mockImplementation((name: string) => (types[name] as any) ?? undefined);

const signatureWith = (type: string): string =>
    functionSignature({ name: 'use', args: [{ name: 'value', type }] });

describe('functionSignature', () => {
    beforeEach(() => {
        vi.spyOn(BasicTypeUtil, 'isKnownType').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('internal type links', () => {
        it.each([
            ['typealias', 'typealias', 'StatusType'],
            ['enum', 'enumeration', 'StatusEnum'],
            ['function', 'function', 'myFunction'],
            ['variable', 'variable', 'MY_CONSTANT']
        ] as const)('links a %s to its collection anchor', (subtype, kind, name) => {
            resolving({ [name]: internal({ type: 'miscellaneous', subtype, name }) });
            expect(signatureWith(name)).toContain(`href="${hrefTo(kind, name, 1)}"`);
        });

        it('links a miscellaneous symbol marked by ctype', () => {
            resolving({
                CallbackType: internal({
                    ctype: 'miscellaneous',
                    subtype: 'typealias',
                    name: 'CallbackType'
                })
            });
            expect(signatureWith('CallbackType')).toContain(
                `href="${hrefTo('typealias', 'CallbackType', 1)}"`
            );
        });

        it.each([
            ['class', 'MyClass'],
            ['interface', 'MyInterface'],
            ['directive', 'MyDirective']
        ] as const)('links a %s to its page', (kind, name) => {
            resolving({ [name]: internal({ type: kind, name }) });
            expect(signatureWith(name)).toContain(`href="${hrefTo(kind, name, 1)}"`);
        });
    });

    describe('arguments', () => {
        it('renders a method without arguments', () => {
            expect(functionSignature({ name: 'myMethod', args: [] })).toBe('myMethod()');
        });

        it('links an internal type argument', () => {
            resolving({
                StatusType: internal({
                    type: 'miscellaneous',
                    subtype: 'typealias',
                    name: 'StatusType'
                })
            });
            const result = functionSignature({
                name: 'setStatus',
                args: [{ name: 'status', type: 'StatusType', optional: false }]
            });
            expect(result).toBe(
                `setStatus(status: <a href="${hrefTo('typealias', 'StatusType', 1)}" target="_self">StatusType</a>)`
            );
        });

        it('links an Angular API type argument to angular.dev', () => {
            resolving({
                ActivatedRoute: {
                    source: 'external',
                    data: { name: 'ActivatedRoute', path: 'api/router/ActivatedRoute' }
                }
            });
            const result = functionSignature({
                name: 'constructor',
                args: [{ name: 'route', type: 'ActivatedRoute', optional: false }]
            });
            expect(result).toContain(
                '<a href="https://angular.dev/api/router/ActivatedRoute" target="_blank">ActivatedRoute</a>'
            );
        });

        it('links a basic type argument to its reference page', () => {
            resolving({});
            vi.spyOn(BasicTypeUtil, 'isKnownType').mockReturnValue(true);
            vi.spyOn(BasicTypeUtil, 'getTypeUrl').mockReturnValue('https://example.test/String');
            const result = functionSignature({
                name: 'setText',
                args: [{ name: 'text', type: 'string', optional: false }]
            });
            expect(result).toBe(
                'setText(text: <a href="https://example.test/String" target="_blank">string</a>)'
            );
        });

        it('marks an optional argument', () => {
            resolving({});
            const result = functionSignature({
                name: 'myMethod',
                args: [{ name: 'optional', type: 'string', optional: true }]
            });
            expect(result).toBe('myMethod(optional?: string)');
        });

        it('renders a rest parameter', () => {
            resolving({});
            const result = functionSignature({
                name: 'concat',
                args: [{ name: 'items', type: 'string[]', dotDotDotToken: true }]
            });
            expect(result).toBe('concat(...items: string[])');
        });

        it('joins several arguments', () => {
            resolving({
                StatusType: internal({
                    type: 'miscellaneous',
                    subtype: 'typealias',
                    name: 'StatusType'
                })
            });
            const result = functionSignature({
                name: 'updateStatus',
                args: [
                    { name: 'status', type: 'StatusType', optional: false },
                    { name: 'message', type: 'string', optional: false }
                ]
            });
            expect(result).toBe(
                `updateStatus(status: <a href="${hrefTo('typealias', 'StatusType', 1)}" target="_self">StatusType</a>, message: string)`
            );
        });

        it('renders a method without a name', () => {
            resolving({});
            expect(functionSignature({ args: [{ name: 'x', type: 'number' }] })).toBe(
                '(x: number)'
            );
        });

        it('groups destructured parameters', () => {
            resolving({});
            const result = functionSignature({
                name: 'myMethod',
                args: [
                    { name: 'id', type: 'number', destructuredParameter: true },
                    { name: 'name', type: 'string', destructuredParameter: true }
                ]
            });
            expect(result).toBe('myMethod(__namedParameters: {id: number, name: string})');
        });

        it('renders an argument without a type', () => {
            resolving({});
            expect(functionSignature({ name: 'myMethod', args: [{ name: 'unknown' }] })).toBe(
                'myMethod(unknown)'
            );
        });
    });

    describe('function-typed arguments', () => {
        it('renders a callback without parameters', () => {
            resolving({});
            const result = functionSignature({
                name: 'on',
                args: [{ name: 'callback', function: [] }]
            });
            expect(result).toBe('on(callback: () => void)');
        });

        it('links internal types of callback parameters', () => {
            resolving({
                StatusType: internal({
                    type: 'miscellaneous',
                    subtype: 'typealias',
                    name: 'StatusType'
                })
            });
            const result = functionSignature({
                name: 'on',
                args: [{ name: 'handler', function: [{ name: 'status', type: 'StatusType' }] }]
            });
            expect(result).toContain('handler: (status: ');
            expect(result).toContain(`href="${hrefTo('typealias', 'StatusType', 1)}"`);
        });

        it('renders unknown callback parameter types as text', () => {
            resolving({});
            const result = functionSignature({
                name: 'on',
                args: [{ name: 'callback', function: [{ name: 'data', type: 'CustomType' }] }]
            });
            expect(result).toBe('on(callback: (data: CustomType) => void)');
        });
    });
});
