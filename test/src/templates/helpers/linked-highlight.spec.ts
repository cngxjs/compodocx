import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { initHighlighter } from '../../../../src/app/engines/syntax-highlight.engine';
import { highlightedSignature } from '../../../../src/templates/helpers/function-signature';
import {
    dropLeadingText,
    linkHighlightedTokens
} from '../../../../src/templates/helpers/linked-highlight';
import BasicTypeUtil from '../../../../src/utils/basic-type.util';

const span = (text: string) => `<span style="color:#123">${text}</span>`;

describe('linkHighlightedTokens', () => {
    it('wraps the text of a token that is exactly the link', () => {
        const html = `<span class="line">${span('add(todo: ')}${span('Todo')}${span(')')}</span>`;
        expect(
            linkHighlightedTokens(html, [{ start: 10, end: 14, href: 't.html', target: '_self' }])
        ).toBe(
            `<span class="line">${span('add(todo: ')}${span('<a href="t.html" target="_self">Todo</a>')}${span(')')}</span>`
        );
    });

    it('splits a token at link boundaries and keeps the colour on every piece', () => {
        const html = span('a: Todo)');
        expect(
            linkHighlightedTokens(html, [{ start: 3, end: 7, href: 't.html', target: '_self' }])
        ).toBe(span('a: <a href="t.html" target="_self">Todo</a>)'));
    });

    it('counts an entity as one character', () => {
        const html = `${span('a&#x3C;b&#x3E;: ')}${span('T')}`;
        expect(
            linkHighlightedTokens(html, [{ start: 6, end: 7, href: 't.html', target: '_self' }])
        ).toBe(`${span('a&#x3C;b&#x3E;: ')}${span('<a href="t.html" target="_self">T</a>')}`);
    });

    it('returns the markup unchanged without links', () => {
        expect(linkHighlightedTokens(span('x'), [])).toBe(span('x'));
    });
});

describe('highlightedSignature', () => {
    beforeAll(async () => {
        await initHighlighter();
    });

    beforeEach(() => {
        vi.spyOn(BasicTypeUtil, 'isKnownType').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('colours the signature and keeps the type link', () => {
        vi.spyOn(DependenciesEngine, 'find').mockImplementation((name: string) =>
            name === 'Filter'
                ? ({ source: 'external', data: { path: 'api/core/Filter' } } as any)
                : undefined
        );
        const html = highlightedSignature(
            { name: 'filter', args: [{ name: 'by', type: 'Filter' }] },
            1
        );
        expect(html).toContain('style=');
        expect(html).toContain(
            '<a href="https://angular.dev/api/core/Filter" target="_blank">Filter</a>'
        );
        expect(html.replace(/<[^>]+>/g, '')).toBe('filter(by: Filter)');
    });
});

describe('dropLeadingText', () => {
    it('drops whole tokens and cuts into the next one', () => {
        const html = `<span class="line">${span('function')}${span(' fi')}${span('lter')}</span>`;
        expect(dropLeadingText(html, 11)).toBe(`<span class="line">${span('lter')}</span>`);
    });

    it('keeps the rest of a cut token', () => {
        expect(dropLeadingText(`${span('function f')}${span('(')}`, 9)).toBe(
            `${span('f')}${span('(')}`
        );
    });
});
