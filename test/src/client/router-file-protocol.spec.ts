// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { initRouter } from '../../../src/client/router';

/**
 * Firefox reports the origin of a `file://` page as `"null"`, which is no
 * valid base URL. The router must not build URLs against it: an exception in
 * `initRouter` stopped every client module initialised after it (graphs,
 * command palette, examples, ...). jsdom serialises the origin the same way.
 */
describe('router on file://', () => {
    it('marks the active sidebar link although the origin is "null"', () => {
        // Switched here: vitest cannot set up jsdom with an opaque origin.
        (globalThis as { jsdom?: { reconfigure(o: { url: string }): void } }).jsdom?.reconfigure({
            url: 'file:///site/forms/Foo.html'
        });
        expect(window.location.origin).toBe('null');
        // jsdom has neither; the sidebar uses them to scroll the active link into view.
        window.matchMedia = (query: string) => ({ matches: false, media: query }) as MediaQueryList;
        Element.prototype.scrollIntoView = () => {};
        (globalThis as { COMPODOC_CURRENT_PAGE_DEPTH?: number }).COMPODOC_CURRENT_PAGE_DEPTH = 1;
        document.body.innerHTML = `
            <nav class="menu">
                <a data-type="chapter-link" href="index.html">Home</a>
                <a data-type="entity-link" href="forms/Foo.html">Foo</a>
            </nav>`;

        expect(() => initRouter()).not.toThrow();

        const active = document.querySelector('.menu a.active');
        expect(active?.textContent).toBe('Foo');
        expect(active?.getAttribute('aria-current')).toBe('page');
    });
});
