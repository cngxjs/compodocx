import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

describe('CLI Uniq id for file', () => {
    const distFolder = `${tmp.name}-uniqid`;

    let exportFile;
    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/sample-files/tsconfig.simple.json',
            '-e',
            'json',
            '-d',
            distFolder
        ]);

        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        // Entity ids carry a stable SHA-512 hash of the declaring file's
        // source text. The standalone fixture renders no module-scoped
        // menu sublists any more, so the id is asserted on the JSON
        // export entry of the bootstrapped component.
        exportFile = read(`${distFolder}/documentation.json`);
    });
    afterAll(() => tmp.clean(distFolder));

    it('it should contain a uniqid', () => {
        // Hash the file as checked out so CRLF checkouts (Windows) match too.
        const source = fs.readFileSync('./test/fixtures/sample-files/foo.component.ts', 'utf8');
        const expectedHash = crypto.createHash('sha512').update(source).digest('hex');
        expect(expectedHash).to.match(/^[0-9a-f]{128}$/);
        expect(exportFile).to.contain(`"id":"component-FooComponent-${expectedHash}"`);
    });
});
