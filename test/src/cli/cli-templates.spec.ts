import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pageOf } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI custom JS templates', () => {
    const distFolder = `${tmp.name}-templates`;

    describe('with alternative JS template files', () => {
        let barComponentFile, fooComponentFile;

        beforeAll(() => {
            tmp.create(distFolder);

            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/sample-files/tsconfig.simple.json',
                '--templates',
                './test/fixtures/test-templates',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
            barComponentFile = read(`${distFolder}/${pageOf('component', 'BarComponent')}`);
            fooComponentFile = read(`${distFolder}/${pageOf('component', 'FooComponent')}`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('should use custom "component.js" template', () => {
            expect(barComponentFile).not.to.contain('<td class="col-md-3">selector</td>');
            expect(barComponentFile).to.contain('<h3>Selector</h3>');
        });

        it('should render constructor from custom template', () => {
            expect(fooComponentFile).to.contain('<h3 id="constructor">Constructor</h3>');
            expect(fooComponentFile).to.contain('<code>constructor()</code>');
        });
    });
});
