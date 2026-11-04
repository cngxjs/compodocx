import { Project, ts } from 'ts-morph';
import { ComponentHelper } from '../../../../../../../src/app/compiler/angular/deps/helpers/component-helper';

/** The `@Component({ ... })` properties of `source` and its source file. */
function parseComponentProps(source: string): {
    props: ReadonlyArray<ts.ObjectLiteralElementLike>;
    srcFile: ts.SourceFile;
} {
    const project = new Project({ useInMemoryFileSystem: true });
    const srcFile = project.createSourceFile('test.ts', source).compilerNode;
    let found: ts.ObjectLiteralExpression | undefined;
    const visit = (node: ts.Node): void => {
        if (found) {
            return;
        }
        if (
            ts.isCallExpression(node) &&
            ts.isIdentifier(node.expression) &&
            node.expression.text === 'Component' &&
            ts.isObjectLiteralExpression(node.arguments[0])
        ) {
            found = node.arguments[0] as ts.ObjectLiteralExpression;
            return;
        }
        ts.forEachChild(node, visit);
    };
    visit(srcFile);
    if (!found) {
        throw new Error('No @Component(...) call found in source');
    }
    return { props: found.properties, srcFile };
}

describe('ComponentHelper.getComponentStyles', () => {
    const helper = new ComponentHelper({} as any);
    const stylesOf = (source: string): string[] => {
        const { props, srcFile } = parseComponentProps(source);
        return helper.getComponentStyles(props, srcFile);
    };

    it('reads an array of string and template literals', () => {
        expect(
            stylesOf(
                "@Component({ styles: [':host { color: red; }', `.b { margin: 0; }`] }) class A {}"
            )
        ).toEqual([':host { color: red; }', '.b { margin: 0; }']);
    });

    it('reads a single string', () => {
        expect(stylesOf("@Component({ styles: ':host { display: block; }' }) class A {}")).toEqual([
            ':host { display: block; }'
        ]);
    });

    it('keeps a template literal with substitutions as written', () => {
        const source =
            "const COLOR = 'red';\n@Component({ styles: `:host { color: ${COLOR}; }` }) class A {}";
        expect(stylesOf(source)).toEqual([':host { color: ${COLOR}; }']);
    });

    it('keeps substitutions inside an array element as written', () => {
        const source =
            "const COLOR = 'red';\n@Component({ styles: [`:host { color: ${COLOR}; }`] }) class A {}";
        expect(stylesOf(source)).toEqual([':host { color: ${COLOR}; }']);
    });

    it('reads a local const referenced by name', () => {
        const source =
            "const SHARED = [':host { color: blue; }'];\n@Component({ styles: SHARED }) class A {}";
        expect(stylesOf(source)).toEqual([':host { color: blue; }']);
    });

    it('reads a shorthand property and spread consts', () => {
        const source = [
            "const BASE = [':host { color: blue; }'] as const;",
            "const styles = [...BASE, '.x { top: 0; }'];",
            '@Component({ styles }) class A {}'
        ].join('\n');
        expect(stylesOf(source)).toEqual([':host { color: blue; }', '.x { top: 0; }']);
    });

    it('drops a reference it cannot read instead of rendering its name', () => {
        expect(stylesOf('@Component({ styles: [UNKNOWN, buildStyles()] }) class A {}')).toEqual([]);
    });

    it('stops at a self-referencing const', () => {
        expect(stylesOf('const A: any = [A];\n@Component({ styles: A }) class C {}')).toEqual([]);
    });

    it('returns an empty list without styles', () => {
        expect(stylesOf("@Component({ selector: 'a' }) class A {}")).toEqual([]);
    });
});
