import { ts } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { createSemanticProgram } from '../../../src/app/compiler/semantic/program';
import { fencedRanges, repairFencedTags } from '../../../src/utils/jsdoc-fences';
import { compilerHost } from '../../../src/utils/utils';

const doc = (...lines: string[]): string => ['/**', ...lines.map(l => ` * ${l}`), ' */'].join('\n');

/** The text of each fenced block, by its offsets. */
const blocks = (comment: string): string[] =>
    fencedRanges(comment).map(range => comment.slice(range.start, range.end));

const parse = (source: string): ts.SourceFile =>
    ts.createSourceFile('/proj/x.ts', source, ts.ScriptTarget.ES2022, true);

const firstDoc = (sourceFile: ts.SourceFile): ts.JSDoc =>
    (sourceFile.statements[0] as unknown as { jsDoc: ts.JSDoc[] }).jsDoc[0];

const tagNames = (sourceFile: ts.SourceFile): string[] =>
    ts.getJSDocTags(sourceFile.statements[0]).map(tag => tag.tagName.text);

const repaired = (source: string): ts.SourceFile => repairFencedTags(parse(source));

describe('fencedRanges', () => {
    it('finds a backtick block with an info string', () => {
        const comment = doc('Lead.', '```html', '@if (a) {}', '```', '@since 1');
        expect(blocks(comment)).toEqual([' * @if (a) {}\n']);
    });

    it('finds a tilde block', () => {
        expect(blocks(doc('~~~', '@for (x of y) {}', '~~~'))).toEqual([' * @for (x of y) {}\n']);
    });

    it('finds an indented block', () => {
        expect(blocks(doc('  ```ts', '  @Component({})', '  ```'))).toEqual([
            ' *   @Component({})\n'
        ]);
    });

    it('closes only with the same character and at least the same length', () => {
        const comment = doc('````', '```', '~~~~', '@a', '````');
        expect(blocks(comment)).toEqual([' * ```\n * ~~~~\n * @a\n']);
        expect(blocks(doc('~~~', '@a', '~~~~~'))).toEqual([' * @a\n']);
        expect(blocks(doc('```', '@a', '```ts', '```'))).toEqual([' * @a\n * ```ts\n']);
    });

    it('opens nothing on a one-line fence', () => {
        expect(blocks(doc('```x```', '@since 1', '```', '@a', '```'))).toEqual([' * @a\n']);
    });

    it('drops a block left open at the end of the comment', () => {
        expect(blocks(doc('```ts', 'const a = 1;', '@deprecated use b'))).toEqual([]);
        expect(blocks(doc('```', '@a', '```', '```ts', '@b'))).toEqual([' * @a\n']);
    });

    it('adds the offset to the positions', () => {
        const comment = doc('```', '@a', '```');
        const [range] = fencedRanges(comment, 100);
        expect(range.start - 100).toBe(comment.indexOf(' * @a'));
    });
});

