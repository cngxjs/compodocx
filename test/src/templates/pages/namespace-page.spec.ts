import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import Configuration from '../../../../src/app/configuration';
import {
    clearCustomTemplates,
    registerCustomTemplate
} from '../../../../src/app/engines/custom-template.engine';
import I18nEngine from '../../../../src/app/engines/i18n.engine';
import { buildSymbolTable, type SymbolEntry } from '../../../../src/app/links';
import { namespacePageData } from '../../../../src/app/page-generator/namespace-page-generator';
import { NamespacePage } from '../../../../src/templates/pages/NamespacePage';
import { hrefTo } from '../../helpers/pages';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const FILE = 'src/bridge.ts';

const table = buildSymbolTable(
    {
        interfaces: [
            {
                name: 'StateSource',
                file: FILE,
                namespace: 'Bridge',
                description: '<p>Host that emits a state change. More text.</p>'
            }
        ],
        namespaces: [
            {
                name: 'Bridge',
                file: FILE,
                type: 'namespace',
                description: '<p>Typed access to a private surface.</p>',
                members: ['Bridge.Inner', 'Bridge.StateSource']
            },
            {
                name: 'Inner',
                namespace: 'Bridge',
                file: FILE,
                type: 'namespace',
                description: '',
                // A member without a page of its own: the namespace has a page, no member rows.
                members: ['Bridge.Inner.Deep']
            }
        ]
    } as never,
    { cwd: '/' }
);

const entryOf = (name: string): SymbolEntry =>
    [...table.byId.values()].find(
        entry => entry.ref.kind === 'namespace' && entry.ref.name === name
    ) as SymbolEntry;

/** The page markup without the attributes the test-time JSX transform adds. */
const render = (name: string): string => {
    const entry = entryOf(name);
    return NamespacePage({
        namespace: namespacePageData(entry, table, undefined, 1),
        namespaceEntry: entry,
        depth: 1
    }).replace(/ __(self|source)="[^"]*"/g, '');
};

describe('NamespacePage', () => {
    afterEach(() => {
        clearCustomTemplates();
        Configuration.mainData.symbols = undefined;
    });

    it('renders the hero, the description and the linked members', () => {
        Configuration.mainData.symbols = table;
        const html = render('Bridge');
        expect(html).to.include('<span>Bridge</span>');
        expect(html).to.include('cdx-badge--entity-namespace');
        expect(html).to.include('data-pagefind-meta="kind:Namespace"');
        expect(html).to.include('Typed access to a private surface.');
        expect(html).to.include('id="members"');
        expect(html).to.include(
            `<a href="${hrefTo('interface', 'Bridge.StateSource', 1)}"><code>Bridge.StateSource</code></a>`
        );
        expect(html).to.include(
            `<a href="${hrefTo('namespace', 'Bridge.Inner', 1)}"><code>Bridge.Inner</code></a>`
        );
        expect(html).to.include('Host that emits a state change');
        expect(html).to.not.include('More text');
    });

    it('links an inner namespace to its enclosing one and omits empty sections', () => {
        Configuration.mainData.symbols = table;
        const html = render('Bridge.Inner');
        expect(html).to.include('<span>Bridge.Inner</span>');
        expect(html).to.include(
            `Namespace <a href="${hrefTo('namespace', 'Bridge', 1)}"><code>Bridge</code></a>`
        );
        expect(html).to.not.include('id="members"');
        expect(html).to.not.include('id="description"');
    });

    it('lets a custom `namespace` template win', () => {
        registerCustomTemplate(
            'namespace',
            (data: any) => `<div class="custom-ns">${data.namespace.name}</div>`
        );
        expect(render('Bridge')).to.equal('<div class="custom-ns">Bridge</div>');
    });
});
