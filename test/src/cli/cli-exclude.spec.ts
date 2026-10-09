import { exists, hasStderrError, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';
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

        it('should not create files excluded', () => {
            let isFileExists = exists(`${distFolder}/${pageOf('component', 'BarComponent')}`);
            expect(isFileExists).to.be.false;
            isFileExists = exists(`${distFolder}/${pageOf('component', 'FooComponent')}`);
            expect(isFileExists).to.be.true;
            isFileExists = hasKindPages(distFolder, 'variable');
            expect(isFileExists).to.be.false;
        });
    });
});
