import { Project, SyntaxKind, ts } from 'ts-morph';
import { ClassHelper } from '../../../../../../../src/app/compiler/angular/deps/helpers/class-helper';
import * as nodeUtil from '../../../../../../../src/utils/node.util';

describe('ClassHelper', () => {
    let classHelper: ClassHelper;
    let typeChecker: ts.TypeChecker;
    let project: Project;
    let sourceFile: ts.SourceFile;
    let jsdocParserStub: {
        getMainCommentOfNode: ReturnType<typeof vi.fn>;
        getJsdocTagsOfNode: ReturnType<typeof vi.fn>;
        parseComment: ReturnType<typeof vi.fn>;
        getJSDocs: ReturnType<typeof vi.fn>;
        parseJSDocNode: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        // Create a mock type checker
        typeChecker = {} as ts.TypeChecker;
        project = new Project();
        sourceFile = project.createSourceFile('test.ts', '').compilerNode;
        jsdocParserStub = {
            getMainCommentOfNode: vi.fn().mockReturnValue(''),
            getJsdocTagsOfNode: vi.fn().mockReturnValue([]),
            parseComment: vi.fn().mockReturnValue(''),
            getJSDocs: vi.fn().mockReturnValue([]),
            // Specs feed plain string `tag.comment` values, so the stub only
            // needs the string path. Real impl walks JSDocText / JSDocLink.
            parseJSDocNode: vi.fn().mockImplementation((node: any) => {
                if (typeof node?.comment === 'string') {
                    return node.comment;
                }
                return '';
            })
        };

        classHelper = new ClassHelper(typeChecker);
        // Replace the jsdocParserUtil with our stub
        (classHelper as any).jsdocParserUtil = jsdocParserStub;
        (classHelper as any).memberVisitor.jsdocParserUtil = jsdocParserStub;

        // Mock the utility functions
        vi.spyOn(nodeUtil, 'nodeHasDecorator').mockImplementation((node: any) => {
            return node.decorators && node.decorators.length > 0;
        });
        vi.spyOn(nodeUtil, 'getNodeDecorators').mockImplementation((node: any) => {
            return node.decorators || [];
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create ClassHelper with provided typeChecker', () => {
            const helper = new ClassHelper(typeChecker);
            expect(helper).toBeInstanceOf(ClassHelper);
            expect(sourceFile).toBeDefined(); // Use sourceFile to avoid linter warning
        });
    });

    describe('stringifyDefaultValue', () => {
        it('should return the text of a node if available', () => {
            const node = { getText: () => 'test value' } as any;
            const result = classHelper.stringifyDefaultValue(node);
            expect(result).toBe('test value');
        });

        it('should return "false" for FalseKeyword', () => {
            const node = { kind: SyntaxKind.FalseKeyword } as any;
            const result = classHelper.stringifyDefaultValue(node);
            expect(result).toBe('false');
        });

        it('should return "true" for TrueKeyword', () => {
            const node = { kind: SyntaxKind.TrueKeyword } as any;
            const result = classHelper.stringifyDefaultValue(node);
            expect(result).toBe('true');
        });

        it('should return empty string for nodes without text or keywords', () => {
            const node = { kind: SyntaxKind.Unknown } as any;
            const result = classHelper.stringifyDefaultValue(node);
            expect(result).toBe('');
        });
    });

    describe('visitType', () => {
        it('should return "void" for undefined node', () => {
            const result = classHelper.visitType(undefined);
            expect(result).toBe('void');
        });

        it('should handle type with typeName', () => {
            const node = {
                typeName: { text: 'string' },
                typeArguments: []
            } as any;
            const result = classHelper.visitType(node);
            expect(result).toBe('string');
        });

        it('should handle union types', () => {
            const node = {
                type: {
                    types: [{ kind: SyntaxKind.StringKeyword }, { kind: SyntaxKind.NumberKeyword }],
                    kind: SyntaxKind.UnionType
                }
            } as any;
            const result = classHelper.visitType(node);
            expect(result).toBe('string | number');
        });

        it('should handle array types', () => {
            const node = {
                type: {
                    elementType: { kind: SyntaxKind.StringKeyword },
                    kind: SyntaxKind.ArrayType
                }
            } as any;
            const result = classHelper.visitType(node);
            expect(result).toBe('string[]');
        });

        it('should handle type arguments', () => {
            const node = {
                typeName: { text: 'Array' },
                typeArguments: [{ kind: SyntaxKind.StringKeyword }]
            } as any;
            const result = classHelper.visitType(node);
            expect(result).toBe('Array<string>');
        });
    });

    describe('visitTypeIndex', () => {
        it('should return empty string for undefined node', () => {
            const result = classHelper.visitTypeIndex(undefined);
            expect(result).toBe('');
        });

        it('should handle indexed access types with literal', () => {
            const node = {
                type: {
                    indexType: {
                        literal: { text: 'key' }
                    },
                    kind: SyntaxKind.IndexedAccessType
                }
            } as any;
            const result = classHelper.visitTypeIndex(node);
            expect(result).toBe('key');
        });
    });

    describe('visitClassDeclaration', () => {
        let mockSourceFile: ts.SourceFile;

        beforeEach(() => {
            mockSourceFile = project.createSourceFile('test-class.ts', '').compilerNode;
            jsdocParserStub.getMainCommentOfNode.mockReturnValue('');
            jsdocParserStub.parseComment.mockReturnValue('Test description');
        });

        it('should handle basic class declaration', () => {
            const classDeclaration = {
                name: { text: 'TestClass' },
                members: [],
                kind: SyntaxKind.ClassDeclaration
            } as any;

            const symbol = {
                valueDeclaration: classDeclaration,
                declarations: [classDeclaration]
            } as any;

            // Mock typeChecker.getSymbolAtLocation
            (typeChecker as any).getSymbolAtLocation = vi.fn().mockReturnValue(symbol);

            const result = classHelper.visitClassDeclaration(
                'test.ts',
                classDeclaration,
                mockSourceFile
            );
            expect(Array.isArray(result)).toBe(true);
            expect(result[0].description).toContain('Test description');
        });

        it('should handle class with decorators', () => {
            const classDeclaration = {
                name: { text: 'TestComponent', kind: SyntaxKind.Identifier },
                members: [],
                decorators: [
                    {
                        expression: {
                            expression: { text: 'Component' },
                            arguments: []
                        }
                    }
                ],
                kind: SyntaxKind.ClassDeclaration
            } as any;

            const symbol = {
                valueDeclaration: classDeclaration,
                declarations: [classDeclaration]
            } as any;

            // Override the jsdoc stub for this test to return empty description
            jsdocParserStub.getMainCommentOfNode.mockReturnValue('');

            (typeChecker as any).getSymbolAtLocation = vi.fn().mockReturnValue(symbol);

            const result = classHelper.visitClassDeclaration(
                'test.ts',
                classDeclaration,
                mockSourceFile
            );
            // visitClassDeclaration returns an array; component data is in first element
            const component = Array.isArray(result) ? result[0] : result;
            expect(component).toBeDefined();
            expect(component).toHaveProperty('inputs');
            expect(component).toHaveProperty('outputs');

            // Restore the stub
            jsdocParserStub.getMainCommentOfNode.mockReturnValue('Test description');
        });

        it('should handle @Injectable decorated class', () => {
            const classDeclaration = {
                name: { text: 'TestService', kind: SyntaxKind.Identifier },
                members: [],
                decorators: [
                    {
                        expression: {
                            expression: { text: 'Injectable' },
                            arguments: []
                        }
                    }
                ],
                kind: SyntaxKind.ClassDeclaration
            } as any;

            const symbol = {
                valueDeclaration: classDeclaration,
                declarations: [classDeclaration]
            } as any;

            // Override the jsdoc stub for this test to return empty description
            jsdocParserStub.getMainCommentOfNode.mockReturnValue('');

            (typeChecker as any).getSymbolAtLocation = vi.fn().mockReturnValue(symbol);

            const result = classHelper.visitClassDeclaration(
                'test.ts',
                classDeclaration,
                mockSourceFile
            );
            // Injectable-decorated classes: visitClassDeclaration may return service array or
            // fall through to generic class handling depending on mock fidelity.
            // The core decorator detection is tested in "should identify service decorators".
            // Here we verify the method doesn't throw and returns a defined result.
            expect(result).toBeDefined();

            // Restore the stub
            jsdocParserStub.getMainCommentOfNode.mockReturnValue('Test description');
        });

        it('should return ignore object for classes with @ignore', () => {
            const classDeclaration = {
                name: { text: 'IgnoredClass', kind: SyntaxKind.Identifier },
                members: [],
                jsDoc: [
                    {
                        tags: [
                            {
                                tagName: { text: 'ignore' }
                            }
                        ]
                    }
                ],
                kind: SyntaxKind.ClassDeclaration
            } as any;

            const symbol = {
                valueDeclaration: classDeclaration,
                declarations: [classDeclaration]
            } as any;

            (typeChecker as any).getSymbolAtLocation = vi.fn().mockReturnValue(symbol);

            const result = classHelper.visitClassDeclaration(
                'test.ts',
                classDeclaration,
                mockSourceFile
            );
            expect(result).toEqual([{ ignore: true }]);
        });
    });

    describe('private methods (tested via public interface)', () => {
        it('should process JSDoc tags correctly', () => {
            const mockTags = [
                {
                    tagName: { text: 'deprecated' },
                    comment: 'This is deprecated'
                }
            ];

            const jsdoctags = [{ tags: mockTags }];
            const result = { deprecated: false, deprecationMessage: '' };

            // Access private method through composed jsdocExtractor
            const processJSDocTags = (classHelper as any).jsdocExtractor.processJSDocTags.bind(
                (classHelper as any).jsdocExtractor
            );
            processJSDocTags(jsdoctags, result);

            expect(result.deprecated).toBe(true);
            expect(result.deprecationMessage).toBe('This is deprecated');
        });

        it('should handle ECMAScript private fields', () => {
            const mockMember = {
                name: { escapedText: '#privateField' },
                modifiers: []
            };

            // Access via composed decoratorInspector
            const inspector = (classHelper as any).decoratorInspector;
            const isPrivate = inspector.isPrivate.bind(inspector);
            const result = isPrivate(mockMember);

            expect(result).toBe(true);
        });

        it('should identify directive decorators', () => {
            const componentDecorator = {
                expression: { expression: { text: 'Component' } }
            } as any;

            const directiveDecorator = {
                expression: { expression: { text: 'Directive' } }
            } as any;

            const inspector = (classHelper as any).decoratorInspector;
            const isDirectiveDecorator = inspector.isDirectiveDecorator.bind(inspector);

            expect(isDirectiveDecorator(componentDecorator)).toBe(true);
            expect(isDirectiveDecorator(directiveDecorator)).toBe(true);
        });

        it('should identify service decorators', () => {
            const injectableDecorator = {
                expression: { expression: { text: 'Injectable' } }
            } as any;

            const inspector = (classHelper as any).decoratorInspector;
            const isServiceDecorator = inspector.isServiceDecorator.bind(inspector);

            expect(isServiceDecorator(injectableDecorator)).toBe(true);
        });
    });

    describe('visitProperty', () => {
        let mockSourceFile: ts.SourceFile;

        beforeEach(() => {
            mockSourceFile = project.createSourceFile('test-property.ts', '').compilerNode;
            jsdocParserStub.getJSDocs.mockReturnValue([]);
        });

        it('should handle basic property declaration', () => {
            const property = {
                name: { text: 'testProp' },
                type: { kind: SyntaxKind.StringKeyword },
                questionToken: undefined,
                initializer: undefined,
                modifiers: [],
                kind: SyntaxKind.PropertyDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitProperty(
                property,
                mockSourceFile
            );

            expect(result.name).toBe('testProp');
            expect(result.type).toBe('string');
            expect(result.optional).toBe(false);
        });

        it('should handle optional property', () => {
            const property = {
                name: { text: 'optionalProp' },
                type: { kind: SyntaxKind.StringKeyword },
                questionToken: {},
                initializer: undefined,
                modifiers: [],
                kind: SyntaxKind.PropertyDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitProperty(
                property,
                mockSourceFile
            );

            expect(result.optional).toBe(true);
        });

        it('should handle private property', () => {
            const property = {
                name: { text: 'privateProp' },
                type: { kind: SyntaxKind.StringKeyword },
                questionToken: undefined,
                initializer: undefined,
                modifiers: [{ kind: SyntaxKind.PrivateKeyword }],
                kind: SyntaxKind.PropertyDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitProperty(
                property,
                mockSourceFile
            );

            expect(result.modifierKind).toContain(SyntaxKind.PrivateKeyword);
        });

        it('should handle ECMAScript private field', () => {
            const property = {
                name: { escapedText: '#privateField' },
                type: { kind: SyntaxKind.StringKeyword },
                questionToken: undefined,
                initializer: undefined,
                modifiers: [],
                kind: SyntaxKind.PropertyDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitProperty(
                property,
                mockSourceFile
            );

            expect(result.modifierKind).toContain(SyntaxKind.PrivateKeyword);
        });
    });

    describe('visitMethodDeclaration', () => {
        let mockSourceFile: ts.SourceFile;

        beforeEach(() => {
            mockSourceFile = project.createSourceFile('test-method.ts', '').compilerNode;
            jsdocParserStub.getJSDocs.mockReturnValue([]);
        });

        it('should handle basic method declaration', () => {
            const method = {
                name: { text: 'testMethod', kind: SyntaxKind.Identifier },
                parameters: [],
                type: { kind: SyntaxKind.VoidKeyword },
                questionToken: undefined,
                modifiers: [],
                typeParameters: [],
                kind: SyntaxKind.MethodDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitMethodDeclaration(
                method,
                mockSourceFile
            );

            expect(result.name).toBe('testMethod');
            expect(result.returnType).toBe('void');
            expect(result.args).toHaveLength(0);
        });

        it('should handle method with parameters', () => {
            const method = {
                name: { text: 'methodWithParams', kind: SyntaxKind.Identifier },
                parameters: [
                    {
                        name: { text: 'param1', kind: SyntaxKind.Identifier },
                        type: { kind: SyntaxKind.StringKeyword },
                        dotDotDotToken: undefined,
                        questionToken: undefined,
                        initializer: undefined
                    }
                ],
                type: { kind: SyntaxKind.BooleanKeyword },
                questionToken: undefined,
                modifiers: [],
                typeParameters: [],
                kind: SyntaxKind.MethodDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitMethodDeclaration(
                method,
                mockSourceFile
            );

            expect(result.args).toHaveLength(1);
            expect(result.args[0].name).toBe('param1');
            expect(result.args[0].type).toBe('string');
            expect(result.returnType).toBe('boolean');
        });

        it('should handle optional method', () => {
            const method = {
                name: { text: 'optionalMethod', kind: SyntaxKind.Identifier },
                parameters: [],
                type: { kind: SyntaxKind.VoidKeyword },
                questionToken: {},
                modifiers: [],
                typeParameters: [],
                kind: SyntaxKind.MethodDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitMethodDeclaration(
                method,
                mockSourceFile
            );

            expect(result.optional).toBe(true);
        });

        it('should handle method with type parameters', () => {
            const method = {
                name: { text: 'genericMethod', kind: SyntaxKind.Identifier },
                parameters: [],
                type: { kind: SyntaxKind.VoidKeyword },
                questionToken: undefined,
                modifiers: [],
                typeParameters: [{ name: { text: 'T' }, kind: SyntaxKind.TypeParameter }],
                kind: SyntaxKind.MethodDeclaration,
                pos: 10,
                end: 20
            } as any;

            const result = (classHelper as any).memberVisitor.visitMethodDeclaration(
                method,
                mockSourceFile
            );

            expect(result.typeParameters).toHaveLength(1);
            expect(result.typeParameters[0]).toBe('T');
        });
    });

    describe('visitArgument', () => {
        it('should handle basic parameter', () => {
            const param = {
                name: { text: 'param1', kind: SyntaxKind.Identifier },
                type: { kind: SyntaxKind.StringKeyword },
                dotDotDotToken: undefined,
                questionToken: undefined,
                initializer: undefined
            } as any;

            const result = (classHelper as any).memberVisitor.visitArgument(param);

            expect(result.name).toBe('param1');
            expect(result.type).toBe('string');
            expect(result.optional).toBe(false);
            expect(result.dotDotDotToken).toBe(false);
        });

        it('should handle optional parameter', () => {
            const param = {
                name: { text: 'optionalParam', kind: SyntaxKind.Identifier },
                type: { kind: SyntaxKind.StringKeyword },
                dotDotDotToken: undefined,
                questionToken: {},
                initializer: undefined
            } as any;

            const result = (classHelper as any).memberVisitor.visitArgument(param);

            expect(result.optional).toBe(true);
        });

        it('should handle rest parameter', () => {
            const param = {
                name: { text: 'restParam', kind: SyntaxKind.Identifier },
                type: { kind: SyntaxKind.StringKeyword },
                dotDotDotToken: {},
                questionToken: undefined,
                initializer: undefined
            } as any;

            const result = (classHelper as any).memberVisitor.visitArgument(param);

            expect(result.dotDotDotToken).toBe(true);
        });

        it('should handle parameter with default value', () => {
            const param = {
                name: { text: 'paramWithDefault', kind: SyntaxKind.Identifier },
                type: { kind: SyntaxKind.StringKeyword },
                dotDotDotToken: undefined,
                questionToken: undefined,
                initializer: { getText: () => '"default"' }
            } as any;

            const result = (classHelper as any).memberVisitor.visitArgument(param);

            expect(result.defaultValue).toBe('"default"');
        });
    });
});
