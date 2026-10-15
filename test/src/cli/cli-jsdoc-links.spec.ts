import type { ExportData } from '../../../src/app/interfaces/export-data.interface';
import { hasStderrError, read, shell, temporaryDir } from '../helpers';
import { pagesIn } from '../helpers/pages';

const tmp = temporaryDir();
const JL = './test/fixtures/jsdoc-links';

const run = (args: string[]): void => {
    const ls = shell('node', ['./bin/index-cli.js', '-p', `${JL}/tsconfig.json`, ...args]);
    if (ls.status !== 0 || hasStderrError(ls.stderr.toString())) {
        console.error(`shell error (${ls.status ?? ls.signal}): ${ls.stderr.toString()}`);
        throw new Error('error');
    }
};

describe('CLI links in JSDoc tag comments', () => {
    describe('JSON export', () => {
        const out = `${tmp.name}-jsdoc-links-json`;
        let data: ExportData;

        beforeAll(() => {
            tmp.create(out);
            run(['-e', 'json', '--no-multiVersion', '-d', out]);
            data = JSON.parse(read(`${out}/documentation.json`));
        });
        afterAll(() => tmp.clean(out));

        const card = () => data.components.find(c => c.name === 'CardComponent');
        const named = () => data.classes.find(c => c.name === 'Named');

        it('keeps the link of a slot description', () => {
            expect(card()?.slots).toEqual([
                { name: 'header', description: 'the {@link Foo} header' }
            ]);
        });

        it('keeps the link text of a single-line tag', () => {
            expect(card()?.since).toBe('{@link Foo} 1.0');
        });

        it('reads the target of a linked @relatedTo', () => {
            expect(card()?.relatedTo).toEqual(['Foo']);
        });

        it('keeps the label of a labelled link in place in tag comments', () => {
            const fn = data.miscellaneous.functions.find(f => f.name === 'labelled');
            const comments = (fn?.jsdoctags ?? []).map(t => String(t.comment));
            for (const label of ['pipe foo', 'space foo', 'bracket foo', 'returned foo']) {
                const comment = comments.find(c => c.includes(label));
                expect(comment).toMatch(new RegExp(`the .*${label}.* ?(value)?`));
                expect(comment).not.toContain(`|${label}`);
                expect(comment).not.toContain(`${label}{@link`);
            }
            expect(comments.find(c => c.includes('Angular'))).not.toContain('://angular.dev|');
        });

        it('stores a linked constructor @param of a parameter property as text', () => {
            const name = named()?.properties?.find(p => p.name === 'name');
            expect(typeof name?.description).toBe('string');
            expect(name?.description).toBe('the {@link Foo} name');
        });
    });

    describe('HTML output', () => {
        const out = `${tmp.name}-jsdoc-links-html`;
        const pages = pagesIn(out);

        beforeAll(() => {
            tmp.create(out);
            run(['--disableSearch', '--no-multiVersion', '-d', out]);
        });
        afterAll(() => tmp.clean(out));

        const page = (name: string, kind: 'component' | 'class' = 'component') => {
            const path = pages.of(kind, name);
            return { html: read(`${out}/${path}`), depth: pages.depthOf(path) };
        };

        it('renders the link of a slot description', () => {
            const { html, depth } = page('CardComponent');
            const foo = pages.href('class', 'Foo', depth);
            expect(html).toContain(`<dd>the <a href="${foo}">Foo</a> header</dd>`);
        });

        it('links a @relatedTo target given as a link', () => {
            const { html, depth } = page('CardComponent');
            const related = html.slice(html.indexOf('id="related"'));
            expect(related).toContain(`href="${pages.href('class', 'Foo', depth)}"`);
        });

        it('builds the page of a class whose constructor @param holds a link', () => {
            expect(page('Named', 'class').html).toContain('Named');
        });
    });
});
