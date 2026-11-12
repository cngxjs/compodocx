import { hasStderrError, read, shell, temporaryDir } from '../helpers';

const tmp = temporaryDir();

const TSCONFIG = './test/fixtures/jsdoc-fences/tsconfig.json';

type Entry = Record<string, any>;

/** Every documented entry of the JSON export by name (coverage rows left out). */
const entriesByName = (data: Entry): Map<string, Entry> => {
    const found = new Map<string, Entry>();
    const walk = (value: unknown): void => {
        if (Array.isArray(value)) {
            value.forEach(walk);
            return;
        }
        if (value && typeof value === 'object') {
            const entry = value as Entry;
            if (typeof entry.name === 'string' && 'description' in entry) {
                found.set(entry.name, entry);
            }
            Object.values(entry).forEach(walk);
        }
    };
    const { coverage: _coverage, ...rest } = data;
    walk(rest);
    return found;
};

const exportJson = (distFolder: string, ...flags: string[]): Map<string, Entry> => {
    tmp.create(distFolder);
    const ls = shell('node', [
        './bin/index-cli.js',
        '--no-multiVersion',
        '-p',
        TSCONFIG,
        '-d',
        distFolder,
        '-e',
        'json',
        ...flags
    ]);
    if (hasStderrError(ls.stderr.toString())) {
        console.error(`shell error: ${ls.stderr.toString()}`);
        throw new Error('error');
    }
    return entriesByName(JSON.parse(read(`${distFolder}/documentation.json`, 'utf8')));
};

const tagNames = (entry: Entry | undefined): string[] =>
    (entry?.jsdoctags ?? []).map((tag: Entry) => tag.tagName.text);

/** `@` lines inside fenced code blocks of a JSDoc comment are code, not tags. */
describe('CLI JSDoc: tags inside code fences', () => {
    const distFolder = `${tmp.name}-jsdoc-fences`;
    let entries: Map<string, Entry>;

    beforeAll(() => {
        entries = exportJson(distFolder);
    });
    afterAll(() => tmp.clean(distFolder));

    it('keeps a fenced @Component example in a function description', () => {
        const fn = entries.get('makeConfig');
        expect(tagNames(fn)).to.deep.equal([]);
        expect(fn?.description).to.include('@Component({');
        expect(fn?.description).to.include('export class AppRoot {}');
        expect(fn?.description).to.include('Done after the block.');
        expect(fn?.description).not.to.include('<div class="cdx-code-snippet"></div>');
    });

    it('lists only the real tag next to fenced control flow', () => {
        const row = entries.get('RowNode');
        expect(tagNames(row)).to.deep.equal(['since']);
        expect(row?.description).to.include('} @else {');
    });

    it('keeps a fenced @for inside an @example', () => {
        const list = entries.get('ListExample');
        expect(tagNames(list)).to.deep.equal(['example', 'since']);
        expect(list?.description).to.include('@for (item of items; track item) {');
        expect(list?.description).to.include('{{ item }}');
    });

    it('reads tilde fences and leaves a one-line fence as text', () => {
        const tilde = entries.get('TildeNode');
        expect(tagNames(tilde)).to.deep.equal(['since']);
        expect(tilde?.description).to.include("@case ('a')");
        expect(tilde?.description).to.include('<code>@ignored</code>');
    });

    it('keeps the real tags around a block left open', () => {
        const unclosed = entries.get('UnclosedBlock');
        expect(tagNames(unclosed)).to.deep.equal(['deprecated']);
        expect(unclosed?.deprecated).to.equal(true);
        expect(tagNames(entries.get('ClosedBlock'))).to.deep.equal(['since']);
    });

    it('does not read a fenced @internal line in the semantic stage', () => {
        expect(entries.get('FencedInternal')?.notExported).to.equal(true);
        expect(entries.get('RealInternal')?.notExported).to.equal(undefined);
    });
});

describe('CLI JSDoc: fenced @internal with --disableInternal', () => {
    const distFolder = `${tmp.name}-jsdoc-fences-internal`;
    let entries: Map<string, Entry>;

    beforeAll(() => {
        entries = exportJson(distFolder, '--disableInternal');
    });
    afterAll(() => tmp.clean(distFolder));

    it('keeps the symbol whose example shows @internal', () => {
        expect(entries.has('VisibleHelper')).to.equal(true);
        expect(entries.has('HiddenHelper')).to.equal(false);
    });
});
