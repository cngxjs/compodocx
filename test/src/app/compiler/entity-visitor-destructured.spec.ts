import * as path from 'node:path';
import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { ClassHelper } from '../../../../src/app/compiler/angular/deps/helpers/class-helper';
import { EntityVisitor } from '../../../../src/app/compiler/angular-dependencies/entity-visitor';
import { JsdocTags } from '../../../../src/app/compiler/angular-dependencies/jsdoc-tags';
import { JsdocParserUtil } from '../../../../src/utils';

const SOURCE = `
export function both({ a, b }: { a: number; b: string }, { c }: { c: boolean }): void {}
`;

// TypeScript file names use `/` on every platform.
const FILE = `${process.cwd().replace(/\\/g, '/')}/src/a.ts`;

/** The parsed arguments of `both`, from a fresh program each time. */
const argsOfBoth = (): { name: string; destrucuredGroupId?: string }[] => {
    const options: ts.CompilerOptions = { noLib: true, types: [], noEmit: true };
    const host = ts.createCompilerHost(options, true);
    host.fileExists = fileName => fileName === FILE;
    host.readFile = () => SOURCE;
    host.getSourceFile = (fileName, version) =>
        fileName === FILE ? ts.createSourceFile(fileName, SOURCE, version, true) : undefined;
    const program = ts.createProgram({ rootNames: [FILE], options, host });
    const jsdocParserUtil = new JsdocParserUtil();
    const visitor = new EntityVisitor(
        new ClassHelper(program.getTypeChecker()),
        jsdocParserUtil,
        new JsdocTags(jsdocParserUtil)
    );
    const sourceFile = program.getSourceFile(FILE) as ts.SourceFile;
    const both = sourceFile.statements.find(ts.isFunctionDeclaration) as ts.FunctionDeclaration;
    return visitor.visitFunctionDeclaration(both).args;
};

describe('destructured parameter group ids', () => {
    it('derives the id from the file and the position of the binding pattern', () => {
        const ids = argsOfBoth().map(arg => [arg.name, arg.destrucuredGroupId]);

        expect(ids).toEqual([
            ['a', 'src/a.ts:2:22'],
            ['b', 'src/a.ts:2:22'],
            ['c', 'src/a.ts:2:58']
        ]);
        expect(path.isAbsolute(String(ids[0][1]))).toBe(false);
    });

    it('gives the same ids on every run', () => {
        expect(argsOfBoth()).toEqual(argsOfBoth());
    });
});
