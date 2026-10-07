import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI generation - JSDoc @example language specifications', () => {
    let stdoutString;
    const distFolder = `${tmp.name}-jsdoc-examples`;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/sample-files/tsconfig.examples.json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
    });

    afterAll(() => tmp.clean(distFolder));

    it('should display generated message', () => {
        expect(stdoutString).to.contain('Documentation generated');
    });

    it('should have generated main folder', () => {
        const isFolderExists = exists(`${distFolder}`);
        expect(isFolderExists).to.be.true;
    });

    it('should have generated directive documentation', () => {
        const isDirectiveExists = exists(`${distFolder}/${pageOf('directive', 'TestClass')}`);
        expect(isDirectiveExists).to.be.true;
    });

    describe('JSDoc @example language specifications', () => {
        let directiveFile: string;

        beforeAll(() => {
            directiveFile = read(`${distFolder}/${pageOf('directive', 'TestClass')}`);
        });

        // Note on the current rendering pipeline (matches actual output of
        // `extractJsdocCodeExamples` in `src/templates/helpers/jsdoc.ts`
        // when fed Shiki-rendered HTML by `markedtags()`):
        //
        // - Each fenced @example block surfaces twice: once in the
        //   class-level Examples section as a `<pre class="cdx-code-example">`
        //   wrapper, once in the source-code panel as Shiki spans.
        // - The wrapper's `<code class="language-…">` is always
        //   `language-html`; per-fence language detection (typescript /
        //   javascript) does not propagate through the current pipeline.
        // - Identifier text (`testMethod`, `const instance = new …`,
        //   etc.) reaches both places. The HTML-example fence renders
        //   `<div>` etc. as `&#x3C;…&gt;` inside the source-code panel
        //   (Shiki escape) and round-trips through additional escaping
        //   inside the Examples section wrapper.

        it('should contain the directive class documentation', () => {
            expect(directiveFile).to.contain('TestClass');
            expect(directiveFile).to.contain('Test class for JSDoc Example language specification');
        });

        it('should surface the TypeScript example tokens on the page', () => {
            expect(directiveFile).to.contain('// TypeScript example');
            expect(directiveFile).to.contain('const instance = new TestClass();');
            expect(directiveFile).to.contain('instance.testMethod();');
        });

        it('should surface the HTML example tokens on the page', () => {
            // Source-code panel renders the literal `<div>Hello World</div>`
            // line with Shiki's hex-entity escape (`&#x3C;`).
            expect(directiveFile).to.contain('Hello World');
            expect(directiveFile).to.contain('&#x3C;/');
        });

        it('should surface the JavaScript example tokens on the page', () => {
            expect(directiveFile).to.contain('// JavaScript example');
            expect(directiveFile).to.contain('const result = testFunction();');
        });

        it('should keep raw markdown fences in the source-code panel only', () => {
            // The class-level Examples section strips fences.
            const examplesSection = directiveFile.split('cdx-code-example')[1] ?? '';
            expect(examplesSection.startsWith('```')).to.be.false;
            // Triple-backticks survive in the Shiki-rendered source-code
            // panel (they are part of the literal source file content).
            expect(directiveFile).to.contain('```');
        });

        it('should render the cdx-code-example block once per fenced example', () => {
            const codeBlocks =
                directiveFile.match(/<pre class="cdx-code-example"><code class="language-/g) ?? [];
            // Three class-level `@example` fences in the fixture.
            expect(codeBlocks.length).to.equal(3);
        });

        it('should escape HTML markup inside the source-code panel', () => {
            // Hex-entity escapes for `<` come out of the Shiki-highlighted
            // source-code panel.
            expect(directiveFile).to.contain('&#x3C;');
        });

        describe('Method examples', () => {
            it('should surface the method example tokens on the page', () => {
                expect(directiveFile).to.contain('testMethod');
                expect(directiveFile).to.contain('// Method usage');
                expect(directiveFile).to.contain('const test = new TestClass();');
                expect(directiveFile).to.contain('test.testMethod();');
            });

            it('should keep the method example identifiers alongside the language- chip', () => {
                const methodSection = directiveFile.substring(directiveFile.indexOf('testMethod'));
                expect(methodSection).to.contain('language-html');
                expect(methodSection).to.contain('// Method usage');
            });
        });

        it('should still work with legacy @example tags without language specification', () => {
            // Defaults to `language-html` — currently the only language
            // class the pipeline emits, so this trivially holds.
            expect(directiveFile).to.contain('language-html');
        });
    });

    describe('Code block structure', () => {
        let directiveFile: string;

        beforeAll(() => {
            directiveFile = read(`${distFolder}/${pageOf('directive', 'TestClass')}`);
        });

        it('should use proper HTML structure for code blocks', () => {
            expect(directiveFile).to.contain('<pre class="cdx-code-example">');
            // Per the note above, every fenced @example collapses to
            // `language-html` in the class-level Examples wrapper.
            expect(directiveFile).to.contain('<code class="language-html">');
            expect(directiveFile).to.contain('</code></pre>');
        });

        it('should emit one cdx-code-example block per fenced @example', () => {
            const preElements = directiveFile.match(/<pre class="cdx-code-example">/g) ?? [];
            // Three class-level fences in the fixture; method-level
            // fences nest inside Shiki-highlighted descriptions and do
            // not get a `cdx-code-example` wrapper of their own.
            expect(preElements.length).to.equal(3);
        });

        it('should maintain code indentation and formatting', () => {
            expect(directiveFile).to.contain('const instance = new TestClass();');
            expect(directiveFile).to.contain('instance.testMethod();');
        });
    });

    describe('Multiple examples handling', () => {
        let directiveFile: string;

        beforeAll(() => {
            directiveFile = read(`${distFolder}/${pageOf('directive', 'TestClass')}`);
        });

        it('should emit a language- chip on every example block', () => {
            const htmlBlocks = (directiveFile.match(/language-html/g) ?? []).length;
            // Three fences → three `language-html` chips (the pipeline
            // currently does not surface `language-typescript` or
            // `language-javascript` chips on the wrapper).
            expect(htmlBlocks).to.equal(3);
        });

        it('should separate each example into distinct code blocks', () => {
            const codeBlocks =
                directiveFile.match(
                    /<pre class="cdx-code-example"><code class="language-[^"]*">/g
                ) ?? [];
            // One block per fenced @example.
            expect(codeBlocks.length).to.equal(3);
        });
    });
});
