import { fs, hasStderrError, path, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI max search results', () => {
    const distFolder = `${tmp.name}-maxSearchResults`;

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

    describe('custom maxSearchResults', () => {
        let indexFile: string;
        beforeAll(() => {
            indexFile = generate('--maxSearchResults', '20');
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should have a MAX_SEARCH_RESULT of 20', () => {
            expect(indexFile).to.contain('window.MAX_SEARCH_RESULTS = 20;');
        });
    });

    describe('maxSearchResults 0', () => {
        let indexFile: string;
        beforeAll(() => {
            indexFile = generate('--maxSearchResults', '0');
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should write 0, which the palette reads as all results', () => {
            expect(indexFile).to.contain('window.MAX_SEARCH_RESULTS = 0;');
        });
    });

    describe('maxSearchResults from the config file', () => {
        const configFile = `${tmp.name}-maxSearchResults.json`;
        let fromConfig: string;
        let flagWins: string;
        beforeAll(() => {
            fs.writeFileSync(configFile, JSON.stringify({ maxSearchResults: 7 }));
            fromConfig = generate('-c', path.resolve(configFile));
            tmp.clean(distFolder);
            flagWins = generate('-c', path.resolve(configFile), '--maxSearchResults', '30');
        });
        afterAll(() => {
            tmp.clean(distFolder);
            fs.rmSync(configFile, { force: true });
        });

        it('it should use the config value', () => {
            expect(fromConfig).to.contain('window.MAX_SEARCH_RESULTS = 7;');
        });

        it('it should let the flag win over the config value', () => {
            expect(flagWins).to.contain('window.MAX_SEARCH_RESULTS = 30;');
        });
    });

    describe('default maxSearchResult', () => {
        let indexFile: string;
        beforeAll(() => {
            indexFile = generate();
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should have a MAX_SEARCH_RESULT of 15', () => {
            expect(indexFile).to.contain('window.MAX_SEARCH_RESULTS = 15;');
        });
    });
});
