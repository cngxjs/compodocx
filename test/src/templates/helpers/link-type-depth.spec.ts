import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import { functionSignature } from '../../../../src/templates/helpers/function-signature';
import { resolveType } from '../../../../src/templates/helpers/link-type';
import { hrefTo } from '../../helpers/pages';

/**
 * Type links climb from the page they are rendered on: every caller passes
 * the depth of its page.
 */
describe('Type links at page depth', () => {
    const internal = (data: Record<string, unknown>) => ({ source: 'internal', data }) as any;

    beforeEach(() => {
        vi.spyOn(DependenciesEngine, 'find').mockImplementation((name: string) => {
            if (name === 'User') {
                return internal({ type: 'interface', name: 'User' });
            }
            if (name === 'Status') {
                return internal({
                    type: 'miscellaneous',
                    ctype: 'miscellaneous',
                    subtype: 'typealias',
                    name: 'Status'
                });
            }
            return undefined;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('resolveType prefixes ../ at depth 1', () => {
        expect(resolveType('User', undefined, 1)?.href).toBe(hrefTo('interface', 'User', 1));
    });

    it('resolveType reports the kind of the linked page', () => {
        expect(resolveType('User', undefined, 1)?.kind).toBe('interface');
        expect(resolveType('Status', undefined, 1)?.kind).toBe('typealias');
    });

    it('resolveType climbs two levels at depth 2', () => {
        expect(resolveType('User', undefined, 2)?.href).toBe(hrefTo('interface', 'User', 2));
    });

    it('functionSignature links a known interface with ../../ at depth 2', () => {
        const html = functionSignature({ name: 'load', args: [{ name: 'user', type: 'User' }] }, 2);
        expect(html).toContain(`href="${hrefTo('interface', 'User', 2)}"`);
    });

    it('links a miscellaneous target with ../../ at depth 2', () => {
        expect(resolveType('Status', undefined, 2)?.href).toBe(hrefTo('typealias', 'Status', 2));
        const html = functionSignature(
            { name: 'setStatus', args: [{ name: 'status', type: 'Status' }] },
            2
        );
        expect(html).toContain(`href="${hrefTo('typealias', 'Status', 2)}"`);
    });
});
