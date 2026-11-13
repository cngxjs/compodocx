import { describe, expect, it } from 'vitest';
import { applyListDirectives } from '../../../../src/app/engines/markdown-directives';

const LIST = '<ul>\n<li>Chrome</li>\n<li>Firefox</li>\n</ul>\n';

describe('applyListDirectives', () => {
    it('gives the list after an inline directive the inline class', () => {
        expect(applyListDirectives(`<!-- compodocx: inline -->\n${LIST}`)).toBe(
            `<!-- compodocx: inline -->\n<ul class="cdx-list-inline">\n<li>Chrome</li>\n<li>Firefox</li>\n</ul>\n`
        );
    });

    it('leaves an ordered list alone', () => {
        const html = '<!-- compodocx: inline -->\n<ol>\n<li>One</li>\n</ol>\n';
        expect(applyListDirectives(html)).toBe(html);
    });

    it('leaves an unknown directive value alone', () => {
        const html = `<!-- compodocx: grid -->\n${LIST}`;
        expect(applyListDirectives(html)).toBe(html);
    });

    it('leaves a list after a paragraph alone', () => {
        const html = `<!-- compodocx: inline -->\n<p>Intro.</p>\n${LIST}`;
        expect(applyListDirectives(html)).toBe(html);
    });

    it('changes only the first of two consecutive lists', () => {
        const out = applyListDirectives(`<!--compodocx:inline-->\n${LIST}${LIST}`);
        expect(out.match(/cdx-list-inline/g)).toHaveLength(1);
        expect(out.endsWith(LIST)).toBe(true);
    });
});
