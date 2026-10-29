import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const SIGNAL_API_KINDS = new Set(['input-signal', 'output-signal', 'model']);

/**
 * The deprecated entry flag `signal` of components and directives is true
 * exactly when the entry has an `input()`, `output()` or `model()` member
 * (the fixture uses no class tag `@signal`).
 */
describe('CLI export: entry signal flag', () => {
    const distFolder = `${tmp.name}-export-signal`;
    let entries: any[];

    beforeAll(() => {
        tmp.create(distFolder);
        const ls = shell('node', [
            './bin/index-cli.js',
            '--no-multiVersion',
            '-p',
            './test/fixtures/kitchen-sink-standalone/tsconfig.json',
            '-d',
            distFolder,
            '-e',
            'json'
        ]);
        if (hasStderrError(ls.stderr.toString())) {
            console.error(`shell error: ${ls.stderr.toString()}`);
            throw new Error('error');
        }
        const data = JSON.parse(read(`${distFolder}/documentation.json`, 'utf8'));
        entries = [...(data.components ?? []), ...(data.directives ?? [])];
    });
    afterAll(() => tmp.clean(distFolder));

    const hasSignalMember = (entry: any): boolean =>
        [entry.inputsClass, entry.outputsClass, entry.propertiesClass].some(list =>
            (list ?? []).some((member: any) => SIGNAL_API_KINDS.has(member.signalKind))
        );

    it('sets the flag exactly on entries with signal members', () => {
        const mismatched = entries
            .filter(entry => entry.signal !== hasSignalMember(entry))
            .map(entry => entry.name);
        expect(mismatched).to.deep.equal([]);
    });

    it('has entries on both sides', () => {
        expect(entries.some(entry => entry.signal === true)).to.be.true;
        expect(entries.some(entry => entry.signal === false)).to.be.true;
    });
});
