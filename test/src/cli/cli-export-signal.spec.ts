import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const SIGNAL_API_KINDS = new Set(['input-signal', 'output-signal', 'model']);

/**
 * Components and directives carry no entry flag `signal`; signal members are
 * marked by `signalKind` on the member itself.
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

    const signalMembers = (entry: any): any[] =>
        [entry.inputsClass, entry.outputsClass, entry.propertiesClass].flatMap(list =>
            (list ?? []).filter((member: any) => SIGNAL_API_KINDS.has(member.signalKind))
        );

    it('writes no signal flag on components and directives', () => {
        const flagged = entries.filter(entry => 'signal' in entry).map(entry => entry.name);
        expect(flagged).to.deep.equal([]);
    });

    it('keeps signalKind on input(), output() and model() members', () => {
        const kinds = new Set(entries.flatMap(signalMembers).map(member => member.signalKind));
        expect([...kinds].sort()).to.deep.equal(['input-signal', 'model', 'output-signal']);
    });
});
