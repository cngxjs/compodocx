import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI tsconfig', () => {
    const tmpFolder = `${tmp.name}-tsconfig`;
    const distFolder = `${tmpFolder}/documentation`;

    describe('when specific files are included in tsconfig', () => {
        let fooComponentFile;
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/sample-files/', tmpFolder);

            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './tsconfig.entry.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            fooComponentFile = read(`${distFolder}/components/FooComponent.html`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain('components/FooComponent.html');
            expect(fooComponentFile).to.contain('app-config.html');
            expect(fooComponentFile).not.to.contain('components/BarComponent.html');
            expect(fooComponentFile).not.to.contain('injectables/FooService.html');
            expect(fooComponentFile).not.to.contain('directives/BarDirective.html');
        });
    });

    describe('when specific files are included in tsconfig + others', () => {
        let fooComponentFile;
        beforeAll(() => {
            tmp.create(tmpFolder);
            tmp.copy('./test/fixtures/sample-files/', tmpFolder);

            const ls = shell(
                'node',
                [
                    '../bin/index-cli.js',
                    '--no-multiVersion',
                    '-p',
                    './tsconfig.entry-and-include.json',
                    '-d',
                    'documentation'
                ],
                { cwd: tmpFolder }
            );

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            fooComponentFile = read(`${distFolder}/components/FooComponent.html`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain('components/FooComponent.html');
            expect(fooComponentFile).to.contain('app-config.html');
            expect(fooComponentFile).to.contain('components/BarComponent.html');
            expect(fooComponentFile).not.to.contain('injectables/FooService.html');
            expect(fooComponentFile).not.to.contain('directives/BarDirective.html');
        });
    });
});
