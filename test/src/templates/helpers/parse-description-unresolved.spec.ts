import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { parseDescription } from '../../../../src/templates/helpers/parse-description';

describe('parseDescription with an unresolved {@link}', () => {
    beforeEach(() => {
        vi.spyOn(DependenciesEngine, 'findInCompodoc').mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders an undocumented symbol as code, not as a broken link', () => {
        expect(parseDescription('Uses {@link QueryParamGroup}.', 1)).toBe(
            'Uses <code>QueryParamGroup</code>.'
        );
        expect(parseDescription('See {@link appConfig|APP}', 1)).toBe('See <code>APP</code>');
        expect(parseDescription('The {@link QueryParam#urlParam}', 1)).toBe(
            'The <code>QueryParam#urlParam</code>'
        );
    });

    it('keeps URLs and files as links', () => {
        expect(parseDescription('{@link https://angular.dev|Angular}', 1)).toBe(
            '<a href="https://angular.dev">Angular</a>'
        );
        expect(parseDescription('{@link GUIDE.md}', 1)).toBe('<a href="GUIDE.md">GUIDE.md</a>');
    });
});
