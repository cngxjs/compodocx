import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, temporaryDir } from '../helpers';
import { menuOf } from '../helpers/menu';
import { featurePage, pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
// The Angular version comes from the package.json in the working directory.
const FIXTURE = path.resolve('./test/fixtures/ng22-app');
const CLI = path.resolve('./bin/index-cli.js');

const names = (entries: { name: string }[]): string[] => entries.map(entry => entry.name).sort();

describe('CLI Angular 22 application', () => {
    const jsonFolder = path.resolve(`${tmp.name}-ng22-json`);
    const htmlFolder = path.resolve(`${tmp.name}-ng22-html`);
    const pages = pagesIn(htmlFolder);
    const page = (kind: Parameters<typeof pages.of>[0], name: string) =>
        fs.readFileSync(path.join(htmlFolder, pages.of(kind, name)), 'utf8');
    let data: any;
    let status: number | null;
    let htmlStatus: number | null;

    beforeAll(() => {
        tmp.create(jsonFolder);
        const run = shell(
            'node',
            [CLI, '-c', '.compodocxrc.json', '-p', 'tsconfig.json', '-e', 'json', '-d', jsonFolder],
            { cwd: FIXTURE }
        );
        status = run.status;
        data = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'documentation.json'), 'utf8'));
        tmp.create(htmlFolder);
        htmlStatus = shell(
            'node',
            [
                CLI,
                '-c',
                '.compodocxrc.json',
                '-p',
                'tsconfig.json',
                '--disableSearch',
                '--no-multiVersion',
                '-d',
                htmlFolder
            ],
            { cwd: FIXTURE }
        ).status;
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
        tmp.clean(htmlFolder);
    });

    it('exits 0', () => {
        expect(status).to.equal(0);
        expect(htmlStatus).to.equal(0);
    });

    it('gives each Angular service a service page with the Service badge', () => {
        for (const name of [
            'AuditService',
            'Logger',
            'ReportEngine',
            'ReportLoader',
            'SessionService'
        ]) {
            expect(page('service', name)).to.contain('cdx-badge--entity-service">Service<');
        }
    });

    it('shows the Service decorator options', () => {
        expect(page('service', 'Logger')).to.match(
            /Factory<\/dt><dd[^>]*><code>\(\) =(>|&gt;) new ConsoleLogger\(\)/
        );
        expect(page('service', 'AuditService')).to.contain('autoProvided: false');
    });

    it('keeps a class with a project decorator called Service a class page', () => {
        expect(page('class', 'Registry')).to.contain('cdx-badge--entity-class');
    });

    it('lists services in the services section of their feature page', () => {
        const feature = fs.readFileSync(path.join(htmlFolder, featurePage(['reports'])), 'utf8');
        expect(feature).to.contain('id="services"');
        expect(feature).to.contain('ReportLoader');
    });

    it('documents the components, the guard, the token and the routes', () => {
        expect(names(data.components)).to.deep.equal([
            'AppComponent',
            'AuditPanelComponent',
            'DashboardComponent',
            'ReportsComponent'
        ]);
        expect(names(data.guards)).to.deep.equal(['signedInGuard']);
        expect(names(data.tokens)).to.deep.equal(['NOTIFICATIONS_CONFIG']);
        expect(data.routes).to.have.length(1);
    });

    it('exports the Angular services with their options', () => {
        expect(names(data.services)).to.deep.equal([
            'AuditService',
            'Logger',
            'ReportEngine',
            'ReportLoader',
            'SessionService'
        ]);
        const byName = (name: string) => data.services.find((s: any) => s.name === name);
        expect(byName('AuditService').autoProvided).to.equal(false);
        expect(byName('Logger').factory).to.equal('() => new ConsoleLogger()');
        expect(byName('SessionService')).not.to.have.property('autoProvided');
        expect(names(data.classes)).to.deep.equal(['ConsoleLogger', 'Registry']);
    });

    it('gives httpResource and injectAsync members their kind', () => {
        const member = (service: string, name: string) =>
            data.services
                .find((s: any) => s.name === service)
                .properties.find((p: any) => p.name === name);
        expect(member('SessionService', 'profile').signalKind).to.equal('http-resource');
        expect(member('SessionService', 'profile').type).to.equal('Profile');
        expect(member('ReportLoader', 'engine').signalKind).to.equal('inject-async');
        expect(page('service', 'SessionService')).to.contain('cdx-badge--http-resource');
        expect(page('service', 'ReportLoader')).to.contain('cdx-badge--inject-async');
    });

    it('follows injectAsync to the service it loads', () => {
        const byName = (name: string) => data.services.find((s: any) => s.name === name);
        expect(byName('ReportLoader').di.readsTokens).to.deep.equal([
            { name: 'ReportEngine', file: 'src/app/reports/report-engine.ts' }
        ]);
        expect(names(byName('ReportEngine').usedBy)).to.deep.equal(['ReportLoader']);
        const engine = byName('ReportLoader').properties.find((p: any) => p.name === 'engine');
        expect(engine.type).to.equal('ReportEngine');
        expect(page('service', 'ReportEngine')).to.match(/id="used-by"[\s\S]*ReportLoader/);
        const dependencies = page('service', 'ReportLoader').split(
            'data-compodoc="block-dependencies"'
        )[1];
        expect(dependencies).to.contain('cdx-badge--inject-async');
        expect(dependencies).to.contain('ReportEngine');
    });

    it('gives providers the kind of the symbol they name', () => {
        const panel = data.components.find((c: any) => c.name === 'AuditPanelComponent');
        expect(panel.providers.map((p: any) => [p.name, p.type])).to.deep.equal([
            ['AuditService', 'service'],
            ['Logger', 'service']
        ]);
    });

    it('notes the OnPush default only where changeDetection is not set', () => {
        expect(page('component', 'AppComponent')).to.contain('OnPush (default)');
        expect(page('component', 'DashboardComponent')).not.to.contain('OnPush (default)');
        expect(page('component', 'DashboardComponent')).to.contain(
            'ChangeDetectionStrategy.Default'
        );
    });

    it('keeps the Injectable class an injectable', () => {
        expect(names(data.injectables)).to.deep.equal(['PreferencesStore']);
    });
});

describe('CLI Angular 22 application, type layout', () => {
    const htmlFolder = path.resolve(`${tmp.name}-ng22-type`);
    let menu: string;

    beforeAll(() => {
        tmp.create(htmlFolder);
        shell(
            'node',
            [
                CLI,
                '-c',
                path.resolve('test/fixtures/type-layout.compodocxrc.json'),
                '-p',
                'tsconfig.json',
                '--disableSearch',
                '--no-multiVersion',
                '--toggleMenuItems',
                'services',
                '-d',
                htmlFolder
            ],
            { cwd: FIXTURE }
        );
        menu = menuOf(htmlFolder);
    });
    afterAll(() => {
        tmp.clean(htmlFolder);
    });

    it('lists services in their own chapter that the services key opens', () => {
        expect(menu).to.contain('data-cdx-target="#services-links" aria-expanded="true"');
        expect(menu).to.contain('data-cdx-target="#injectables-links" aria-expanded="false"');
        expect(menu).to.contain('SessionService');
    });
});
