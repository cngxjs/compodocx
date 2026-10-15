import type { ExportData } from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
const FIXTURE = './test/fixtures/public-api-barrels';

const documented = (out: string, project: string, publicApi: string): ExportData => {
    tmp.create(out);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        `${FIXTURE}/${project}/tsconfig.json`,
        '-e',
        'json',
        '-d',
        out,
        '--publicApiOnly',
        publicApi
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return JSON.parse(read(`${out}/documentation.json`)) as ExportData;
};

const functionNames = (data: ExportData): string[] =>
    (data.miscellaneous?.functions ?? []).map(item => item.name).sort();

describe('CLI public-api-only option with barrel re-exports', () => {
    describe('index.d.ts declarations', () => {
        const out = `${tmp.name}-public-api-barrels-dts`;
        let data: ExportData;

        beforeAll(() => {
            data = documented(out, 'declarations', `${FIXTURE}/declarations/types`);
        });
        afterAll(() => tmp.clean(out));

        it('keeps named re-exports, `export *`, nested barrels and imported re-exports', () => {
            expect(functionNames(data)).toEqual(
                expect.arrayContaining(['deep', 'localFn', 'pub', 'starFn', 'zed'])
            );
            expect(data.miscellaneous?.variables?.map(item => item.name)).toEqual(['PUB_CONST']);
            expect(data.miscellaneous?.enumerations?.map(item => item.name)).toEqual(['StarEnum']);
            expect(data.miscellaneous?.typealiases?.map(item => item.name)).toEqual(['DeepType']);
        });

        it('drops a symbol that no barrel re-exports', () => {
            expect(functionNames(data)).not.toContain('hiddenFn');
        });
    });

    describe('*.api.md report', () => {
        const out = `${tmp.name}-public-api-barrels-api-md`;
        let data: ExportData;

        beforeAll(() => {
            data = documented(out, 'api-report', `${FIXTURE}/api-report`);
        });
        afterAll(() => tmp.clean(out));

        it('keeps names whose first text match is the barrel', () => {
            expect(functionNames(data)).toEqual(['deep', 'localFn', 'pub', 'starFn', 'zed']);
            expect(data.miscellaneous?.enumerations?.map(item => item.name)).toEqual(['StarEnum']);
            expect(data.miscellaneous?.typealiases?.map(item => item.name)).toEqual(['DeepType']);
        });

        it('does not follow an alias listed in the report', () => {
            expect(functionNames(data)).not.toContain('orig');
        });

        it('drops a symbol the report does not list', () => {
            expect(functionNames(data)).not.toContain('hiddenFn');
        });
    });
});
