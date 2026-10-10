import { exists, hasStderrError, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';
import { hasKindPages } from './paths';

const tmp = temporaryDir();

describe('CLI exclude from tsconfig', () => {
    const distFolder = `${tmp.name}-exclude`;

    describe('when specific files are excluded in tsconfig', () => {
        beforeAll(() => {
            tmp.create(distFolder);

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.exclude.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));
        const pages = pagesIn(distFolder);

        it('should not create files excluded', () => {
            expect(() => pages.of('component', 'BarComponent')).to.throw(/^0 /);
            expect(exists(`${distFolder}/${pages.of('component', 'FooComponent')}`)).to.be.true;
            const isFileExists = hasKindPages(distFolder, 'variable');
            expect(isFileExists).to.be.false;
        });
    });
});
