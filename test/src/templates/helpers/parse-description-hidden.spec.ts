import { afterEach, describe, expect, it, vi } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { parseDescription } from '../../../../src/templates/helpers/parse-description';

// A found symbol without a placed link is a hidden one (notExported): no page.
vi.mock('../../../../src/app/links/resolve', async importOriginal => ({
    ...(await importOriginal<typeof import('../../../../src/app/links/resolve')>()),
    placeTarget: () => undefined
}));

describe('parseDescription with a hidden or non-page target', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders a hidden symbol as code with its label', () => {
        vi.spyOn(DependenciesEngine, 'findInCompodoc').mockReturnValue({
            name: 'Internal',
            type: 'class'
        } as never);
        expect(parseDescription('the {@link Internal|inner one}', 1)).toBe(
            'the <code>inner one</code>'
        );
        expect(parseDescription('the {@link Internal}', 1)).toBe('the <code>Internal</code>');
    });

    it('renders a source path as code, not as a link', () => {
        vi.spyOn(DependenciesEngine, 'findInCompodoc').mockReturnValue(false);
        expect(parseDescription('Unlike {@link /src/app/foo.ts fooSource}', 1)).toBe(
            'Unlike <code>fooSource</code>'
        );
        expect(parseDescription('see {@link ./notes.md#usage}', 1)).toBe(
            'see <a href="./notes.md#usage">./notes.md#usage</a>'
        );
        expect(parseDescription('mail {@link mailto:a@b.c|us}', 1)).toBe(
            'mail <a href="mailto:a@b.c">us</a>'
        );
    });
});
