import { Project, ts } from 'ts-morph';
import { ClassHelper } from '../../../../../../../src/app/compiler/angular/deps/helpers/class-helper';
import * as nodeUtil from '../../../../../../../src/utils/node.util';

/**
 * Tests for signalDeps extraction in visitProperty.
 *
 * Uses real ts-morph AST nodes so ts.forEachChild works correctly
 * during the dependency walk.
 */
describe('ClassHelper > signalDeps extraction', () => {
    let classHelper: ClassHelper;
    let project: Project;

    beforeEach(() => {
        project = new Project({ useInMemoryFileSystem: true });
        classHelper = new ClassHelper({} as ts.TypeChecker);
        const jsdocStub = {
            getMainCommentOfNode: vi.fn().mockReturnValue(''),
            getJsdocTagsOfNode: vi.fn().mockReturnValue([]),
            parseComment: vi.fn().mockReturnValue(''),
            getJSDocs: vi.fn().mockReturnValue([])
        };
        (classHelper as any).jsdocParserUtil = jsdocStub;
        (classHelper as any).memberVisitor.jsdocParserUtil = jsdocStub;
        vi.spyOn(nodeUtil, 'nodeHasDecorator').mockReturnValue(false);
        vi.spyOn(nodeUtil, 'getNodeDecorators').mockReturnValue([] as any);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function extractProperty(code: string, propName: string, imports = '') {
        const sf = project.createSourceFile(
            `test-${Date.now()}.ts`,
            `${imports}class TestClass { ${code} }`
        );
        const classDec = sf.getClasses()[0];
        const prop = classDec.getProperty(propName)!;
        return (classHelper as any).memberVisitor.visitProperty(prop.compilerNode, sf.compilerNode);
    }

    it('should extract this.x() calls from a computed body', () => {
        const result = extractProperty(
            `readonly cardType = signal('basic');
             readonly isSpecial = computed(() => this.cardType() !== 'article');`,
            'isSpecial'
        );

        expect(result.signalKind).toBe('computed');
        expect(result.signalDeps).toEqual(['cardType()']);
    });

    it('should extract multiple dependencies from a computed', () => {
        const result = extractProperty(
            `readonly count = signal(0);
             readonly limit = signal(10);
             readonly isOver = computed(() => this.count() > this.limit());`,
            'isOver'
        );

        expect(result.signalKind).toBe('computed');
        expect(result.signalDeps).toEqual(['count()', 'limit()']);
    });

    it('should deduplicate repeated dependency calls', () => {
        const result = extractProperty(
            `readonly name = signal('');
             readonly label = computed(() => this.name() + ' (' + this.name() + ')');`,
            'label'
        );

        expect(result.signalDeps).toEqual(['name()']);
    });

    it('should extract deps from linkedSignal', () => {
        const result = extractProperty(
            `readonly source = signal(0);
             readonly derived = linkedSignal(() => this.source() * 2);`,
            'derived'
        );

        expect(result.signalKind).toBe('linked-signal');
        expect(result.signalDeps).toEqual(['source()']);
    });

    it('should not extract deps from plain signal()', () => {
        const result = extractProperty(`readonly count = signal(0);`, 'count');

        expect(result.signalKind).toBe('signal');
        expect(result.signalDeps).toBeUndefined();
    });

    it('should not extract deps from input()', () => {
        const result = extractProperty(
            `readonly user = input<string>();`,
            'user',
            `import { input } from '@angular/core';\n`
        );

        expect(result.signalKind).toBe('input-signal');
        expect(result.signalDeps).toBeUndefined();
    });

    it('should not include service method calls (non-this.xxx())', () => {
        const result = extractProperty(
            `readonly data = signal([]);
             readonly count = computed(() => {
                 console.log('computing');
                 return this.data().length;
             });`,
            'count'
        );

        // Only this.data() should be captured, not console.log
        expect(result.signalDeps).toEqual(['data()']);
    });

    it('should handle computed with no this-calls', () => {
        const result = extractProperty(`readonly val = computed(() => 42);`, 'val');

        expect(result.signalKind).toBe('computed');
        expect(result.signalDeps).toBeUndefined();
    });

    it('should extract plain property access without parens suffix', () => {
        const result = extractProperty(
            `rovingParent: any = null;
             readonly hasParent = computed(() => this.rovingParent !== null);`,
            'hasParent'
        );

        expect(result.signalDeps).toEqual(['rovingParent']);
    });

    it('should distinguish called vs plain access in the same computed', () => {
        const result = extractProperty(
            `rovingParent: any = null;
             readonly interactive = signal(false);
             readonly ready = computed(() => this.rovingParent && this.interactive());`,
            'ready'
        );

        expect(result.signalDeps).toEqual(['rovingParent', 'interactive()']);
    });

    it('should extract deps from multi-line computed body', () => {
        const result = extractProperty(
            `readonly a = signal(1);
             readonly b = signal(2);
             readonly sum = computed(() => {
                 const x = this.a();
                 const y = this.b();
                 return x + y;
             });`,
            'sum'
        );

        expect(result.signalDeps).toEqual(['a()', 'b()']);
    });
});
