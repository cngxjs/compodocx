import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

/**
 * `async-container.ts` of the cngx-library fixture holds five classes; only
 * the JSDoc of `CngxAsyncSkeletonTpl` has an `<example-url>`. The other four
 * used to get it too, because the tags were read from the whole file.
 */
describe('CLI export: example URLs per class', () => {
    const distFolder = `${tmp.name}-example-urls`;
    let directives: any[];
    let components: any[];

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/cngx-library/tsconfig.json',
            '-d',
            distFolder,
            '-e',
            'json'
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        const data = JSON.parse(read(`${distFolder}/documentation.json`, 'utf8'));
        directives = data.directives ?? [];
        components = data.components ?? [];
    });
    afterAll(() => tmp.clean(distFolder));

    const urls = (list: any[], name: string) => list.find(e => e.name === name)?.exampleUrls;

    it('keeps the URL on the class whose JSDoc has it', () => {
        expect(urls(directives, 'CngxAsyncSkeletonTpl')).to.deep.equal([
            '/demo/#/ui/feedback/async-container'
        ]);
    });

    it('gives the other classes of the file no URL', () => {
        for (const name of ['CngxAsyncContentTpl', 'CngxAsyncEmptyTpl', 'CngxAsyncErrorTpl']) {
            expect(urls(directives, name), name).to.be.undefined;
        }
        expect(urls(components, 'CngxAsyncContainer')).to.be.undefined;
    });

    it('keeps the tags out of the comments of other JSDoc tags', () => {
        // In the fixture the tag sits below `@example`, so it was the comment of that tag.
        const tagged = [...directives, ...components].filter(entry =>
            JSON.stringify(entry.jsdoctags ?? []).includes('example-url')
        );
        expect(tagged.map(entry => entry.name)).to.deep.equal([]);
    });
});
