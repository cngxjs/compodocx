import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

describe('CLI generation - TypeDoc examples', () => {
    let stdoutString;
    const distFolder = `${tmp.name}-typedoc`;
    const pages = pagesIn(distFolder);

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/typedoc-examples/tsconfig.json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        stdoutString = ls.stdout.toString();
    });
    afterAll(() => tmp.clean(distFolder));

    it('should display generated message', () => {
        expect(stdoutString).to.contain('Documentation generated');
    });

    it('interfaces - INameInterface', () => {
        const file = read(`${distFolder}/${pages.of('interface', 'INameInterface')}`);
        expect(file, 'Did not contain class comment').to.contain('This is a simple interface.');
        expect(file, 'Did not contain function commment').to.contain(
            'This is a interface function of INameInterface.'
        );
        expect(file, 'Did not contain member comment').to.contain(
            'This is a interface member of INameInterface.'
        );
    });

    it('interfaces - IPrintNameInterface', () => {
        const page = pages.of('interface', 'IPrintNameInterface');
        const file = read(`${distFolder}/${page}`);
        expect(file).to.contain('This is a interface inheriting from two other interfaces.');
        expect(file).to.contain('This is a interface function of IPrintNameInterface');
        // Interface metadata-label uses lowercase 'extends' (matches the TS keyword).
        expect(file).to.contain('cdx-metadata-label">extends</dt>');
        expect(file).to.contain(
            `href="${pages.href('interface', 'INameInterface', pages.depthOf(page))}"`
        );
    });

    it('classes - BaseClass', () => {
        const file = read(`${distFolder}/${pages.of('class', 'BaseClass')}`);
        expect(file).to.contain('This is a simple base class.');
        // Class metadata-label uses lowercase 'implements' (matches the TS keyword).
        expect(file).to.contain('cdx-metadata-label">implements</dt>');
        expect(file).to.contain('This is a private function.');
    });
});
