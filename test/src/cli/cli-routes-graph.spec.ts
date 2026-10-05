import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI Routes graph', () => {
    const distFolder = `${tmp.name}-routes-graph`;

    describe('disable it', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '--disableRoutesGraph',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('it should not exist routes_index.js file', () => {
            const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
            expect(isFileExists).to.be.false;
        });
    });

    describe('should support provideRouter', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should list provideRouter in the app config providers', () => {
            const file = read(`${distFolder}/app-config.html`);
            expect(file).to.contain(
                '<a href="https://angular.dev/api/router/provideRouter" target="_blank">provideRouter()</a>'
            );
        });
    });

    describe('should support lazy-loaded routes with loadChildren syntax (containing possible trailing commas)', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/lazy-trailing-comma/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have a clean graph', () => {
            const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
            expect(isFileExists).to.be.true;
            const file = read(`${distFolder}/js/routes/routes_index.js`);
            expect(file).to.contain('AboutComponent');
        });
    });

    describe('should support lazy-loaded routes with loadChildren syntax / async', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/lazy-async/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have a clean graph', () => {
            const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
            expect(isFileExists).to.be.true;
            const file = read(`${distFolder}/js/routes/routes_index.js`);
            expect(file).to.contain('AboutComponent');
        });
    });

    describe('should support if statement for bootstrapApplication', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/bootstrap-if/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have a clean graph', () => {
            const isFileExists = exists(`${distFolder}/js/routes/routes_index.js`);
            expect(isFileExists).to.be.true;
            const file = read(`${distFolder}/js/routes/routes_index.js`);
            expect(file).to.contain('HomeComponent');
        });
    });

    describe('should support route in external file', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/standalone-scenarios/routing/simple/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should correctly read external file', () => {
            const file = read(`${distFolder}/js/routes/routes_index.js`);
            expect(file).to.contain('login');
        });
    });
});
