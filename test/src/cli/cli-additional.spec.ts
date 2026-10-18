import { exists, hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();

const generate = (distFolder: string, includes: string) =>
    shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '--disableSearch',
        '-p',
        './test/fixtures/todomvc-ng2/src/tsconfig.json',
        '-d',
        distFolder,
        '-a',
        './test/fixtures/todomvc-ng2/screenshots',
        '--includes',
        includes,
        '--includesName',
        'Additional documentation'
    ]);

describe('CLI Additional documentation', () => {
    let menu: string;

    const distFolder = `${tmp.name}-additional`;

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = generate(distFolder, './test/fixtures/todomvc-ng2/additional-doc');

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        menu = menuOf(distFolder);
    });
    afterAll(() => tmp.clean(distFolder));

    it('should have a menu with links', () => {
        expect(menu).to.contain('Additional documentation');
        expect(menu).to.contain('href="additional-documentation/big-introduction.html"');
        expect(menu).to.contain('Big Introduction');
    });

    it('should have generated files', () => {
        expect(exists(`${distFolder}/additional-documentation/edition.html`)).to.be.true;
        expect(exists(`${distFolder}/additional-documentation/big-introduction.html`)).to.be.true;
        const file = read(`${distFolder}/additional-documentation/big-introduction.html`);
        expect(file).to.contain('<h1 id="introduction">Introduction');
    });

    it('should keep relative image links of a nested page', () => {
        const file = read(`${distFolder}/additional-documentation/edition/edition-of-a-todo.html`);
        expect(file).to.contain('screenshots/actions/edition.png');
    });

    it('should copy the assets folder', () => {
        expect(exists(`${distFolder}/screenshots/actions`)).to.be.true;
    });

    it('should contain up to 5 levels of depth', () => {
        expect(menu).to.contain('for-chapter2');
        expect(menu).to.contain('for-chapter3');
        expect(menu).to.contain('for-chapter4');
        expect(menu).to.contain('for-chapter5');
        expect(menu).to.not.contain('for-chapter6');
    });

    it('should generate every link containing its parent reference', () => {
        const base = 'href="additional-documentation/edition/edition-of-a-todo';
        for (const link of [
            `${base}/edit-level3.html"`,
            `${base}/edit-level3/edit-level4.html"`,
            `${base}/edit-level3/edit-level4/edit-level5.html"`
        ]) {
            expect(menu).to.contain(link);
        }
        expect(menu).to.not.contain(
            `${base}/edit-level3/edit-level4/edit-level5/edit-level6.html"`
        );
        expect(
            exists(
                `${distFolder}/additional-documentation/edition/edition-of-a-todo/edit-level3/edit-level4/edit-level5/edit-level6.html`
            )
        ).to.be.false;
    });

    it('should have links in correct order', () => {
        const level3 = menu.indexOf('<li class="link for-chapter3">');
        const level4 = menu.indexOf('<li class="link for-chapter4">');
        expect(level3).to.be.greaterThan(-1);
        expect(level4).to.be.greaterThan(level3);
        expect(menu.slice(level3, level4)).to.contain(
            'href="additional-documentation/edition/edition-of-a-todo/edit-level3.html"'
        );
    });
});

describe('CLI Additional documentation - wrong folder', () => {
    let status: number;

    const distFolder = `${tmp.name}-additional-wrong-folder`;

    beforeAll(() => {
        tmp.create(distFolder);
        status = generate(distFolder, './test/fixtures/todomvc-ng2/additional-doc-wrong').status;
    });
    afterAll(() => tmp.clean(distFolder));

    it('should skip the additional pages and still exit with code 0', () => {
        expect(status).to.equal(0);
        expect(exists(`${distFolder}/additional-documentation`)).to.be.false;
        expect(menuOf(distFolder)).to.not.contain('href="additional-documentation/');
    });
});
