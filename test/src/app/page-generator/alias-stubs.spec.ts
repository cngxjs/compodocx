import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    aliasStub,
    aliasStubFiles,
    isAliasStub,
    staleAliasStubs
} from '../../../../src/app/page-generator/alias-stubs';
import { pruneAliasStubs } from '../../../../src/app/page-generator/asset-copier';

const FOLDER = 'additional-documentation';
const stubAt = (from: string, to: string, title: string): string =>
    aliasStub(to, from.split('/').length - 1, title);

describe('aliasStub', () => {
    it('points to the target relative to the stub at depth 1 and depth 2', () => {
        const target = 'additional-documentation/guide.html';
        const depth1 = aliasStub(target, 1, 'Guide');
        const depth2 = aliasStub(target, 2, 'Guide');
        expect(depth1).toContain(
            '<link rel="canonical" href="../additional-documentation/guide.html">'
        );
        expect(depth1).toContain(
            '<meta http-equiv="refresh" content="0; url=../additional-documentation/guide.html">'
        );
        expect(depth1).toContain(
            '<body><a href="../additional-documentation/guide.html">Guide</a></body>'
        );
        expect(depth2).toContain(
            '<link rel="canonical" href="../../additional-documentation/guide.html">'
        );
        expect(depth1).toContain('<meta name="robots" content="noindex">');
    });

    it('escapes the title in the title element and the link text', () => {
        const html = aliasStub('a.html', 1, 'Signals & <b>"Reactivity"</b>');
        expect(html).not.toContain('<b>');
        const escaped = 'Signals &amp; &lt;b>&#34;Reactivity&#34;&lt;/b>';
        expect(html).toContain(`<title>${escaped}</title>`);
        expect(html).toContain(`>${escaped}</a></body>`);
    });
});

describe('aliasStubFiles', () => {
    it('derives the stub depth from the alias path', () => {
        const [file] = aliasStubFiles([
            {
                from: 'additional-documentation/guides/old.html',
                to: 'additional-documentation/new.html',
                title: 'New'
            }
        ]);
        expect(file.file).toBe('additional-documentation/guides/old.html');
        expect(file.content).toContain('href="../../additional-documentation/new.html"');
    });
});

describe('isAliasStub', () => {
    const from = `${FOLDER}/errors/old.html`;
    const to = `${FOLDER}/errors/new.html`;

    it('recognises the stub written for the redirect', () => {
        expect(isAliasStub(stubAt(from, to, 'New'), from, to)).toBe(true);
    });

    it('recognises a stub whose title needs escaping', () => {
        const title = `Signals & <b>"Reactivity" it's</b> > all`;
        expect(isAliasStub(stubAt(from, to, title), from, to)).toBe(true);
    });

    it('rejects other content, an extra space and another target or depth', () => {
        const stub = stubAt(from, to, 'New');
        expect(isAliasStub('<!doctype html>\n<p>Mine</p>\n', from, to)).toBe(false);
        expect(isAliasStub(stub.replace('<body>', '<body> '), from, to)).toBe(false);
        expect(isAliasStub(`${stub}<!-- edited -->\n`, from, to)).toBe(false);
        expect(isAliasStub(stub, from, `${FOLDER}/other.html`)).toBe(false);
        expect(isAliasStub(stub, `${FOLDER}/old.html`, to)).toBe(false);
    });
});

describe('staleAliasStubs', () => {
    const current = [{ from: `${FOLDER}/kept.html`, to: `${FOLDER}/a.html`, title: 'A' }];

    it('lists recorded aliases below the folder that are gone', () => {
        const previous = {
            [`${FOLDER}/kept.html`]: `${FOLDER}/a.html`,
            [`${FOLDER}/errors/gone.html`]: `${FOLDER}/b.html`
        };
        expect(staleAliasStubs(previous, current, FOLDER)).toEqual([
            { from: `${FOLDER}/errors/gone.html`, to: `${FOLDER}/b.html` }
        ]);
    });

    it('skips keys outside the folder, unsafe segments and non-html keys', () => {
        const previous = {
            'components/Old.html': 'components/New.html',
            [`${FOLDER}-x/a.html`]: `${FOLDER}/a.html`,
            [`${FOLDER}/../index.html`]: `${FOLDER}/a.html`,
            [`${FOLDER}/./a.html`]: `${FOLDER}/a.html`,
            [`${FOLDER}//a.html`]: `${FOLDER}/a.html`,
            [`${FOLDER}/a.md`]: `${FOLDER}/a.html`,
            [`${FOLDER}/errors`]: `${FOLDER}/a.html`
        };
        expect(staleAliasStubs(previous, current, FOLDER)).toEqual([]);
    });
});

describe('pruneAliasStubs', () => {
    let output: string;

    const write = (file: string, content: string): void => {
        const target = path.join(output, ...file.split('/'));
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
    };
    const read = (file: string): string | undefined => {
        const target = path.join(output, ...file.split('/'));
        return fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined;
    };
    const record = (redirects: Record<string, string>, schemaVersion = 1): void =>
        write('redirects.json', JSON.stringify({ schemaVersion, redirects }));

    beforeEach(() => {
        output = fs.mkdtempSync(path.join(os.tmpdir(), 'cdx-alias-stubs-'));
    });

    afterEach(() => {
        fs.rmSync(output, { recursive: true, force: true });
    });

    it('removes a stale stub and keeps current stubs, pages and hand-written files', () => {
        const target = `${FOLDER}/a.html`;
        const stale = `${FOLDER}/errors/stale.html`;
        const current = `${FOLDER}/current.html`;
        const page = `${FOLDER}/now-a-page.html`;
        const mine = `${FOLDER}/mine.html`;
        const outside = 'components/Old.html';
        record({
            [stale]: target,
            [current]: target,
            [page]: target,
            [mine]: target,
            [outside]: 'components/New.html',
            [`${FOLDER}/missing.html`]: target
        });
        write(stale, stubAt(stale, target, 'A'));
        write(current, stubAt(current, target, 'A'));
        write(page, '<!doctype html>\n<title>Now a page</title>\n');
        write(mine, `${stubAt(mine, target, 'A')}<!-- mine -->\n`);
        write(outside, stubAt(outside, 'components/New.html', 'New'));

        const removed = pruneAliasStubs(output, FOLDER, [
            { from: current, to: target, title: 'A' }
        ]);

        expect(removed).toEqual([stale]);
        expect(read(stale)).toBeUndefined();
        expect(fs.existsSync(path.join(output, FOLDER, 'errors'))).toBe(true);
        expect(read(current)).toBe(stubAt(current, target, 'A'));
        expect(read(page)).toContain('Now a page');
        expect(read(mine)).toContain('<!-- mine -->');
        expect(read(outside)).toBeDefined();
    });

    it('removes nothing without a readable redirects.json of schema 1', () => {
        const stale = `${FOLDER}/stale.html`;
        const target = `${FOLDER}/a.html`;
        write(stale, stubAt(stale, target, 'A'));

        expect(pruneAliasStubs(output, FOLDER, [])).toEqual([]);
        write('redirects.json', '{ not json');
        expect(pruneAliasStubs(output, FOLDER, [])).toEqual([]);
        record({ [stale]: target }, 2);
        expect(pruneAliasStubs(output, FOLDER, [])).toEqual([]);
        expect(read(stale)).toBeDefined();
    });
});
