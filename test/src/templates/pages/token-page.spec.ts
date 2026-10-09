import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
    emptyModel,
    factKey,
    type SemanticModel,
    type SymbolFacts,
    type SymbolKey
} from '../../../../src/app/compiler/semantic/model';
import Configuration from '../../../../src/app/configuration';
import { buildDiView } from '../../../../src/app/di';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import { TokenPage } from '../../../../src/templates/pages/TokenPage';
import { hrefTo } from '../../helpers/pages';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const F = 'lib/foo.ts';
const key = (name: string): SymbolKey => ({ name, file: F });
const facts = (name: string, extra: Partial<SymbolFacts> = {}): SymbolFacts => ({
    key: key(name),
    exportedBy: ['@lib/foo'],
    notExported: false,
    usedBy: [],
    ...extra
});

const token = {
    name: 'FOO_CONFIG',
    file: F,
    type: 'token',
    tokenType: 'FooConfig',
    providedIn: 'root',
    factory: "() => ({ label: 'x' })",
    description: '<p>Configuration of foo.</p>'
};
const engine = {
    tokens: [token],
    classes: [{ name: 'FooStore', file: F }],
    miscellaneous: {
        functions: [
            { name: 'configureFoo', file: F },
            { name: 'hiddenSetup', file: F }
        ]
    }
};
const semantic: SemanticModel = {
    ...emptyModel(),
    facts: new Map(
        [
            facts('FOO_CONFIG', {
                token: {
                    shape: 'interface',
                    providedBy: [key('configureFoo'), key('hiddenSetup')],
                    injectedBy: [key('FooStore')]
                }
            }),
            facts('configureFoo'),
            facts('hiddenSetup', { notExported: true, exportedBy: [] }),
            facts('FooStore')
        ].map(f => [factKey(f.key), f])
    )
};

describe('token page', () => {
    const saved = { ...Configuration.mainData };

    beforeEach(() => {
        const symbols = buildSymbolTable(engine as never, { cwd: '/' });
        Object.assign(Configuration.mainData, {
            symbols,
            semantic,
            di: buildDiView(symbols, semantic)
        });
    });

    afterEach(() => {
        Object.assign(Configuration.mainData, {
            symbols: saved.symbols,
            semantic: saved.semantic,
            di: saved.di
        });
    });

    const render = () => TokenPage({ token, depth: 1 });

    it('shows the description, typed shape, default and providedIn in that order', () => {
        const html = render();
        const order = ['id="description"', 'id="type"', 'id="default-value"', 'id="provided-in"'];
        const at = order.map(id => html.indexOf(id));
        expect(at.every(i => i > -1)).toBe(true);
        expect([...at].sort((a, b) => a - b)).toEqual(at);
        expect(html).toContain('>Interface</span>');
        expect(html).toContain('() => ({ label: &#39;x&#39; })');
    });

    it('links the documented providers and injectors, without hidden ones', () => {
        const html = render();
        expect(html).toContain('id="provided-by"');
        expect(html).toContain(`href="${hrefTo('function', 'configureFoo', 1)}"`);
        expect(html).not.toContain('hiddenSetup');
        expect(html).toContain('id="injected-by"');
        expect(html).toContain(`href="${hrefTo('class', 'FooStore', 1)}"`);
    });

    it('omits the DI sections and the default without facts or factory', () => {
        Object.assign(Configuration.mainData, { semantic: undefined, di: undefined });
        const html = TokenPage({ token: { ...token, factory: undefined }, depth: 1 });
        expect(html).not.toContain('id="provided-by"');
        expect(html).not.toContain('id="injected-by"');
        expect(html).not.toContain('id="default-value"');
        expect(html).not.toContain('cdx-badge--outline');
    });
});
