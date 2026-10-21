import { describe, expect, it } from 'vitest';

import { aliasStub, aliasStubFiles } from '../../../../src/app/page-generator/alias-stubs';

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
