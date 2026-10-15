import { describe, expect, it } from 'vitest';
import { escapeHtmlText } from '../../../../src/templates/helpers/escape';

describe('escapeHtmlText', () => {
    it.each([
        ['&', '&amp;'],
        ['<', '&lt;'],
        ['>', '&gt;'],
        ['"', '&quot;'],
        ["'", "'"],
        ['@', '@'],
        ['&lt;', '&amp;lt;']
    ])('maps %s to %s', (input, expected) => {
        expect(escapeHtmlText(input)).toBe(expected);
    });

    it('escapes a mixed string in one pass', () => {
        expect(escapeHtmlText('a < b && c > "d"')).toBe('a &lt; b &amp;&amp; c &gt; &quot;d&quot;');
    });
});
