import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';

const tmp = temporaryDir();
const fixture = './test/fixtures/additional-tooltips';
const pages = 'additional-documentation';

const build = (distFolder: string, extra: string[] = []) => {
    tmp.create(distFolder);
    const run = shell(
        'node',
        [
            './bin/index-cli.js',
            '--no-multiVersion',
            '--disableSearch',
            '-p',
            './test/fixtures/todomvc-ng2/src/tsconfig.json',
            '-d',
            distFolder,
            '--includes',
            fixture,
            '--includesLabels',
            `${fixture}/labels.json`,
            ...extra
        ],
        { encoding: 'utf8' }
    );
    if (run.status !== 0 || hasStderrError(run.stderr)) {
        console.error(`shell error: ${run.stderr}`);
        throw new Error(`build failed: ${distFolder}`);
    }
    return run;
};

/** The opening tag of the menu link to `page` (path below the pages folder). */
const anchorOf = (menu: string, page: string): string => {
    const at = menu.indexOf(`href="${pages}/${page}.html"`);
    if (at === -1) {
        throw new Error(`no menu link to ${page}`);
    }
    const start = menu.lastIndexOf('<a', at);
    return menu.slice(start, menu.indexOf('>', at) + 1);
};

const titleOf = (anchor: string): string | undefined => /\btitle="([^"]*)"/.exec(anchor)?.[1];

/** The menu markup of the additional pages chapter. */
const chapterOf = (menu: string): string => {
    const start = menu.indexOf('id="additional-pages"');
    return menu.slice(start, menu.indexOf('</ul></li></ul>', start));
};

describe('CLI Additional documentation - link tooltips', () => {
    const onDist = `${tmp.name}-tooltips-on`;
    const offDist = `${tmp.name}-tooltips-off`;
    let onMenu: string;
    let offMenu: string;
    let offStdout: string;
    let onStdout: string;

    beforeAll(() => {
        onStdout = build(onDist, ['--includesTooltips']).stdout;
        offStdout = build(offDist).stdout;
        onMenu = menuOf(onDist);
        offMenu = menuOf(offDist);
    });
    afterAll(() => {
        tmp.clean(onDist);
        tmp.clean(offDist);
    });

    it('shows the subtitle, the override or nothing per link with the flag', () => {
        const expected: Record<string, string | undefined> = {
            overview: undefined,
            errors: undefined,
            'errors/e0100': 'Unknown option',
            'errors/e0101': undefined,
            'errors/e0102': 'Path a &amp; b is &quot;quoted&quot;',
            'errors/e0103': 'Custom description',
            'errors/e0104': undefined,
            'errors/e0105': 'From the labels file',
            'reference/limits': 'Size and time limits',
            guide: 'Short form'
        };
        const actual = Object.fromEntries(
            Object.keys(expected).map(page => [page, titleOf(anchorOf(onMenu, page))])
        );
        expect(actual).toEqual(expected);
    });

    it('puts the parent tooltip on the chapter link and none on a group', () => {
        expect(anchorOf(onMenu, 'errors')).toContain('data-type="chapter-link"');
        const group = onMenu.slice(
            onMenu.lastIndexOf('<li', onMenu.indexOf('aria-controls="additional-group-reference"')),
            onMenu.indexOf('<ul', onMenu.indexOf('aria-controls="additional-group-reference"'))
        );
        expect(group).toContain('cdx-additional-group');
        expect(group).not.toContain('title=');
    });

    it('renders no title in the additional chapter without the flag and says why', () => {
        expect(chapterOf(onMenu)).toContain('title="Short form"');
        expect(chapterOf(offMenu)).not.toContain('title=');
        expect(offStdout).toContain(
            'Additional pages: 3 tooltip key(s) ignored, enable includesTooltips'
        );
        expect(onStdout).not.toContain('tooltip key(s) ignored');
    });

    it('changes nothing but the menu links', () => {
        expect(onMenu.replaceAll(/ title="[^"]*"/g, '')).toBe(offMenu);
        const page = `${pages}/errors/e0100.html`;
        const strip = (html: string) => html.replaceAll(/\?v=[0-9a-f]+/g, '');
        expect(strip(read(`${onDist}/${page}`))).toBe(strip(read(`${offDist}/${page}`)));
    });
});
