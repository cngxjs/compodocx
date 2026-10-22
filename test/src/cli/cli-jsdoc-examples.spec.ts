import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI generation - JSDoc @example language specifications', () => {
    let stdoutString;
    const distFolder = `${tmp.name}-jsdoc-examples`;
    const pages = pagesIn(distFolder);

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
        const isDirectiveExists = exists(`${distFolder}/${pages.of('directive', 'TestClass')}`);
        expect(isDirectiveExists).to.be.true;
    });

    describe('Examples section on the Info tab', () => {
        let directiveFile: string;
        let examplesSection: string;

        beforeAll(() => {
            directiveFile = read(`${distFolder}/${pages.of('directive', 'TestClass')}`);
            // `markedtags()` renders every fenced @example through the
            // markdown engine, so the section holds the Shiki blocks as is.
            const start = directiveFile.indexOf('cdx-section-heading">Example');
            examplesSection = directiveFile.slice(
                start,
                directiveFile.indexOf('</section>', start)
            );
        });

        it('should contain the directive class documentation', () => {
            expect(directiveFile).to.contain('TestClass');
            expect(directiveFile).to.contain('Test class for JSDoc Example language specification');
        });

        it('should render one Shiki snippet per fenced @example', () => {
            const snippets = examplesSection.match(
                /<div class="cdx-code-snippet"><pre class="shiki/g
            );
            expect(snippets?.length).to.equal(3);
        });

        it('should not escape the rendered snippets a second time', () => {
            expect(directiveFile).not.to.contain('cdx-code-example');
            expect(directiveFile).not.to.contain('&lt;div class=&quot;cdx-code-snippet');
        });

        it('should highlight the TypeScript example', () => {
            const text = examplesSection.replace(/<[^>]+>/g, '');
            expect(text).to.contain('// TypeScript example');
            expect(text).to.contain('const instance = new TestClass();');
            expect(text).to.contain('instance.testMethod();');
            // Keyword colour of the github-light theme on `const`.
            expect(examplesSection).to.match(/color:#D73A49[^>]*>const</);
        });

        it('should keep empty lines inside a fenced example', () => {
            const text = examplesSection.replace(/<[^>]+>/g, '');
            expect(text).to.contain(
                'const instance = new TestClass();\n\n// Calling the test method'
            );
        });

        it('should render the HTML example as code, not as markup', () => {
            const text = examplesSection.replace(/<[^>]+>/g, '');
            expect(text).to.contain('&#x3C;div>Hello World&#x3C;/div>');
            expect(examplesSection).not.to.contain('<div>Hello World</div>');
        });

        it('should highlight the JavaScript example', () => {
            const text = examplesSection.replace(/<[^>]+>/g, '');
            expect(text).to.contain('// JavaScript example');
            expect(text).to.contain('const result = testFunction();');
        });

        it('should drop the markdown fences from the section', () => {
            expect(examplesSection).not.to.contain('```');
        });
    });

    describe('Method examples', () => {
        let directiveFile: string;

        beforeAll(() => {
            directiveFile = read(`${distFolder}/${pages.of('directive', 'TestClass')}`);
        });

        it('should render the method example as a Shiki snippet', () => {
            expect(directiveFile).to.match(
                /cdx-code-snippet"><pre class="shiki(?:(?!<\/pre>)[\s\S])*\/\/ Method usage/
            );
            const text = directiveFile.replace(/<[^>]+>/g, '');
            expect(text).to.contain('const test = new TestClass();');
            expect(text).to.contain('test.testMethod();');
        });
    });
});
