import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, temporaryDir } from '../helpers';
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
            'DashboardComponent',
            'ReportsComponent'
        ]);
        expect(names(data.guards)).to.deep.equal(['signedInGuard']);
        expect(names(data.tokens)).to.deep.equal(['NOTIFICATIONS_CONFIG']);
        expect(data.routes).to.have.length(1);
    });

    it('keeps the Injectable class an injectable', () => {
        expect(names(data.injectables)).to.deep.equal(['PreferencesStore']);
    });
});
