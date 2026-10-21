import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI style comments', () => {
    const fixture = `${tmp.name}-style-comments-fixture`;
    const htmlDist = `${tmp.name}-style-comments-html`;
    const jsonDist = `${tmp.name}-style-comments-json`;
    let exported: any;
    let stdout: string;

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
        stdout = run('html', htmlDist);
        run('json', jsonDist);
        exported = JSON.parse(read(`${jsonDist}/documentation.json`));
    });

    afterAll(() => {
        tmp.clean(fixture);
        tmp.clean(htmlDist);
        tmp.clean(jsonDist);
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

    it('prints no style comment notice for a clean fixture', () => {
        expect(stdout).not.toContain('Style comments');
    });
});
