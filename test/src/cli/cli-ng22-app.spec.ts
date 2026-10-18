import * as fs from 'node:fs';
import * as path from 'node:path';
import { shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();
// The Angular version comes from the package.json in the working directory.
const FIXTURE = path.resolve('./test/fixtures/ng22-app');
const CLI = path.resolve('./bin/index-cli.js');

const names = (entries: { name: string }[]): string[] => entries.map(entry => entry.name).sort();

describe('CLI Angular 22 application', () => {
    const jsonFolder = path.resolve(`${tmp.name}-ng22-json`);
    let data: any;
    let status: number | null;

    beforeAll(() => {
        tmp.create(jsonFolder);
        const run = shell(
            'node',
            [CLI, '-c', '.compodocxrc.json', '-p', 'tsconfig.json', '-e', 'json', '-d', jsonFolder],
            { cwd: FIXTURE }
        );
        status = run.status;
        data = JSON.parse(fs.readFileSync(path.join(jsonFolder, 'documentation.json'), 'utf8'));
    });
    afterAll(() => {
        tmp.clean(jsonFolder);
    });

    it('exits 0', () => {
        expect(status).to.equal(0);
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
