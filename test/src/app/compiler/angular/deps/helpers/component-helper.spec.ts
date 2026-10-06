import { Project, SyntaxKind, ts } from 'ts-morph';
import {
    ComponentCache,
    ComponentHelper
} from '../../../../../../../src/app/compiler/angular/deps/helpers/component-helper';

describe('ComponentHelper', () => {
    let componentHelper: ComponentHelper;
    let classHelperStub: any;
    let symbolHelperStub: {
        getSymbolDeps: ReturnType<typeof vi.fn>;
        parseDeepIndentifier: ReturnType<typeof vi.fn>;
        getSymbolDepsRaw: ReturnType<typeof vi.fn>;
        getProviderEntries: ReturnType<typeof vi.fn>;
    };
    let project: Project;
    let sourceFile: ts.SourceFile;

    beforeEach(() => {
        classHelperStub = {} as any;
        symbolHelperStub = {
            getSymbolDeps: vi.fn().mockReturnValue([]),
            parseDeepIndentifier: vi.fn().mockReturnValue({}),
            getSymbolDepsRaw: vi.fn().mockReturnValue([]),
            getProviderEntries: vi.fn().mockReturnValue([])
        };
        componentHelper = new ComponentHelper(classHelperStub as any, symbolHelperStub as any);
        project = new Project();
        sourceFile = project.createSourceFile('test.ts', '').compilerNode;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create ComponentHelper with provided dependencies', () => {
            const helper = new ComponentHelper(classHelperStub, symbolHelperStub);
            expect(helper).to.be.instanceOf(ComponentHelper);
        });

        it('should create ComponentHelper with default SymbolHelper when not provided', () => {
            const helper = new ComponentHelper(classHelperStub);
            expect(helper).to.be.instanceOf(ComponentHelper);
        });
    });

    // Helper functions for creating test data
    function createMockProp(name: string, value: any): ts.ObjectLiteralElementLike {
        return {
            name: { text: name },
            initializer: { text: value }
        } as any;
    }

    function createMockProps(props: {
        [key: string]: any;
    }): ReadonlyArray<ts.ObjectLiteralElementLike> {
        return Object.entries(props).map(([name, value]) => createMockProp(name, value));
    }

    describe('getComponentName', () => {
        it('should extract component name from props', () => {
            const props = createMockProps({ name: 'TestComponent' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['TestComponent']);

            const result = componentHelper.getComponentName(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(props, 'name', sourceFile);
            expect(result).to.equal('TestComponent');
        });

        it('should return undefined when no name found', () => {
            const props = createMockProps({});
            symbolHelperStub.getSymbolDeps.mockReturnValue([]);

            const result = componentHelper.getComponentName(props, sourceFile);

            expect(result).to.be.undefined;
        });
    });

    describe('getComponentSelector', () => {
        it('should extract component selector from props', () => {
            const props = createMockProps({ selector: 'app-test' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['app-test']);

            const result = componentHelper.getComponentSelector(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'selector',
                sourceFile
            );
            expect(result).to.equal('app-test');
        });
    });

    describe('getComponentTemplate', () => {
        it('should extract component template from props', () => {
            const props = createMockProps({ template: '<div>Hello</div>' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['<div>Hello</div>']);

            const result = componentHelper.getComponentTemplate(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'template',
                sourceFile,
                true
            );
            expect(result).to.equal('<div>Hello</div>');
        });
    });

    describe('getComponentStandalone', () => {
        it('should return true when standalone is true', () => {
            const props = createMockProps({ standalone: 'true' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['true']);

            const result = componentHelper.getComponentStandalone(props, sourceFile);

            expect(result).to.be.true;
        });

        it('should return false when standalone is false', () => {
            const props = createMockProps({ standalone: 'false' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['false']);

            const result = componentHelper.getComponentStandalone(props, sourceFile);

            expect(result).to.be.false;
        });

        it('should return true when no standalone property found', () => {
            const props = createMockProps({});
            symbolHelperStub.getSymbolDeps.mockReturnValue([]);

            const result = componentHelper.getComponentStandalone(props, sourceFile);

            expect(result).to.be.true;
        });
    });

    describe('getComponentStyleUrls', () => {
        it('should extract styleUrls (plural) from props', () => {
            const props = createMockProps({ styleUrls: ['style1.css', 'style2.css'] });
            symbolHelperStub.getSymbolDeps.mockImplementation((_p: any, field: string) =>
                field === 'styleUrls' ? ['style1.css', 'style2.css'] : []
            );

            const result = componentHelper.getComponentStyleUrls(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'styleUrls',
                sourceFile
            );
            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'styleUrl',
                sourceFile
            );
            expect(result).to.deep.equal(['style1.css', 'style2.css']);
        });

        it('should fold singular styleUrl into the plural array (Angular 21 / Stencil)', () => {
            const props = createMockProps({ styleUrl: './my-thing.css' });
            symbolHelperStub.getSymbolDeps.mockImplementation((_p: any, field: string) =>
                field === 'styleUrl' ? ['./my-thing.css'] : []
            );

            const result = componentHelper.getComponentStyleUrls(props, sourceFile);

            expect(result).to.deep.equal(['./my-thing.css']);
        });

        it('should merge both forms without duplicates when a component declares each', () => {
            const props = createMockProps({
                styleUrls: ['./shared.css'],
                styleUrl: './my-thing.css'
            });
            symbolHelperStub.getSymbolDeps.mockImplementation((_p: any, field: string) => {
                if (field === 'styleUrls') {
                    return ['./shared.css'];
                }
                if (field === 'styleUrl') {
                    return ['./my-thing.css'];
                }
                return [];
            });

            const result = componentHelper.getComponentStyleUrls(props, sourceFile);

            expect(result).to.deep.equal(['./shared.css', './my-thing.css']);
        });

        it('should dedupe when the same URL appears in both forms', () => {
            const props = createMockProps({
                styleUrls: ['./shared.css'],
                styleUrl: './shared.css'
            });
            symbolHelperStub.getSymbolDeps.mockImplementation((_p: any, field: string) => {
                if (field === 'styleUrls') {
                    return ['./shared.css'];
                }
                if (field === 'styleUrl') {
                    return ['./shared.css'];
                }
                return [];
            });

            const result = componentHelper.getComponentStyleUrls(props, sourceFile);

            expect(result).to.deep.equal(['./shared.css']);
        });

        it('should return an empty array when neither form is present', () => {
            const props = createMockProps({});
            symbolHelperStub.getSymbolDeps.mockReturnValue([]);

            const result = componentHelper.getComponentStyleUrls(props, sourceFile);

            expect(result).to.deep.equal([]);
        });
    });

    describe('getComponentStyles', () => {
        it('should extract styles from props', () => {
            const props = createMockProps({ styles: ['.class { color: red; }'] });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['.class { color: red; }']);

            const result = componentHelper.getComponentStyles(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'styles',
                sourceFile
            );
            expect(result).to.deep.equal(['.class { color: red; }']);
        });
    });

    describe('getComponentInputsMetadata', () => {
        it('should extract inputs metadata from props', () => {
            const props = createMockProps({ inputs: ['input1', 'input2'] });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['input1', 'input2']);

            const result = componentHelper.getComponentInputsMetadata(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'inputs',
                sourceFile
            );
            expect(result).to.deep.equal(['input1', 'input2']);
        });
    });

    describe('getComponentOutputs', () => {
        it('should extract outputs from props', () => {
            const props = createMockProps({ outputs: ['output1', 'output2'] });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['output1', 'output2']);

            const result = componentHelper.getComponentOutputs(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'outputs',
                sourceFile
            );
            expect(result).to.deep.equal(['output1', 'output2']);
        });
    });

    describe('getComponentTemplateUrl', () => {
        it('should extract templateUrl from props', () => {
            const props = createMockProps({ templateUrl: 'template.html' });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['template.html']);

            const result = componentHelper.getComponentTemplateUrl(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'templateUrl',
                sourceFile
            );
            expect(result).to.deep.equal(['template.html']);
        });
    });

    describe('parseSignalType', () => {
        it('should return type as-is when no type provided', () => {
            const result = componentHelper.parseSignalType('');
            expect(result).to.equal('');
        });

        it('should parse simple union types', () => {
            const result = componentHelper.parseSignalType("'foo' | 'bar'");
            expect(result).to.equal('"foo" | "bar"');
        });

        it('should handle single quote types', () => {
            const result = componentHelper.parseSignalType("'single'");
            expect(result).to.equal("'single'"); // parseSignalType only converts union types
        });

        it('should handle complex union types', () => {
            const result = componentHelper.parseSignalType("'foo' | 'bar' | 'baz'");
            expect(result).to.equal('"foo" | "bar" | "baz"');
        });
    });

    describe('getSignalConfig', () => {
        it('should parse input signal configuration', () => {
            const defaultValue = 'input<string>()';
            const result = componentHelper['getSignalConfig']('input', defaultValue);

            expect(result).to.deep.equal({
                required: false,
                type: 'string',
                defaultValue: undefined
            });
        });

        it('should parse required input signal', () => {
            const defaultValue = 'input.required<string>()';
            const result = componentHelper['getSignalConfig']('input', defaultValue);

            expect(result).to.deep.equal({
                required: true,
                type: 'string',
                defaultValue: undefined
            });
        });

        it('should parse input signal with default value', () => {
            const defaultValue = "input<string>('default')";
            const result = componentHelper['getSignalConfig']('input', defaultValue);

            expect(result).to.deep.equal({
                required: false,
                type: 'string',
                defaultValue: "'default'"
            });
        });

        it('should parse output signal configuration', () => {
            const defaultValue = 'output<string>()';
            const result = componentHelper['getSignalConfig']('output', defaultValue);

            expect(result).to.deep.equal({
                required: false,
                type: 'string',
                defaultValue: undefined
            });
        });

        it('should return undefined for non-matching signal', () => {
            const defaultValue = 'someOtherFunction()';
            const result = componentHelper['getSignalConfig']('input', defaultValue);

            expect(result).to.be.undefined;
        });
    });

    describe('getInputSignal', () => {
        it('should extract input signal from property', () => {
            const prop = { defaultValue: 'input<string>()' };
            const result = componentHelper.getInputSignal(prop);

            expect(result).to.deep.equal({
                ...prop,
                required: false,
                type: 'string',
                defaultValue: undefined
            });
        });

        it('should return undefined when no input signal found', () => {
            const prop = { defaultValue: 'someOtherValue' };
            const result = componentHelper.getInputSignal(prop);

            expect(result).to.be.undefined;
        });
    });

    describe('getOutputSignal', () => {
        it('should extract output signal from property', () => {
            const prop = { defaultValue: 'output<string>()' };
            const result = componentHelper.getOutputSignal(prop);

            expect(result).to.deep.equal({
                ...prop,
                required: false,
                type: 'string',
                defaultValue: undefined
            });
        });

        it('should return undefined when no output signal found', () => {
            const prop = { defaultValue: 'someOtherValue' };
            const result = componentHelper.getOutputSignal(prop);

            expect(result).to.be.undefined;
        });
    });

    describe('getInputOutputSignals', () => {
        it('should separate signals from regular properties', () => {
            const props = [
                { defaultValue: 'input<string>()', name: 'inputProp' },
                { defaultValue: 'output<number>()', name: 'outputProp' },
                { defaultValue: 'regularValue', name: 'regularProp' }
            ];

            const result = componentHelper.getInputOutputSignals(props);

            expect(result.inputSignals).to.have.lengthOf(1);
            expect(result.outputSignals).to.have.lengthOf(1);
            expect(result.properties).to.have.lengthOf(1);
            expect(result.inputSignals[0].name).to.equal('inputProp');
            expect(result.outputSignals[0].name).to.equal('outputProp');
            expect(result.properties[0].name).to.equal('regularProp');
        });
    });

    describe('getComponentProviders', () => {
        it('should delegate to symbolHelper.getProviderEntries', () => {
            const props = createMockProps({ providers: ['Service1', 'Service2'] });
            const stubbedEntries = [
                { name: 'Service1', kind: 'class', type: 'injectable' },
                { name: 'Service2', kind: 'class', type: 'injectable' }
            ];
            symbolHelperStub.getProviderEntries.mockReturnValue(stubbedEntries);

            const result = componentHelper.getComponentProviders(props, sourceFile);

            // srcFile threaded through so Object-Literal-Shorthand resolution
            // can walk the file's top-level `const providers = […]` declaration.
            expect(symbolHelperStub.getProviderEntries).toHaveBeenCalledWith(
                props,
                'providers',
                sourceFile
            );
            expect(result).to.deep.equal(stubbedEntries);
        });
    });

    describe('getComponentImports', () => {
        it('should extract and parse imports from props', () => {
            const props = createMockProps({ imports: ['Module1', 'Module2'] });
            symbolHelperStub.getSymbolDeps.mockReturnValue(['Module1', 'Module2']);
            symbolHelperStub.parseDeepIndentifier.mockImplementation(name => ({
                name,
                type: 'module'
            }));

            const result = componentHelper.getComponentImports(props, sourceFile);

            expect(symbolHelperStub.getSymbolDeps).toHaveBeenCalledWith(
                props,
                'imports',
                sourceFile
            );
            expect(symbolHelperStub.parseDeepIndentifier).toHaveBeenCalledTimes(2);
            expect(result).to.have.lengthOf(2);
            expect(result[0]).to.deep.equal({ name: 'Module1', type: 'module' });
        });
    });

    describe('getComponentViewProviders', () => {
        it('should delegate to symbolHelper.getProviderEntries with viewProviders key', () => {
            const props = createMockProps({ viewProviders: ['Service1', 'Service2'] });
            const stubbedEntries = [
                { name: 'Service1', kind: 'class', type: 'injectable' },
                { name: 'Service2', kind: 'class', type: 'injectable' }
            ];
            symbolHelperStub.getProviderEntries.mockReturnValue(stubbedEntries);

            const result = componentHelper.getComponentViewProviders(props, sourceFile);

            expect(symbolHelperStub.getProviderEntries).toHaveBeenCalledWith(
                props,
                'viewProviders',
                sourceFile
            );
            expect(result).to.deep.equal(stubbedEntries);
        });
    });

    describe('getComponentExampleUrls', () => {
        it('should extract example URLs from text', () => {
            const text =
                'Some text <example-url>url1</example-url> more text <example-url>url2</example-url>';
            const result = componentHelper.getComponentExampleUrls(text);

            expect(result).to.deep.equal(['url1', 'url2']);
        });

        it('should return undefined when no example URLs found', () => {
            const text = 'Some text without example URLs';
            const result = componentHelper.getComponentExampleUrls(text);

            expect(result).to.be.undefined;
        });
    });

    describe('sanitizeUrls', () => {
        it('should remove ./ prefix from URLs', () => {
            const urls = ['./style1.css', './style2.css', 'style3.css'];
            const result = (componentHelper as any).sanitizeUrls(urls);

            expect(result).to.deep.equal(['style1.css', 'style2.css', 'style3.css']);
        });

        it('should handle empty array', () => {
            const urls: string[] = [];
            const result = (componentHelper as any).sanitizeUrls(urls);

            expect(result).to.deep.equal([]);
        });
    });

    describe('getComponentHost', () => {
        it('should extract host configuration as Map', () => {
            const props = createMockProps({ host: { '(click)': 'onClick()' } });
            const expectedMap = new Map([['(click)', 'onClick()']]);

            // Mock the getSymbolDepsObject method
            const getSymbolDepsObjectSpy = vi
                .spyOn(componentHelper, 'getSymbolDepsObject')
                .mockReturnValue(expectedMap);

            const result = componentHelper.getComponentHost(props);

            expect(getSymbolDepsObjectSpy).toHaveBeenCalledWith(props, 'host');
            expect(result).to.equal(expectedMap);
        });
    });

    describe('getComponentHostDirectives', () => {
        it('should return empty array when no hostDirectives found', () => {
            symbolHelperStub.getSymbolDepsRaw.mockReturnValue([]);

            const result = componentHelper.getComponentHostDirectives([]);

            expect(result).to.deep.equal([]);
        });

        it('should parse identifier host directives', () => {
            const mockElement = {
                kind: SyntaxKind.Identifier,
                escapedText: 'MyDirective'
            };

            const mockInitializer = {
                elements: [mockElement]
            };

            symbolHelperStub.getSymbolDepsRaw.mockReturnValue([
                {
                    initializer: mockInitializer
                }
            ]);

            const result = componentHelper.getComponentHostDirectives([]);

            expect(result).to.deep.equal([
                {
                    name: 'MyDirective',
                    unresolved: true
                }
            ]);
        });

        it('should parse object literal host directives', () => {
            const mockProperty1 = {
                name: { escapedText: 'directive' },
                initializer: { escapedText: 'MyDirective' }
            };

            const mockProperty2 = {
                name: { escapedText: 'inputs' },
                initializer: {
                    elements: [{ text: 'input1' }, { text: 'input2' }]
                }
            };

            const mockProperty3 = {
                name: { escapedText: 'outputs' },
                initializer: {
                    elements: [{ text: 'output1' }, { text: 'output2' }]
                }
            };

            const mockElement = {
                kind: SyntaxKind.ObjectLiteralExpression,
                properties: [mockProperty1, mockProperty2, mockProperty3]
            };

            const mockInitializer = {
                elements: [mockElement]
            };

            symbolHelperStub.getSymbolDepsRaw.mockReturnValue([
                {
                    initializer: mockInitializer
                }
            ]);

            const result = componentHelper.getComponentHostDirectives([]);

            expect(result).to.deep.equal([
                {
                    name: 'MyDirective',
                    inputs: ['input1', 'input2'],
                    outputs: ['output1', 'output2']
                }
            ]);
        });

        it('should handle multiple host directives', () => {
            const mockElement1 = {
                kind: SyntaxKind.Identifier,
                escapedText: 'Directive1'
            };

            const mockElement2 = {
                kind: SyntaxKind.Identifier,
                escapedText: 'Directive2'
            };

            const mockInitializer = {
                elements: [mockElement1, mockElement2]
            };

            symbolHelperStub.getSymbolDepsRaw.mockReturnValue([
                {
                    initializer: mockInitializer
                }
            ]);

            const result = componentHelper.getComponentHostDirectives([]);

            expect(result).to.deep.equal([
                { name: 'Directive1', unresolved: true },
                { name: 'Directive2', unresolved: true }
            ]);
        });
    });

    describe('ComponentCache', () => {
        let cache: ComponentCache;

        beforeEach(() => {
            cache = new ComponentCache();
        });

        describe('get', () => {
            it('should return cached value for existing key', () => {
                const testValue = { name: 'TestComponent' };
                cache.set('testKey', testValue);

                const result = cache.get('testKey');

                expect(result).to.equal(testValue);
            });

            it('should return undefined for non-existing key', () => {
                const result = cache.get('nonExistingKey');

                expect(result).to.be.undefined;
            });
        });

        describe('set', () => {
            it('should store value in cache', () => {
                const testValue = { selector: 'app-test' };

                cache.set('testKey', testValue);
                const result = cache.get('testKey');

                expect(result).to.equal(testValue);
            });

            it('should overwrite existing value', () => {
                const originalValue = { name: 'Original' };
                const newValue = { name: 'New' };

                cache.set('testKey', originalValue);
                cache.set('testKey', newValue);

                const result = cache.get('testKey');

                expect(result).to.equal(newValue);
                expect(result).to.not.equal(originalValue);
            });
        });
    });
});
