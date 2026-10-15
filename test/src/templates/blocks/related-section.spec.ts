import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Configuration from '../../../../src/app/configuration';
import { itemId } from '../../../../src/app/di/model';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import DependenciesEngine from '../../../../src/app/engines/dependencies.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { RelatedSection } from '../../../../src/templates/blocks/RelatedSection';
import { logger } from '../../../../src/utils/logger';
import { hrefTo } from '../../helpers/pages';

/**
 * RelatedSection resolves @relatedTo targets through the symbol table (`related`
 * policy: the `doc-link` kinds first, then tokens; hidden symbols skipped). The
 * table is built from the engine here. Each spec snapshots the singleton's collections,
 * stamps the seed for the test, and restores the originals in afterEach so the
 * other specs that lean on the engine stay green.
 */

type SnapshotKey =
    | 'components'
    | 'directives'
    | 'pipes'
    | 'injectables'
    | 'classes'
    | 'interfaces'
    | 'guards'
    | 'interceptors'
    | 'entities'
    | 'modules'
    | 'tokens';

const SNAPSHOT_KEYS: SnapshotKey[] = [
    'components',
    'directives',
    'pipes',
    'injectables',
    'classes',
    'interfaces',
    'guards',
    'interceptors',
    'entities',
    'modules',
    'tokens'
];

let snapshot: Partial<Record<SnapshotKey, unknown[]>>;
let miscSnapshot: any;

beforeAll(() => {
    I18nEngine.init('en-US');
});

beforeEach(() => {
    snapshot = {};
    for (const k of SNAPSHOT_KEYS) {
        snapshot[k] = (DependenciesEngine as any)[k];
        (DependenciesEngine as any)[k] = [];
    }
    miscSnapshot = (DependenciesEngine as any).miscellaneous;
    (DependenciesEngine as any).miscellaneous = {
        variables: [],
        functions: [],
        typealiases: [],
        enumerations: []
    };
});

afterEach(() => {
    for (const k of SNAPSHOT_KEYS) {
        (DependenciesEngine as any)[k] = snapshot[k];
    }
    (DependenciesEngine as any).miscellaneous = miscSnapshot;
    clearCustomTemplates();
});

describe('RelatedSection', () => {
    it('returns an empty string when relatedTo is missing', () => {
        expect(RelatedSection({ entityName: 'X', relatedTo: undefined, depth: 1 })).toBe('');
    });

    it('returns an empty string when relatedTo is an empty array', () => {
        expect(RelatedSection({ entityName: 'X', relatedTo: [], depth: 1 })).toBe('');
    });

    it('resolves a component target via findInCompodoc with depth-corrected href', () => {
        (DependenciesEngine as any).components = [{ name: 'CngxToast', type: 'component' }];
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['CngxToast'],
            depth: 1
        });
        expect(html).toContain('cdx-related-section');
        expect(html).toContain('id="related"');
        expect(html).toContain('class="cdx-related-pill"');
        expect(html).toContain(`href="${hrefTo('component', 'CngxToast', 1)}"`);
        expect(html).toContain('>CngxToast<');
    });

    it('resolves a token through the table after the doc-link kinds', () => {
        (DependenciesEngine as any).tokens = [{ name: 'CNGX_KEY', type: 'token' }];
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['CNGX_KEY'],
            depth: 1
        });
        expect(html).toContain(`href="${hrefTo('token', 'CNGX_KEY', 1)}"`);
    });

    it('picks the doc-link kind over a token of the same name', () => {
        (DependenciesEngine as any).classes = [{ name: 'SHARED_NAME', type: 'class' }];
        (DependenciesEngine as any).tokens = [{ name: 'SHARED_NAME', type: 'token' }];
        const html = RelatedSection({ entityName: 'Host', relatedTo: ['SHARED_NAME'], depth: 1 });
        expect(html).toContain(`href="${hrefTo('class', 'SHARED_NAME', 1)}"`);
        expect(html).not.toContain(`href="${hrefTo('token', 'SHARED_NAME', 1)}"`);
    });

    it('renders a hidden token as an unresolved pill', () => {
        const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const token = { name: 'HIDDEN_KEY', type: 'token' };
        (DependenciesEngine as any).tokens = [token];
        const id = itemId('token', token) as string;
        const saved = Configuration.mainData.di;
        Configuration.mainData.di = {
            ...saved,
            hidden: [id],
            placement: new Map([[id, { type: 'hidden' }]])
        } as any;
        try {
            const html = RelatedSection({
                entityName: 'Host',
                relatedTo: ['HIDDEN_KEY'],
                depth: 1
            });
            expect(html).toContain('cdx-related-pill--unresolved');
            expect(html).not.toContain(`href="${hrefTo('token', 'HIDDEN_KEY', 1)}"`);
        } finally {
            Configuration.mainData.di = saved;
            spy.mockRestore();
        }
    });

    it('renders unresolved targets as a dashed pill + emits a build-time warn', () => {
        const spy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['CngxFooDoesNotExist'],
            depth: 1
        });
        expect(html).toContain('cdx-related-pill--unresolved');
        expect(html).toContain('>CngxFooDoesNotExist<');
        expect(html).not.toContain('href="../');
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0][0]).toMatch(/CngxFooDoesNotExist/);
        expect(spy.mock.calls[0][0]).toMatch(/CngxButton/);
        spy.mockRestore();
    });

    it('routes @category-tagged misc entries to their detail page', () => {
        (DependenciesEngine as any).miscellaneous.variables = [
            { name: 'TAGGED_CONST', ctype: 'miscellaneous', subtype: 'variable', category: 'ui' }
        ];
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['TAGGED_CONST'],
            depth: 1
        });
        expect(html).toContain(`href="${hrefTo('variable', 'TAGGED_CONST', 1)}"`);
    });

    it('routes untagged misc entries to the inline collection anchor', () => {
        (DependenciesEngine as any).miscellaneous.functions = [
            { name: 'untaggedFn', ctype: 'miscellaneous', subtype: 'function' }
        ];
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['untaggedFn'],
            depth: 1
        });
        expect(html).toContain(`href="${hrefTo('function', 'untaggedFn', 1)}"`);
    });

    it('honours the `related` custom-template override', () => {
        registerCustomTemplate(
            'related',
            (data: any) =>
                `<aside data-cdx-custom-related="1">${(data.relatedTo ?? []).join(',')}</aside>`
        );
        const html = RelatedSection({
            entityName: 'CngxButton',
            relatedTo: ['A', 'B'],
            depth: 1
        });
        expect(html).toBe('<aside data-cdx-custom-related="1">A,B</aside>');
    });
});
