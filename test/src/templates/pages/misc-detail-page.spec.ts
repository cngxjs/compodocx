import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable } from '../../../../src/app/links';
import { renderMiscDetailPage } from '../../../../src/templates/pages/MiscDetailPage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const F = 'lib/cache.ts';
const variable = {
    name: 'cache',
    file: F,
    type: 'Map<string, number>',
    defaultValue: 'new Map<string, number>() && ready'
};
const enumeration = {
    name: 'Markup',
    file: F,
    childs: [{ name: 'Bold', value: '<b>' }]
};
const engine = { miscellaneous: { variables: [variable], enumerations: [enumeration] } };

describe('misc detail page', () => {
    const saved = { ...Configuration.mainData };

    beforeEach(() => {
        Object.assign(Configuration.mainData, {
            symbols: buildSymbolTable(engine as never, { cwd: '/' })
        });
    });

    afterEach(() => {
        Object.assign(Configuration.mainData, { symbols: saved.symbols });
    });

    it('escapes the initializer of a variable', () => {
        const html = renderMiscDetailPage({ kind: 'variable', item: variable, depth: 1 });
        expect(html).to.include('<code>new Map&lt;string, number>() &amp;&amp; ready</code>');
        expect(html).to.not.include('new Map<string, number>()');
    });

    it('picks code or pre by the length of the raw initializer', () => {
        const quoted = { ...variable, defaultValue: `['${'a'.repeat(30)}', '${'b'.repeat(30)}']` };
        const html = renderMiscDetailPage({ kind: 'variable', item: quoted, depth: 1 });
        expect(html).to.include(`<code>[&#39;${'a'.repeat(30)}&#39;`);
    });

    it('escapes the value of an enum member', () => {
        const html = renderMiscDetailPage({ kind: 'enumeration', item: enumeration, depth: 1 });
        expect(html).to.include('<code>&lt;b></code>');
        expect(html).to.not.include('<code><b></code>');
    });
});
