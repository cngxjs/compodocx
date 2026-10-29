import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/**
 * `<example-url>` tags in a class description feed `exampleUrls` and the
 * Example tab; they are not part of `description`, `rawdescription` or the
 * llm-md text, which lists the URLs under `Examples:`. The todomvc-ng2
 * `TodoComponent` has one in its description.
 */
const generate = (distFolder: string, format: string): void => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        './test/fixtures/todomvc-ng2/src/tsconfig.json',
        '-d',
        distFolder,
        '-e',
        format
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

describe('CLI export: example URLs out of descriptions', () => {
    const jsonFolder = `${tmp.name}-example-url-json`;
    const llmFolder = `${tmp.name}-example-url-llm`;
    let todo: any;
    let llm: string;

    beforeAll(() => {
        generate(jsonFolder, 'json');
        generate(llmFolder, 'llm-md');
        const data = JSON.parse(read(`${jsonFolder}/documentation.json`, 'utf8'));
        todo = data.components.find((c: any) => c.name === 'TodoComponent');
        llm = read(`${llmFolder}/llm-context.md`, 'utf8');
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(llmFolder);
    });

    it('keeps the tag out of description and rawdescription', () => {
        expect(todo.description).not.to.contain('example-url');
        expect(todo.description).not.to.contain('/demo/mysample.component.html');
        expect(todo.rawdescription).not.to.contain('example-url');
    });

    it('keeps the rest of the description', () => {
        expect(todo.rawdescription).to.contain('<todo>');
    });

    it('still lists the URL in exampleUrls', () => {
        expect(todo.exampleUrls).to.deep.equal(['/demo/mysample.component.html']);
    });

    it('keeps the tag out of the llm-md text', () => {
        expect(llm).not.to.contain('example-url');
        const section = llm.slice(llm.indexOf('### TodoComponent'));
        const description = section.split('\n').find(line => line.startsWith('Description:'));
        expect(description).not.to.contain('/demo/mysample.component.html');
    });

    it('lists the URL under Examples in the llm-md entry', () => {
        const section = llm.slice(llm.indexOf('### TodoComponent')).split('\n### ')[0];
        expect(section).to.contain('Examples:\n- /demo/mysample.component.html');
    });
});
