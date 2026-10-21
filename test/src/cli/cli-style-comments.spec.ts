import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI style comments', () => {
    const fixture = `${tmp.name}-style-comments-fixture`;
    const htmlDist = `${tmp.name}-style-comments-html`;
    const jsonDist = `${tmp.name}-style-comments-json`;
    const llmDist = `${tmp.name}-style-comments-llm`;
    let exported: any;
    let stdout: string;
    let status: number | null;
    let markdown: string;

    const run = (format: string, dist: string) => {
        const ls = shell('node', [
            './bin/index-cli.js',
            '-c',
            path.join(fixture, '.compodocxrc.json'),
            '-p',
            path.join(fixture, 'tsconfig.json'),
            '-e',
            format,
            '-d',
            dist,
            ...(format === 'html' ? ['--no-multiVersion', '--disableSearch'] : [])
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        status = ls.status;
        return ls.stdout.toString();
    };

    const componentPage = (): string => {
        const found = fs
            .readdirSync(htmlDist, { recursive: true, encoding: 'utf8' })
            .find(file => /TkChip\.html$/.test(file));
        return read(path.join(htmlDist, found ?? 'missing'));
    };

    beforeAll(() => {
        fs.cpSync(path.resolve('test/fixtures/style-comments'), fixture, { recursive: true });
        tmp.create(htmlDist);
        tmp.create(jsonDist);
        tmp.create(llmDist);
        stdout = run('html', htmlDist);
        run('json', jsonDist);
        run('llm-md', llmDist);
        markdown = read(`${llmDist}/llm-context.md`);
        exported = JSON.parse(read(`${jsonDist}/documentation.json`));
    });

    afterAll(() => {
        tmp.clean(fixture);
        tmp.clean(htmlDist);
        tmp.clean(jsonDist);
        tmp.clean(llmDist);
    });

    it('renders a token documented in two sheets once on the component page', () => {
        const html = componentPage();
        expect(html.match(/id="theme-tk-chip-bg"/g)).toHaveLength(1);
    });

    it('takes the group from the theme sheet and the description from the base sheet', () => {
        const html = componentPage();
        expect(html).toContain('Surface');
        expect(html).toContain('Background of the chip.');
    });

    it('exports one merged token that keeps the registered property', () => {
        const chip = exported.components.find((c: any) => c.name === 'TkChip');
        const tokens = chip.themeTokens.filter((t: any) => t.name === '--tk-chip-bg');
        expect(tokens).toHaveLength(1);
        expect(tokens[0].kind).toBe('css-at-property');
        expect(tokens[0].group).toBe('Surface');
        expect(tokens[0].description).toBe('Background of the chip.');
    });

    it('shows a hook with its badge and the default of a fallback chain', () => {
        const html = componentPage();
        expect(html).toContain('id="theme-tk-chip-fg"');
        expect(html).toContain('cdx-io-member--theming-css-hook');
        expect(html).toContain('cdx-badge--hook');
        expect(html).toContain('var(--tk-accent)');
    });

    it('shows the hooks of the overview block of a themes file on the component', () => {
        const html = componentPage();
        expect(html).toContain('id="theme-tk-chip-radius"');
        expect(html).toContain('Corner radius of the chip.');
    });

    it('keeps the declaration when the sheet of a hook also declares it, and says so once', () => {
        const html = componentPage();
        const gap = html.match(
            /class="cdx-io-member cdx-io-member--theming cdx-io-member--theming-([\w-]+)" id="theme-tk-chip-gap"/
        );
        expect(gap?.[1]).toBe('css-custom-property');
        expect(stdout).toMatch(
            /Style comments: 1 hook token also declared in its sheet, declaration kept\n\s+\S*tk-chip-hooks\.css:11 --tk-chip-gap/
        );
        expect(stdout.match(/hook token also declared/g)).toHaveLength(1);
    });

    it('exports the hooks with their kind and lists them in llm-md', () => {
        const chip = exported.components.find((c: any) => c.name === 'TkChip');
        const kinds = Object.fromEntries(chip.themeTokens.map((t: any) => [t.name, t.kind]));
        expect(kinds['--tk-chip-fg']).toBe('css-hook');
        expect(kinds['--tk-chip-radius']).toBe('css-hook');
        expect(kinds['--tk-chip-gap']).toBe('css-custom-property');
        expect(exported.styleFiles[0].tokens.map((t: any) => t.name)).toContain('--tk-chip-radius');
        expect(markdown).toContain('--tk-chip-fg: <color> = var(--tk-accent)');
    });

    it('says which doc block attaches to nothing, and leaves prose and private mixins alone', () => {
        expect(stdout).toMatch(
            /Style comments: 1 doc block not attached\n\s+\S*tk-chip\.theme\.css:11\n/
        );
        expect(stdout).not.toContain('_tk-chip-helpers.scss:1\n');
        expect(stdout.indexOf('doc block not attached')).toBeLessThan(
            stdout.indexOf('hook token also declared')
        );
    });

    it('finishes with exit code 0 although it printed a notice', () => {
        expect(status).toBe(0);
    });
});
