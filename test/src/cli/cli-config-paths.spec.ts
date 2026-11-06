import * as os from 'node:os';

import { exists, fs, hasStderrError, path, read, shell } from '../helpers';
import { menuOf } from '../helpers/menu';
import { pagesIn } from '../helpers/pages';

const repo = process.cwd();

/** A config folder outside the cwd with every input next to the config file. */
const writeConfigFolder = (root: string): void => {
    fs.mkdirSync(path.join(root, 'inc'), { recursive: true });
    fs.mkdirSync(path.join(root, 'assets'));
    fs.mkdirSync(path.join(root, 'tpl', 'partials'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'inc', 'summary.json'),
        JSON.stringify([{ title: 'Guide', slug: 'guide', file: 'guide.md' }])
    );
    fs.writeFileSync(path.join(root, 'inc', 'guide.md'), '# Guide\n\nConfig folder guide.\n');
    fs.writeFileSync(
        path.join(root, 'inc', 'labels.json'),
        JSON.stringify({ guide: { label: 'Guide from labels' } })
    );
    fs.writeFileSync(path.join(root, 'assets', 'note.txt'), 'asset\n');
    fs.copyFileSync(
        path.join(repo, 'test/fixtures/todomvc-ng2/logo.svg'),
        path.join(root, 'brand.svg')
    );
    fs.writeFileSync(
        path.join(root, 'tpl', 'partials', 'component.js'),
        'module.exports = data => `<p>config folder template ${data.component.name}</p>`;\n'
    );
};

const CONFIG = {
    includes: 'inc',
    includesLabels: 'inc/labels.json',
    assetsFolder: 'assets',
    customLogo: 'brand.svg',
    output: 'out',
    templates: 'tpl'
};

const run = (args: readonly string[]): string => {
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '--disableSearch',
        '-p',
        './test/fixtures/todomvc-ng2/src/tsconfig.json',
        ...args
    ]);
    if (ls.status !== 0 || hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return ls.stdout.toString();
};

describe('CLI config file in another folder', () => {
    let root: string;
    let out: string;

    beforeAll(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-config-paths-')));
        writeConfigFolder(root);
        fs.writeFileSync(path.join(root, 'compodocx.json'), JSON.stringify(CONFIG));
        out = path.join(root, 'out');
        run(['-c', path.join(root, 'compodocx.json')]);
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('writes the output below the config folder', () => {
        expect(exists(path.join(out, 'index.html'))).to.be.true;
        expect(exists(path.join(repo, 'out'))).to.be.false;
    });

    it('writes the additional pages with the labels file of the config folder', () => {
        const menu = menuOf(out);
        expect(menu).to.contain('Guide from labels');
        const guide = fs
            .readdirSync(out, { recursive: true })
            .map(String)
            .find(file => file.endsWith(`guide.html`));
        expect(guide, 'guide page').to.be.a('string');
        expect(read(path.join(out, guide as string))).to.contain('Config folder guide.');
    });

    it('copies the assets folder and the logo of the config folder', () => {
        expect(exists(path.join(out, 'assets', 'note.txt'))).to.be.true;
        expect(exists(path.join(out, 'images', 'brand.svg'))).to.be.true;
    });

    it('renders the template override of the config folder', () => {
        const page = pagesIn(out).of('component', 'AppComponent');
        expect(read(path.join(out, page))).to.contain('config folder template AppComponent');
    });
});

describe('CLI config file in another folder with flags', () => {
    let root: string;
    let distFolder: string;

    beforeAll(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-config-flags-')));
        writeConfigFolder(root);
        fs.writeFileSync(path.join(root, 'compodocx.json'), JSON.stringify(CONFIG));
        distFolder = path.join(root, 'flag-out');
        run([
            '-c',
            path.join(root, 'compodocx.json'),
            '-d',
            path.relative(repo, distFolder),
            '--includes',
            './test/fixtures/todomvc-ng2/additional-doc'
        ]);
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('lets the cwd-relative flags win', () => {
        expect(exists(path.join(distFolder, 'index.html'))).to.be.true;
        expect(exists(path.join(root, 'out'))).to.be.false;
        const menu = menuOf(distFolder);
        expect(menu).to.contain('Big Introduction');
        expect(menu).not.to.contain('Guide from labels');
    });
});

describe('CLI config in package.json of another folder', () => {
    let root: string;

    beforeAll(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-config-pkg-')));
        writeConfigFolder(root);
        fs.writeFileSync(
            path.join(root, 'package.json'),
            JSON.stringify({ name: 'pkg', version: '1.0.0', compodocx: CONFIG })
        );
        run(['-c', path.join(root, 'package.json')]);
    });
    afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

    it('resolves the paths against the folder of that package.json', () => {
        expect(exists(path.join(root, 'out', 'index.html'))).to.be.true;
        expect(exists(path.join(root, 'out', 'assets', 'note.txt'))).to.be.true;
    });
});
