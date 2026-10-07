import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

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
            fooComponentFile = read(`${distFolder}/${pageOf('component', 'FooComponent')}`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain(`${pageOf('component', 'FooComponent')}`);
            expect(fooComponentFile).to.contain('app-config.html');
            expect(fooComponentFile).not.to.contain(`${pageOf('component', 'BarComponent')}`);
            expect(fooComponentFile).not.to.contain(`${pageOf('injectable', 'FooService')}`);
            expect(fooComponentFile).not.to.contain(`${pageOf('directive', 'BarDirective')}`);
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
            fooComponentFile = read(`${distFolder}/${pageOf('component', 'FooComponent')}`);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain(`${pageOf('component', 'FooComponent')}`);
            expect(fooComponentFile).to.contain('app-config.html');
            expect(fooComponentFile).to.contain(`${pageOf('component', 'BarComponent')}`);
            expect(fooComponentFile).not.to.contain(`${pageOf('injectable', 'FooService')}`);
            expect(fooComponentFile).not.to.contain(`${pageOf('directive', 'BarDirective')}`);
        });
    });
});
