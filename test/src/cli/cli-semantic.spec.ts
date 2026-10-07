import * as fs from 'node:fs';
import * as path from 'node:path';

import { shell, temporaryDir } from '../helpers';
import { collectionPage } from './paths';

const tmp = temporaryDir();
const TSCONFIG = './test/fixtures/semantic-library/tsconfig.json';
const FILE = 'test/fixtures/semantic-library/projects';

const stripAnsi = (text: string): string => text.replaceAll(/\x1b\[[0-9;]*m/g, '');

describe('CLI semantic analysis', () => {
    const jsonFolder = `${tmp.name}-semantic-json`;
    const htmlFolder = `${tmp.name}-semantic-html`;
    let status: number | null;
    let stdout: string;
    let data: any;

    beforeAll(() => {
        tmp.create(jsonFolder);
        tmp.create(htmlFolder);
        const run = shell('node', [
            './bin/index-cli.js',
            '-p',
            TSCONFIG,
            '-e',
            'json',
            '-d',
            jsonFolder
        ]);
        status = run.status;
        stdout = stripAnsi(run.stdout.toString());
        data = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'documentation.json'), 'utf8'));
        shell('node', [
            './bin/index-cli.js',
            '-p',
            TSCONFIG,
            '--disableSearch',
            '--no-multiVersion',
            '-d',
            htmlFolder
        ]);
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(htmlFolder);
    });

    it('exits 0 and logs the semantic summary', () => {
        expect(status).to.equal(0);
        expect(stdout).to.contain(
            'Semantic analysis: 4 entry points, 4 providers, 2 feature functions, 7+3 use the injection context (1 unresolved), 1 exported symbols reach no entry point'
        );
    });

    it('writes the semantic facts into documentation.json', () => {
        const fn = (name: string) => data.miscellaneous.functions.find((f: any) => f.name === name);
        expect(fn('provideFoo').entryPoint).to.equal('@sem/core');
        expect(fn('provideFoo').di.role).to.equal('provider');
        expect(fn('withMode').di.featureType).to.deep.equal({
            name: 'FooFeature',
            file: `${FILE}/core/src/di/foo.providers.ts`
        });
        expect(fn('orphanFoo').notExported).to.equal(true);
        const token = data.tokens.find((t: any) => t.name === 'FOO_CONFIG');
        expect(token.token.shape).to.equal('interface');
        expect(fn('normalizeLabel').usedBy).to.deep.equal([
            { name: 'formatFoo', file: `${FILE}/core/src/foo/foo.ts` }
        ]);
        expect(data.semantic.summary.providers).to.equal(4);
        expect(data.semantic.entryPoints.map((e: any) => e.importPath)).to.deep.equal([
            '@sem/core',
            '@sem/core/tokens',
            '@sem/testing',
            '@sem/ui'
        ]);
    });

    it('renders no semantic facts into the HTML output', () => {
        const page = fs.readFileSync(
            path.join(htmlFolder, `${collectionPage('function')}`),
            'utf8'
        );
        expect(page).to.contain('provideFoo');
        expect(page).not.to.contain('usesInjectionContext');
        expect(page).not.to.contain('@sem/core/tokens');
    });
});
