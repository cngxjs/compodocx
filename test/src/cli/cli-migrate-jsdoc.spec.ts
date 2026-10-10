import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { shell } from '../helpers';

const FIXTURE = path.resolve('test/fixtures/semantic-library');

describe('CLI migrate jsdoc', () => {
    let copy: string;

    beforeAll(() => {
        copy = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-migrate-jsdoc-'));
        fs.cpSync(path.join(FIXTURE, 'projects'), path.join(copy, 'projects'), { recursive: true });
    });

    afterAll(() => {
        fs.rmSync(copy, { recursive: true, force: true });
    });

    it('reports the tags on a dry run and writes nothing', () => {
        const file = path.join(copy, 'projects/core/select/src/trigger/trigger.ts');
        const before = fs.readFileSync(file, 'utf8');
        const run = shell('node', ['./bin/index-cli.js', 'migrate', 'jsdoc', copy, '--dry-run']);
        const stdout = run.stdout.toString();
        expect(run.status).to.equal(0);
        expect(stdout).to.contain('2 @category / @docsKind tags removed in 2 of');
        expect(stdout).to.contain('(dry-run, not written)');
        expect(fs.readFileSync(file, 'utf8')).to.equal(before);
    });
});
