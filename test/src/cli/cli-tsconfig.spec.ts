import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI tsconfig', () => {
    const tmpFolder = `${tmp.name}-tsconfig`;
    const distFolder = `${tmpFolder}/documentation`;

    describe('when specific files are included in tsconfig', () => {
        const pages = pagesIn(distFolder);
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
            // The page plus the shared menu it loads (`js/menu.js`).
            fooComponentFile =
                read(`${distFolder}/${pages.of('component', 'FooComponent')}`) + menuOf(distFolder);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain(`${pages.of('component', 'FooComponent')}`);
            expect(fooComponentFile).to.contain('app-config.html');
            expect(() => pages.of('component', 'BarComponent')).to.throw(/^0 /);
            expect(fooComponentFile).not.to.contain('BarComponent.html');
            expect(() => pages.of('injectable', 'FooService')).to.throw(/^0 /);
            expect(fooComponentFile).not.to.contain('FooService.html');
            expect(() => pages.of('directive', 'BarDirective')).to.throw(/^0 /);
            expect(fooComponentFile).not.to.contain('BarDirective.html');
        });
    });

    describe('when specific files are included in tsconfig + others', () => {
        const pages = pagesIn(distFolder);
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
            // The page plus the shared menu it loads (`js/menu.js`).
            fooComponentFile =
                read(`${distFolder}/${pages.of('component', 'FooComponent')}`) + menuOf(distFolder);
        });
        afterAll(() => tmp.clean(tmpFolder));

        it('should only create links to files included via tsconfig', () => {
            expect(fooComponentFile).to.contain(`${pages.of('component', 'FooComponent')}`);
            expect(fooComponentFile).to.contain('app-config.html');
            expect(fooComponentFile).to.contain(`${pages.of('component', 'BarComponent')}`);
            expect(() => pages.of('injectable', 'FooService')).to.throw(/^0 /);
            expect(fooComponentFile).not.to.contain('FooService.html');
            expect(() => pages.of('directive', 'BarDirective')).to.throw(/^0 /);
            expect(fooComponentFile).not.to.contain('BarDirective.html');
        });
    });
});
