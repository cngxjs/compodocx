import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();

/**
 * Declarations a file does not export are not documented: no page, no
 * coverage row and no entry in the JSON export. The todomvc fixture keeps
 * a file-local interface, an enum, a function expression and the consts a
 * decorator reads next to exported declarations.
 */
const FILE_LOCAL = {
    interfaces: ['StringArray'],
    enumerations: ['APP_ENUM'],
    variables: ['extract', 'selector', 'templateUrl', 'pure']
};

const run = (distFolder: string, extra: string[] = []): void => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        './test/fixtures/todomvc-ng2/src/tsconfig.json',
        '-d',
        distFolder,
        ...extra
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

const names = (list: { name: string }[] | undefined): string[] =>
    (list ?? []).map(item => item.name);

describe('CLI file-local declarations', () => {
    describe('HTML output', () => {
        const distFolder = `${tmp.name}-file-local-html`;
        const pages = pagesIn(distFolder);
        let coverageFile: string;

        beforeAll(() => {
            run(distFolder);
            coverageFile = read(`${distFolder}/coverage.html`);
        });
        afterAll(() => tmp.clean(distFolder));

        it('writes no page for a file-local declaration', () => {
            for (const name of FILE_LOCAL.interfaces) {
                expect(() => pages.of('interface', name)).toThrow(/^0 interface pages/);
            }
            expect(() => pages.of('enumeration', 'APP_ENUM')).toThrow(/^0 enumeration pages/);
        });

        it('keeps pages for the exported declarations of the same files', () => {
            expect(pages.of('interface', 'ValueInRes')).toBeTruthy();
            expect(pages.of('typealias', 'ChartChange')).toBeTruthy();
        });

        it('lists no file-local declaration in the coverage report', () => {
            for (const name of [...FILE_LOCAL.interfaces, ...FILE_LOCAL.enumerations]) {
                expect(coverageFile).not.to.contain(`>${name}<`);
            }
            expect(coverageFile).to.contain('>ValueInRes<');
        });
    });

    describe('JSON export', () => {
        const distFolder = `${tmp.name}-file-local-json`;
        let json: any;

        beforeAll(() => {
            run(distFolder, ['-e', 'json']);
            json = JSON.parse(read(`${distFolder}/documentation.json`));
        });
        afterAll(() => tmp.clean(distFolder));

        it('has no entry for a file-local declaration', () => {
            const misc = json.miscellaneous;
            for (const name of FILE_LOCAL.interfaces) {
                expect(names(json.interfaces)).not.toContain(name);
            }
            for (const name of FILE_LOCAL.enumerations) {
                expect(names(misc.enumerations)).not.toContain(name);
            }
            for (const name of FILE_LOCAL.variables) {
                expect(names(misc.variables)).not.toContain(name);
            }
        });

        it('keeps the exported declarations of the same files', () => {
            expect(names(json.interfaces)).toContain('ValueInRes');
            expect(names(json.miscellaneous.typealiases)).toContain('ChartChange');
            expect(names(json.miscellaneous.functions)).toContain('sumFunction');
        });
    });
});
