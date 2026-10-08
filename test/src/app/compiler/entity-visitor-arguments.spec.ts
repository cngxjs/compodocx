import { ts } from 'ts-morph';
import { beforeAll, describe, expect, it } from 'vitest';
import { ClassHelper } from '../../../../src/app/compiler/angular/deps/helpers/class-helper';
import { EntityVisitor } from '../../../../src/app/compiler/angular-dependencies/entity-visitor';
import { JsdocTags } from '../../../../src/app/compiler/angular-dependencies/jsdoc-tags';
import { JsdocParserUtil } from '../../../../src/utils';

const SOURCE = `
export interface Feature { readonly kind: string }
export type Mode = 'a' | 'b';
export function provide(...features: Feature[]): void {}
export function pick(mode: 'a' | 'b' | Mode): void {}
export function run(callback: (value: number) => string): void {}
export function wrap(items: Map<string, Feature>, pair: [string, number]): void {}
`;

let args: Record<string, { name: string; type?: string }[]>;

beforeAll(() => {
    const options: ts.CompilerOptions = { noLib: true, types: [], noEmit: true };
    const host = ts.createCompilerHost(options, true);
    host.fileExists = fileName => fileName === '/a.ts';
    host.readFile = () => SOURCE;
    host.getSourceFile = (fileName, version) =>
        fileName === '/a.ts' ? ts.createSourceFile(fileName, SOURCE, version, true) : undefined;
    const program = ts.createProgram({ rootNames: ['/a.ts'], options, host });
    const jsdocParserUtil = new JsdocParserUtil();
    const visitor = new EntityVisitor(
        new ClassHelper(program.getTypeChecker()),
        jsdocParserUtil,
        new JsdocTags(jsdocParserUtil)
    );
    const sourceFile = program.getSourceFile('/a.ts') as ts.SourceFile;
    args = Object.fromEntries(
        sourceFile.statements
            .filter(ts.isFunctionDeclaration)
            .map(fn => [fn.name?.text ?? '', fn.parameters.map(p => visitor.visitArgument(p))])
    );
});

describe('top-level function parameter types', () => {
    it('keeps the element type of a rest array', () => {
        expect(args.provide[0].type).toBe('Feature[]');
    });

    it('keeps a union of literals and references', () => {
        expect(args.pick[0].type).toMatch(/'a' \| 'b' \| Mode|"a" \| "b" \| Mode/);
    });

    it('renders a function type like a class member parameter', () => {
        expect(args.run[0].type).toBe('function');
    });

    it('keeps generic references and tuples', () => {
        expect(args.wrap[0].type).toMatch(/^Map<.*Feature>$/);
        expect(args.wrap[1].type).toBeDefined();
        expect(args.wrap[1].type).not.toBe('undefined');
    });
});
