import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { ReferencedBySection } from '../../../../src/templates/blocks/ReferencedBySection';
import { hrefTo, pageOf } from '../../helpers/pages';

beforeAll(() => {
    I18nEngine.init('en-US');
});

afterEach(() => {
    clearCustomTemplates();
});

describe('ReferencedBySection', () => {
    it('returns an empty string when entries is missing', () => {
        expect(ReferencedBySection({ entries: undefined, depth: 1 })).toBe('');
    });

    it('returns an empty string when entries is an empty array', () => {
        expect(ReferencedBySection({ entries: [], depth: 1 })).toBe('');
    });

    it('renders chips with kind-coloured class and depth-corrected href', () => {
        const html = ReferencedBySection({
            entries: [
                { name: 'CngxToast', kind: 'component', hrefPrefix: 'components' },
                { name: 'AuthService', kind: 'injectable', hrefPrefix: 'injectables' }
            ],
            depth: 1
        });
        expect(html).to.include('cdx-referenced-by');
        expect(html).to.include('id="used-by"');
        expect(html).to.include('class="cdx-chip cdx-chip--component"');
        expect(html).to.include('class="cdx-chip cdx-chip--injectable"');
        expect(html).to.include(`href="${hrefTo('component', 'CngxToast', 1)}"`);
        expect(html).to.include(`href="${hrefTo('injectable', 'AuthService', 1)}"`);
        expect(html).to.include('data-cdx-kind="component"');
    });

    it('uses depth 0 prefix when rendered on a flat-root page', () => {
        const html = ReferencedBySection({
            entries: [{ name: 'CngxToast', kind: 'component', hrefPrefix: 'components' }],
            depth: 0
        });
        expect(html).to.include(`href="${pageOf('component', 'CngxToast')}"`);
        expect(html).to.not.include('../components/');
    });

    it('uses depth 2 prefix for misc detail pages (miscellaneous/<plural>/<name>.html)', () => {
        const html = ReferencedBySection({
            entries: [{ name: 'CngxToast', kind: 'component', hrefPrefix: 'components' }],
            depth: 2
        });
        expect(html).to.include(`href="${hrefTo('component', 'CngxToast', 2)}"`);
    });

    it('honours the `referenced-by` custom-template override', () => {
        registerCustomTemplate(
            'referenced-by',
            (data: any) =>
                `<aside data-cdx-custom-referenced-by="1">${data.entries
                    .map((e: any) => e.name)
                    .join(',')}</aside>`
        );
        const html = ReferencedBySection({
            entries: [
                { name: 'CngxToast', kind: 'component', hrefPrefix: 'components' },
                { name: 'AuthService', kind: 'injectable', hrefPrefix: 'injectables' }
            ],
            depth: 1
        });
        expect(html).toBe('<aside data-cdx-custom-referenced-by="1">CngxToast,AuthService</aside>');
    });

    it('falls back to default rendering when override is registered but entries is empty', () => {
        // Empty entries short-circuit BEFORE the override is consulted — keeps
        // pages clean when an entity simply has no backlinks.
        registerCustomTemplate('referenced-by', () => '<aside data-cdx-custom="1"></aside>');
        expect(ReferencedBySection({ entries: [], depth: 1 })).toBe('');
    });
});
