import { beforeAll, describe, expect, it } from 'vitest';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import {
    CopyButton,
    codeSnippet,
    languageName,
    withCodeToolbars
} from '../../../../src/templates/components/CodeBlock';

const PRE = '<pre class="shiki"><code>x</code></pre>';

describe('codeSnippet', () => {
    it('wraps the code without a toolbar (exports stay button-free)', () => {
        expect(codeSnippet(PRE)).toBe(`<div class="cdx-code-snippet">${PRE}</div>`);
    });

    it('records language, label and context class', () => {
        const html = codeSnippet(PRE, { lang: 'sh', label: 'a<b>.scss', className: 'x' });
        expect(html).toContain('class="cdx-code-snippet x"');
        expect(html).toContain('data-cdx-lang="sh"');
        expect(html).toContain('data-cdx-label="a&lt;b&gt;.scss"');
    });
});

describe('languageName', () => {
    it('names known languages and keeps unknown ones', () => {
        expect(languageName('yml')).toBe('YAML');
        expect(languageName('cobol')).toBe('cobol');
    });
});

describe('withCodeToolbars', () => {
    beforeAll(() => {
        I18nEngine.init('en-US');
    });

    it('adds the toolbar with the language name and the copy button', () => {
        const html = withCodeToolbars(codeSnippet(PRE, { lang: 'ts' }));
        expect(html).toMatch(
            /^<div class="cdx-code-snippet cdx-code-block" data-cdx-lang="ts"><div class="cdx-code-bar"><span class="cdx-code-label">TypeScript<\/span><button/
        );
        expect(html).toContain('data-cdx-copy');
        expect(html).toContain('>Copy</span>');
        expect(html).toContain('data-cdx-copied="Copied"');
    });

    it('prefers the label over the language', () => {
        const html = withCodeToolbars(codeSnippet(PRE, { lang: 'scss', label: 'theme.scss' }));
        expect(html).toContain('<span class="cdx-code-label">theme.scss</span>');
    });

    it('keeps context classes and runs only once', () => {
        const once = withCodeToolbars(codeSnippet(PRE, { className: 'cdx-theming-example' }));
        expect(once).toContain('class="cdx-code-snippet cdx-code-block cdx-theming-example"');
        expect(withCodeToolbars(once)).toBe(once);
    });

    it('leaves pages without code blocks untouched', () => {
        expect(withCodeToolbars('<p>no code</p>')).toBe('<p>no code</p>');
    });

    it('gives every copy button a type and the page language', () => {
        expect(CopyButton()).toMatch(/^<button type="button" class="cdx-copy"/);
    });
});
