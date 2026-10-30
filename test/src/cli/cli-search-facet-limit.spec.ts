import { fs, hasStderrError, path, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI search facet limit', () => {
    const distFolder = `${tmp.name}-searchFacetLimit`;

    const generate = (...args: string[]): string => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/sample-files/tsconfig.simple.json',
            '-d',
            distFolder,
            ...args
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        return read(`${distFolder}/index.html`);
    };

    describe('default searchFacetLimit', () => {
        let indexFile: string;
        beforeAll(() => {
            indexFile = generate();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should give the palette a limit of 8', () => {
            expect(indexFile).to.contain('data-cdx-facet-limit="8"');
        });
    });

    describe('searchFacetLimit 0', () => {
        let indexFile: string;
        beforeAll(() => {
            indexFile = generate('--searchFacetLimit', '0');
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should write 0, which the palette reads as all chips', () => {
            expect(indexFile).to.contain('data-cdx-facet-limit="0"');
        });
    });

    describe('searchFacetLimit from the config file', () => {
        const configFile = `${tmp.name}-searchFacetLimit.json`;
        let fromConfig: string;
        beforeAll(() => {
            fs.writeFileSync(configFile, JSON.stringify({ searchFacetLimit: 3 }));
            fromConfig = generate('-c', path.resolve(configFile));
        });
        afterAll(() => {
            tmp.clean(distFolder);
            fs.rmSync(configFile, { force: true });
        });

        it('it should use the config value', () => {
            expect(fromConfig).to.contain('data-cdx-facet-limit="3"');
        });
    });
});