describe('repairFencedTags', () => {
    it('keeps a fenced decorator line in the description', () => {
        const sourceFile = repaired(
            `${doc(
                'Builds it:',
                '',
                '```ts',
                '@Component({',
                "  selector: 'app-x'",
                '})',
                'export class X {}',
                '```',
                '',
                'After the block.'
            )}\nexport function f() {}`
        );
        expect(tagNames(sourceFile)).toEqual([]);
        expect(firstDoc(sourceFile).comment).toBe(
            "Builds it:\n\n```ts\n@Component({\n  selector: 'app-x'\n})\nexport class X {}\n```\n\nAfter the block."
        );
    });

    it('drops control flow tags, also mid line, and keeps the real tag', () => {
        const sourceFile = repaired(
            `${doc(
                'Row:',
                '```html',
                '@if (a) {',
                '  <b>{@link Foo|label}</b>',
                '} @else {',
                '}',
                '```',
                '',
                '@since 0.2.0'
            )}\nexport class X {}`
        );
        expect(tagNames(sourceFile)).toEqual(['since']);
        expect(ts.getTextOfJSDocComment(ts.getJSDocTags(sourceFile.statements[0])[0].comment)).toBe(
            '0.2.0'
        );
        expect(firstDoc(sourceFile).comment).toBe(
            'Row:\n```html\n@if (a) {\n  <b>{@link Foo|label}</b>\n} @else {\n}\n```'
        );
    });

    it('rebuilds the text of a real tag that a fenced tag cut off', () => {
        const sourceFile = repaired(
            `${doc(
                'Lists.',
                '',
                '@example',
                '```html',
                '@for (x of y; track x) {',
                '  <li>{{ x }}</li>',
                '}',
                '```',
                '@since 0.3.0'
            )}\nexport class X {}`
        );
        const tags = ts.getJSDocTags(sourceFile.statements[0]);
        expect(tags.map(tag => tag.tagName.text)).toEqual(['example', 'since']);
        expect(tags[0].comment).toBe(
            '```html\n@for (x of y; track x) {\n  <li>{{ x }}</li>\n}\n```'
        );
        expect(firstDoc(sourceFile).comment).toBe('Lists.');
    });

    it('starts the rebuilt text of a parameter tag after its name', () => {
        const sourceFile = repaired(
            `${doc('Lead.', '@param {string} a - the a:', '```', '@x', '```', '@returns b')}\nexport function f(a) {}`
        );
        const tags = ts.getJSDocTags(sourceFile.statements[0]);
        expect(tags.map(tag => tag.tagName.text)).toEqual(['param', 'returns']);
        expect(tags[0].comment).toBe('- the a:\n```\n@x\n```');
        expect(
            ts.getJSDocParameterTags(
                (sourceFile.statements[0] as ts.FunctionDeclaration).parameters[0]
            )
        ).toHaveLength(1);
    });

    it('leaves a comment with an unclosed block alone', () => {
        const source = `${doc('Open:', '```ts', 'const a = 1;', '@deprecated use b')}\nexport class A {}\n${doc('Next.', '@since 1')}\nexport class B {}`;
        const sourceFile = repaired(source);
        const pristine = parse(source);
        expect(tagNames(sourceFile)).toEqual(['deprecated']);
        expect(firstDoc(sourceFile).comment).toBe(firstDoc(pristine).comment);
        expect(ts.getJSDocTags(sourceFile.statements[1]).map(tag => tag.tagName.text)).toEqual([
            'since'
        ]);
    });

    it('keeps comments without a fenced tag unchanged', () => {
        const source = `${doc('Text with {@link Foo}.', '```ts', 'const a = 1;', '```', '@since 1 and {@link Bar}')}\nexport class A {}`;
        const sourceFile = repaired(source);
        const pristine = parse(source);
        const tags = firstDoc(sourceFile).tags;
        expect(tags).toBe(firstDoc(sourceFile).tags);
        expect(tags?.map(tag => tag.comment)).toEqual(
            firstDoc(pristine).tags?.map(tag => tag.comment)
        );
        expect(firstDoc(sourceFile).comment).toEqual(firstDoc(pristine).comment);
    });

    it('repairs a source file once', () => {
        const sourceFile = parse(`${doc('```', '@a', '```')}\nexport class A {}`);
        expect(repairFencedTags(sourceFile)).toBe(sourceFile);
        const comment = firstDoc(sourceFile).comment;
        expect(repairFencedTags(sourceFile)).toBe(sourceFile);
        expect(firstDoc(sourceFile).comment).toBe(comment);
        expect(tagNames(sourceFile)).toEqual([]);
    });
});

describe('compiler hosts repair fenced tags', () => {
    it('repairs shared source files in the crawler host', () => {
        const shared = parse(`${doc('```', '@if (a) {}', '```')}\nexport class A {}`);
        const host = compilerHost(
            { target: ts.ScriptTarget.ES2022, tsconfigDirectory: '/proj' },
            fileName => (fileName === shared.fileName ? shared : undefined)
        );
        const sourceFile = host.getSourceFile('/proj/x.ts', ts.ScriptTarget.ES2022);
        expect(sourceFile && tagNames(sourceFile)).toEqual([]);
    });

    it('repairs the files of the semantic program', () => {
        const file = 'test/fixtures/jsdoc-fences/projects/fences/src/row-node.ts';
        const program = createSemanticProgram('test/fixtures/jsdoc-fences/tsconfig.json', [file]);
        if (program.ok === false) {
            throw new Error(program.message);
        }
        const row = program.value.getSourceFile(file)?.statements.find(ts.isClassDeclaration);
        expect(row && ts.getJSDocTags(row).map(tag => tag.tagName.text)).toEqual(['since']);
    });
});
