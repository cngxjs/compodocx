import { exists, hasStderrError, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI include with tsconfig', () => {
    const distFolder = `${tmp.name}-include`;

    describe('when specific files (glob) are included in tsconfig', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.include-glob.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should create files included', () => {
            let isFileExists = exists(`${distFolder}/components/BarComponent.html`);
            expect(isFileExists).to.be.true;
            isFileExists = exists(`${distFolder}/miscellaneous/variables.html`);
            expect(isFileExists).to.be.false;
            isFileExists = exists(`${distFolder}/app-config.html`);
            expect(isFileExists).to.be.false;
        });
    });

    describe('when specific file is included in tsconfig', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.include-file.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should create file included', () => {
            let isFileExists = exists(`${distFolder}/components/BarComponent.html`);
            expect(isFileExists).to.be.true;
            isFileExists = exists(`${distFolder}/miscellaneous/variables.html`);
            expect(isFileExists).to.be.false;
        });
    });

    describe('when specific file is included in tsconfig with one level / cwd', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.extended.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should create file included', () => {
            const isFileExists = exists(`${distFolder}/classes/GenTodo.html`);
            expect(isFileExists).to.be.true;
        });
    });
});
