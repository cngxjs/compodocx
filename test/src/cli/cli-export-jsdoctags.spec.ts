import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const TAG_KEYS = new Set([
    'tagName',
    'comment',
    'name',
    'type',
    'defaultValue',
    'optional',
    'deprecated',
    'deprecationMessage',
    'dotDotDotToken',
    'function'
]);

/** `jsdoctags` entries of the JSON export are plain tag objects, without TypeScript node fields. */
describe('CLI export: jsdoctags', () => {
    const distFolder = `${tmp.name}-export-jsdoctags`;
    let tags: any[];
    let data: any;

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
        const raw = read(`${distFolder}/documentation.json`, 'utf8');
        tags = [];
        data = JSON.parse(raw, (key, value) => {
            if (key === 'jsdoctags' && Array.isArray(value)) {
                tags.push(...value);
            }
            return value;
        });
    });
    afterAll(() => tmp.clean(distFolder));

    it('writes only the tag fields', () => {
        expect(tags.length).to.be.greaterThan(0);
        const extra = tags.flatMap(tag => Object.keys(tag).filter(key => !TAG_KEYS.has(key)));
        expect([...new Set(extra)]).to.deep.equal([]);
    });

    it('writes tagName as { text } and name as a string', () => {
        const badTagNames = tags.filter(
            tag =>
                typeof tag.tagName?.text !== 'string' || Object.keys(tag.tagName).join() !== 'text'
        );
        const badNames = tags.filter(tag => 'name' in tag && typeof tag.name !== 'string');
        expect(badTagNames.length).to.equal(0);
        expect(badNames.length).to.equal(0);
    });

    it('is schema 7 without the entry signal flag', () => {
        expect(data.schemaVersion).to.equal(7);
        const entries = [...(data.components ?? []), ...(data.directives ?? [])];
        expect(entries.length).to.be.greaterThan(0);
        expect(entries.filter(entry => 'signal' in entry).map(entry => entry.name)).to.deep.equal(
            []
        );
    });
});
