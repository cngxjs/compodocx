import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, temporaryDir } from '../helpers';
import { clusterPage, featurePage, pageOf, rootPage } from '../helpers/pages';
import { readKindPages } from './paths';

/** The type layout this suite asserts (the default is the feature layout). */
const TYPE_LAYOUT = path.resolve('test/fixtures/type-layout.compodocxrc.json');

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
            '-c',
            TYPE_LAYOUT,
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
            'Semantic analysis: 5 entry points, 4 providers, 2 feature functions, 8+3 use the injection context (1 unresolved), 1 exported symbols reach no entry point'
        );
    });

    it('logs which detectors decided the features', () => {
        expect(stdout).to.contain(
            'Features: 8 in 5 entry points (config 0, tag 0, cohesion 3, entry point 4, folder 1), 1 family links'
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
            '@sem/core/select',
            '@sem/core/tokens',
            '@sem/testing',
            '@sem/ui'
        ]);
    });

    it('renders no semantic facts into the HTML output', () => {
        const page = [
            readKindPages(htmlFolder, 'function'),
            fs.readFileSync(path.join(htmlFolder, clusterPage('FooFeature')), 'utf8')
        ].join('\n');
        expect(page).to.contain('provideFoo');
        expect(page).not.to.contain('usesInjectionContext');
        expect(page).not.to.contain('exportedBy');
    });

    it('documents providers and features on one page per feature type', () => {
        const exists = (file: string) => fs.existsSync(path.join(htmlFolder, file));
        expect(exists(clusterPage('FooFeature'))).to.equal(true);
        expect(exists(pageOf('provider', 'provideFooLimit'))).to.equal(true);
        for (const moved of ['provideFoo', 'withMode', 'provideFooLimit']) {
            expect(exists(pageOf('function', moved)), moved).to.equal(false);
        }
        expect(exists(pageOf('variable', 'provideFooAt'))).to.equal(false);
        expect(exists(pageOf('interface', 'FooFeature'))).to.equal(false);

        const cluster = fs.readFileSync(path.join(htmlFolder, clusterPage('FooFeature')), 'utf8');
        for (const member of ['provideFoo', 'provideFooAt', 'withMode']) {
            expect(cluster).to.contain(`id="FooFeature--${member}"`);
        }
        expect(cluster).to.contain(`href="../${pageOf('token', 'FOO_CONFIG')}"`);

        const utilities = fs.readFileSync(path.join(htmlFolder, 'utilities.html'), 'utf8');
        expect(utilities).not.to.contain('>provideFoo<');
        expect(utilities).to.contain('>formatFoo<');
    });

    it('writes one page per feature, the glued entry point as one page with its README', () => {
        const exists = (segments: string[]) =>
            fs.existsSync(path.join(htmlFolder, featurePage(segments)));
        for (const segments of [['core', 'select'], ['core'], ['ui', 'foo-panel'], ['env']]) {
            expect(exists(segments), segments.join('/')).to.equal(true);
        }
        expect(exists(['core', 'select', 'shared'])).to.equal(false);
        // di/ and routes/ are role folders: their foo.* files join foo, and the
        // entry point with a single feature is its root feature.
        expect(exists(['core', 'di'])).to.equal(false);
        expect(exists(['core', 'foo'])).to.equal(false);
        const select = fs.readFileSync(
            path.join(htmlFolder, featurePage(['core', 'select'])),
            'utf8'
        );
        expect(select).to.contain("import { ... } from '@sem/core/select';");
        expect(select).to.contain('A single-select built from small parts');
        expect(select).to.contain(`href="../../${pageOf('component', 'SemSelectListbox')}"`);
    });

    it('lists feature members by role and links providers to their feature type page', () => {
        const core = fs.readFileSync(path.join(htmlFolder, featurePage(['core'])), 'utf8');
        expect(core).to.contain('id="configuration"');
        expect(core).to.contain('id="utilities"');
        expect(core).to.contain(`href="../${clusterPage('FooFeature')}#FooFeature--provideFoo"`);
        expect(core).to.contain(`href="../${pageOf('function', 'formatFoo')}"`);
        expect(core).to.contain(`href="../${pageOf('guard', 'fooReadyGuard')}"`);
        const panel = fs.readFileSync(
            path.join(htmlFolder, featurePage(['ui', 'foo-panel'])),
            'utf8'
        );
        expect(panel).to.contain('A panel that configures foo for everything rendered inside it.');
        expect(panel).to.contain('id="components-and-directives"');
    });

    it('adds a Dependency Injection chapter and landing page', () => {
        const landing = fs.readFileSync(
            path.join(htmlFolder, rootPage('dependency-injection')),
            'utf8'
        );
        expect(landing).to.contain(`href="./${clusterPage('FooFeature')}"`);
        expect(landing).to.contain(`href="./${pageOf('provider', 'provideFooLimit')}"`);
        expect(landing).to.contain(`href="./${pageOf('token', 'FOO_CONFIG')}"`);
        expect(landing).to.contain('id="dependency-injection-links"');
        expect(landing).not.to.contain('id="tokens-links"');

        const provider = fs.readFileSync(
            path.join(htmlFolder, pageOf('provider', 'provideFooLimit')),
            'utf8'
        );
        // Breadcrumb: entry point > feature, the feature linked to its page.
        expect(provider).to.contain(`href="../${featurePage(['core'])}"`);
    });

    it('links provider calls in a component providers array', () => {
        const panel = fs.readFileSync(
            path.join(htmlFolder, pageOf('component', 'SemFooPanel')),
            'utf8'
        );
        expect(panel).to.contain(
            `<a href="../${clusterPage('FooFeature')}#FooFeature--provideFooAt" target="_self" >provideFooAt</a>`
        );
        expect(panel).to.contain(
            `<a href="../${clusterPage('FooFeature')}#FooFeature--withMode" target="_self" >withMode</a>`
        );
        expect(panel).to.contain(
            `<a href="../${pageOf('provider', 'provideFooLimit')}" target="_self" >provideFooLimit</a>`
        );

        const component = data.components.find((c: any) => c.name === 'SemFooPanel');
        expect(component.providers.map((p: any) => p.call)).to.deep.equal([
            { callee: 'provideFooAt', args: ['withMode'] },
            { callee: 'provideFooLimit', args: [] }
        ]);
    });

    it('gives a symbol that reaches no entry point no page and lists it in the log', () => {
        expect(fs.existsSync(path.join(htmlFolder, pageOf('function', 'orphanFoo')))).to.equal(
            false
        );
        expect(fs.existsSync(path.join(htmlFolder, pageOf('function', 'formatFoo')))).to.equal(
            true
        );
        expect(stdout).to.contain(
            '1 exported symbols reach no entry point and are not documented:'
        );
        expect(stdout).to.match(new RegExp(`${FILE}/core/src/foo/foo-helpers\\.ts:\\d+ orphanFoo`));
        const index = fs.readFileSync(path.join(htmlFolder, 'index.html'), 'utf8');
        expect(index).not.to.contain('orphanFoo');
    });
});
