import { exists, hasStderrError, read, shell, stats, temporaryDir } from '../helpers';

const tmp = temporaryDir();

interface Image {
    size: number;
}

describe('CLI custom logo', () => {
    const distFolder = `${tmp.name}-logo`;

    describe('when specifying a custom logo png image', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '--customLogo',
                './test/fixtures/todomvc-ng2/logo.png'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have copied the customLogo', () => {
            const isFileExists = exists(`${distFolder}/images/logo.png`);
            expect(isFileExists).to.be.true;
            const originalFileSize = (stats('test/fixtures/todomvc-ng2/logo.png') as Image).size,
                copiedFileSize = (stats(`${distFolder}/images/logo.png`) as Image).size;
            expect(originalFileSize).to.equal(copiedFileSize);
        });

        it('should link the copied customLogo in the sidebar', () => {
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain('<img src="./images/logo.png"');
        });

        it('should show a square logo as an icon next to the project name', () => {
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain('class="cdx-sidebar-logo cdx-sidebar-logo--icon"');
            expect(index).to.contain('<img src="./images/logo.png" alt=""/>');
            expect(index).to.contain('class="cdx-sidebar-logo-name"');
        });
    });

    describe('when specifying a custom logo svg image', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '--customLogo',
                './test/fixtures/todomvc-ng2/logo.svg',
                '--logoLayout',
                'wordmark'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should have copied the customLogo', () => {
            const isFileExists = exists(`${distFolder}/images/logo.svg`);
            expect(isFileExists).to.be.true;
            const originalFileSize = (stats('test/fixtures/todomvc-ng2/logo.svg') as Image).size,
                copiedFileSize = (stats(`${distFolder}/images/logo.svg`) as Image).size;
            expect(originalFileSize).to.equal(copiedFileSize);
        });

        it('should link the copied customLogo in the sidebar', () => {
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain('<img src="./images/logo.svg"');
        });

        it('should show the logo alone when --logoLayout is wordmark', () => {
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain(
                '<a href="index.html" data-type="index-link" class="cdx-sidebar-logo">'
            );
            expect(index).to.not.contain('cdx-sidebar-logo-name');
        });
    });

    describe('when specifying a wide custom logo', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder,
                '--customLogo',
                './test/fixtures/todomvc-ng2/logo-wide.svg',
                '--customLogoDark',
                './test/fixtures/todomvc-ng2/logo-wide-dark.svg'
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should show a wide logo alone, named by the project', () => {
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain(
                '<img class="cdx-sidebar-logo-img cdx-sidebar-logo-img--light" src="./images/logo-wide.svg" alt="'
            );
            expect(index).to.not.contain('cdx-sidebar-logo--icon');
        });

        it('should copy and link the dark variant next to the light one', () => {
            expect(exists(`${distFolder}/images/logo-wide-dark.svg`)).to.be.true;
            const index = read(`${distFolder}/index.html`);
            expect(index).to.contain(
                '<img class="cdx-sidebar-logo-img cdx-sidebar-logo-img--dark" src="./images/logo-wide-dark.svg" alt="'
            );
        });
    });

    describe('when not specifying a custom logo svg image', () => {
        beforeAll(() => {
            tmp.create(distFolder);
            const ls = shell('node', [
                './bin/index-cli.js',
                '--no-multiVersion',
                '-p',
                './test/fixtures/todomvc-ng2/src/tsconfig.json',
                '-d',
                distFolder
            ]);

            if (hasStderrError(ls.stderr.toString())) {
                console.error(`shell error: ${ls.stderr.toString()}`);
                throw new Error('error');
            }
        });
        afterAll(() => tmp.clean(distFolder));

        it('should not have copied the customLogo', () => {
            const isFileExists = exists(`${distFolder}/images/logo.svg`);
            expect(isFileExists).to.not.be.true;
        });
    });
});
