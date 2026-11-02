import * as fs from 'node:fs';
import * as path from 'node:path';
import { hasStderrError, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const run = (args: string[]): string => {
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        './test/fixtures/sample-files/tsconfig.simple.json',
        ...args
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return ls.stdout.toString();
};

describe('CLI verbose flag', () => {
    const distFolder = `${tmp.name}-verbose`;
    const configFile = path.resolve(`${distFolder}-config.json`);
    let quiet = '';
    let verbose = '';
    let fromConfig = '';

    beforeAll(() => {
        tmp.create(distFolder);
        fs.writeFileSync(configFile, JSON.stringify({ verbose: true }));
        quiet = run(['-d', `${distFolder}/quiet`]);
        verbose = run(['-d', `${distFolder}/verbose`, '--verbose']);
        fromConfig = run(['-d', `${distFolder}/config`, '-c', configFile]);
    });
    afterAll(() => {
        tmp.clean(distFolder);
        fs.rmSync(configFile, { force: true });
    });

    it('prints no found lines without the flag', () => {
        expect(quiet).to.contain('Documentation generated');
        expect(quiet).not.to.contain('found          :');
    });

    it('prints found lines with --verbose', () => {
        expect(verbose).to.contain('found          :');
    });

    it('reads the verbose config key', () => {
        expect(fromConfig).to.contain('found          :');
    });
});
