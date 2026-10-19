import { exists, hasStderrError, read, shell, stats, temporaryDir } from '../helpers';

const tmp = temporaryDir();

interface Image {
    size: number;
}

const iconLink = (html: string): string => html.match(/<link rel="icon"[^>]*>/)?.[0] ?? '';

const generate = (distFolder: string, extraArgs: readonly string[]): void => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '--disableSearch',
        '-p',
        './test/fixtures/todomvc-ng2/src/tsconfig.json',
        '-d',
        distFolder,
        ...extraArgs
    ]);

    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

describe('CLI custom favicon', () => {
    describe.each([
        ['ico', './test/fixtures/todomvc-ng2/favicon.ico', 'favicon.ico', 'image/x-icon'],
        ['svg', './test/fixtures/todomvc-ng2/logo.svg', 'favicon.svg', 'image/svg+xml'],
        ['png', './test/fixtures/todomvc-ng2/logo.png', 'favicon.png', 'image/png']
    ])('when specifying a custom %s favicon', (extension, source, file, type) => {
        const distFolder = `${tmp.name}-favicon-${extension}`;

        beforeAll(() => generate(distFolder, ['--customFavicon', source]));
        afterAll(() => tmp.clean(distFolder));

        it('copies the favicon with its own extension', () => {
            expect(exists(`${distFolder}/images/${file}`)).to.be.true;
            const originalFileSize = (stats(source) as Image).size,
                copiedFileSize = (stats(`${distFolder}/images/${file}`) as Image).size;
            expect(originalFileSize).to.equal(copiedFileSize);
        });

        it('links the copied file with its type', () => {
            const link = iconLink(read(`${distFolder}/index.html`));
            expect(link).to.contain(`href="./images/${file}"`);
            expect(link).to.contain(`type="${type}"`);
        });
    });

    describe('when not specifying a custom favicon', () => {
        const distFolder = `${tmp.name}-favicon-default`;

        beforeAll(() => generate(distFolder, []));
        afterAll(() => tmp.clean(distFolder));

        it('links the bundled SVG favicon', () => {
            const link = iconLink(read(`${distFolder}/index.html`));
            expect(link).to.contain('href="./images/favicon.svg"');
            expect(link).to.contain('type="image/svg+xml"');
            expect(exists(`${distFolder}/images/favicon.ico`)).to.be.false;
        });
    });
});
