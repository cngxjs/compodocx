import * as fs from 'node:fs';
import * as path from 'node:path';
import { relativePrefix } from '../../../src/app/links/layout';
import { shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { featurePage, pagesIn, rootPage } from '../helpers/pages';
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
    const pages = pagesIn(htmlFolder);
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
            'Semantic analysis: 5 entry points, 4 providers, 2 feature functions, 9+3 use the injection context (1 unresolved), 1 exported symbols reach no entry point'
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
        expect(fn('provideFoo')).not.toHaveProperty('factoryKind');
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
            fs.readFileSync(path.join(htmlFolder, pages.cluster('FooFeature')), 'utf8')
        ].join('\n');
        expect(page).to.contain('provideFoo');
        expect(page).not.to.contain('usesInjectionContext');
        expect(page).not.to.contain('exportedBy');
    });

    it('documents providers and features on one page per feature type', () => {
        const exists = (file: string) => fs.existsSync(path.join(htmlFolder, file));
        const clusterFile = pages.cluster('FooFeature');
        expect(exists(clusterFile)).to.equal(true);
        expect(exists(pages.of('provider', 'provideFooLimit'))).to.equal(true);
        for (const moved of ['provideFoo', 'withMode', 'provideFooLimit']) {
            expect(() => pages.of('function', moved), moved).to.throw(/^0 /);
        }
        expect(() => pages.of('variable', 'provideFooAt')).to.throw(/^0 /);
        expect(() => pages.of('interface', 'FooFeature')).to.throw(/^0 /);

        const cluster = fs.readFileSync(path.join(htmlFolder, clusterFile), 'utf8');
        for (const member of ['provideFoo', 'provideFooAt', 'withMode']) {
            expect(cluster).to.contain(`id="FooFeature--${member}"`);
        }
        expect(cluster).to.contain(
            `href="${pages.href('token', 'FOO_CONFIG', pages.depthOf(clusterFile))}"`
        );

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
        const selectFile = featurePage(['core', 'select']);
        const select = fs.readFileSync(path.join(htmlFolder, selectFile), 'utf8');
        expect(select).to.contain("import { ... } from '@sem/core/select';");
        expect(select).to.contain('A single-select built from small parts');
        expect(select).to.contain(
            `href="${pages.href('component', 'SemSelectListbox', pages.depthOf(selectFile))}"`
        );
    });

    it('lists feature members by role and links providers to their feature type page', () => {
        const coreFile = featurePage(['core']);
        const depth = pages.depthOf(coreFile);
        const core = fs.readFileSync(path.join(htmlFolder, coreFile), 'utf8');
        expect(core).to.contain('id="configuration"');
        expect(core).to.contain('id="utilities"');
        expect(core).to.contain(
            `href="${relativePrefix(depth)}${pages.cluster('FooFeature')}#FooFeature--provideFoo"`
        );
        expect(core).to.contain(`href="${pages.href('function', 'formatFoo', depth)}"`);
        expect(core).to.contain(`href="${pages.href('guard', 'fooReadyGuard', depth)}"`);
        const section = (id: string) => {
            const start = core.indexOf(`id="${id}"`);
            const end = core.indexOf('<h2 class="cdx-section-heading"', start + 1);
            return core.slice(start, end < 0 ? undefined : end);
        };
        for (const name of ['injectFoo', 'injectFooLimit', 'injectBar']) {
            expect(section('configuration'), name).to.contain(`>${name}<`);
            expect(section('utilities'), name).not.to.contain(`>${name}<`);
        }
        expect(section('configuration')).to.contain('>injectFooTheme<');
        expect(section('constants')).not.to.contain('>injectFooTheme<');
        for (const name of ['injectViaMethod', 'createThing']) {
            expect(section('utilities'), name).to.contain(`>${name}<`);
            expect(section('configuration'), name).not.to.contain(`>${name}<`);
        }
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
        expect(landing).to.contain(`href="./${pages.cluster('FooFeature')}"`);
        expect(landing).to.contain(`href="${pages.href('provider', 'provideFooLimit', 0)}"`);
        expect(landing).to.contain(`href="${pages.href('token', 'FOO_CONFIG', 0)}"`);
        const menu = menuOf(htmlFolder);
        expect(menu).to.contain('id="dependency-injection-links"');
        expect(menu).not.to.contain('id="tokens-links"');

        const providerFile = pages.of('provider', 'provideFooLimit');
        const provider = fs.readFileSync(path.join(htmlFolder, providerFile), 'utf8');
        // Breadcrumb: entry point > feature, the feature linked to its page.
        expect(provider).to.contain(
            `href="${relativePrefix(pages.depthOf(providerFile))}${featurePage(['core'])}"`
        );
    });

    it('links provider calls in a component providers array', () => {
        const panelFile = pages.of('component', 'SemFooPanel');
        const depth = pages.depthOf(panelFile);
        const cluster = `${relativePrefix(depth)}${pages.cluster('FooFeature')}`;
        const panel = fs.readFileSync(path.join(htmlFolder, panelFile), 'utf8');
        expect(panel).to.contain(
            `<a href="${cluster}#FooFeature--provideFooAt" target="_self" >provideFooAt</a>`
        );
        expect(panel).to.contain(
            `<a href="${cluster}#FooFeature--withMode" target="_self" >withMode</a>`
        );
        expect(panel).to.contain(
            `<a href="${pages.href('provider', 'provideFooLimit', depth)}" target="_self" >provideFooLimit</a>`
        );

        const component = data.components.find((c: any) => c.name === 'SemFooPanel');
        expect(component.providers.map((p: any) => p.call)).to.deep.equal([
            { callee: 'provideFooAt', args: ['withMode'] },
            { callee: 'provideFooLimit', args: [] }
        ]);
    });

    it('gives a symbol that reaches no entry point no page and lists it in the log', () => {
        expect(() => pages.of('function', 'orphanFoo')).to.throw(/^0 /);
        expect(fs.existsSync(path.join(htmlFolder, pages.of('function', 'formatFoo')))).to.equal(
            true
        );
        expect(stdout).to.contain(
            '1 exported symbols reach no entry point and are not documented:'
        );
        expect(stdout).to.match(new RegExp(`${FILE}/core/src/foo/foo-helpers\\.ts:\\d+ orphanFoo`));
        const index = fs.readFileSync(path.join(htmlFolder, 'index.html'), 'utf8');
        expect(index).not.to.contain('orphanFoo');
        expect(menuOf(htmlFolder)).not.to.contain('orphanFoo');
    });
});
