import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import Configuration from '../../../src/app/configuration';
import { exportAliases, exportNamespaces } from '../../../src/app/engines/export-json.engine';
import I18nEngine from '../../../src/app/engines/i18n.engine';
import {
    EXPORT_SCHEMA_VERSION,
    type ExportData
} from '../../../src/app/interfaces/export-data.interface';
import {
    buildSymbolTable,
    lookupEntry,
    placeInFolders,
    withStyleEntries
} from '../../../src/app/links/symbol-table';
import { namespacePageData } from '../../../src/app/page-generator/namespace-page-generator';
import { renderLlmMd } from '../../../src/llm-md';
import { parseDescription } from '../../../src/templates/helpers/parse-description';
import { NamespacePage } from '../../../src/templates/pages/NamespacePage';

beforeAll(() => {
    I18nEngine.init('en-US');
});

const GEOMETRY = '/repo/src/geometry.ts';
const API = '/repo/src/api.ts';

const alias = (name: string, target: string, extra: Record<string, unknown> = {}) => ({
    name,
    target,
    targetFile: GEOMETRY,
    file: API,
    description: '',
    rawdescription: '',
    ...extra
});

const pointAlias = alias('Point', 'Geometry.Point', {
    namespace: 'Api',
    description: '<p>The point of the API. More.</p>'
});
const distanceAlias = alias('distance', 'Geometry.distance', { namespace: 'Api' });
const lostAlias = alias('Lost', 'Elsewhere.Lost', { namespace: 'Api', targetFile: undefined });
const topLevel = alias('Pt', 'Geometry.Point');

const namespaces = [
    {
        name: 'Api',
        file: API,
        type: 'namespace',
        description: '',
        members: [],
        aliases: [pointAlias, distanceAlias, lostAlias]
    },
    {
        name: 'Geometry',
        file: GEOMETRY,
        type: 'namespace',
        description: '',
        members: ['Geometry.Point', 'Geometry.distance']
    },
    { name: 'Empty', file: API, type: 'namespace', description: '', members: [] }
];

const table = placeInFolders(
    buildSymbolTable(
        {
            interfaces: [
                {
                    name: 'Point',
                    namespace: 'Geometry',
                    file: GEOMETRY,
                    type: 'interface',
                    description: '<p>A point in the plane. Second sentence.</p>'
                },
                // A symbol of an alias's name wins over the alias.
                { name: 'Pt', file: '/repo/src/pt.ts', description: '' }
            ],
            miscellaneous: {
                functions: [
                    {
                        name: 'distance',
                        namespace: 'Geometry',
                        file: GEOMETRY,
                        description: '<p>Distance between two points.</p>'
                    }
                ]
            },
            namespaces,
            namespaceAliases: [pointAlias, distanceAlias, lostAlias, topLevel]
        } as never,
        { cwd: '/repo' }
    ),
    () => ['core']
);

describe('namespace aliases in the symbol table', () => {
    afterEach(() => {
        Configuration.mainData.symbols = undefined;
    });

    it('gives an empty namespace no entry and an alias none of its own', () => {
        const names = [...table.byId.values()].map(entry => entry.ref.name);
        expect(names).toContain('Api');
        expect(names).not.toContain('Empty');
        expect(names).not.toContain('Api.Point');
        expect(table.byName.has('Api.Point')).toBe(false);
    });

    it('resolves an alias name to its target for doc and type links', () => {
        expect(lookupEntry(table, 'Api.Point', 'doc-link')?.ref.name).toBe('Geometry.Point');
        expect(lookupEntry(table, 'Api.Point', 'type-link')?.ref.name).toBe('Geometry.Point');
        expect(lookupEntry(table, 'Api.distance', 'doc-link')?.ref.name).toBe('Geometry.distance');
        expect(lookupEntry(table, 'Api.Lost', 'doc-link')).toBeUndefined();
        expect(lookupEntry(table, 'Empty', 'doc-link')).toBeUndefined();
    });

    it('lets a symbol of the same name win over a top-level alias', () => {
        expect(table.aliases?.has('Pt')).toBe(false);
        expect(lookupEntry(table, 'Pt', 'doc-link')?.ref.file).toBe('src/pt.ts');
    });

    it('keeps the aliases when style entries are added', () => {
        const styled = withStyleEntries(table, [{ file: 'src/tokens.css' }]);
        expect(styled.aliases).toBe(table.aliases);
    });

    it('links {@link Api.Point} to the target page under the written name', () => {
        Configuration.mainData.symbols = table;
        expect(parseDescription('see {@link Api.Point}', 1)).toBe(
            'see <a href="../core/Geometry.Point.html">Api.Point</a>'
        );
    });
});

describe('namespace aliases on the namespace page', () => {
    const api = [...table.byId.values()].find(entry => entry.ref.name === 'Api');
    const data = api ? namespacePageData(api, table, undefined, 1) : undefined;

    it('lists each alias with its target kind, page and description, in name order', () => {
        expect(data?.members).toEqual([
            {
                name: 'Api.Lost',
                aliasOf: 'Elsewhere.Lost',
                description: ''
            },
            {
                kind: 'interface',
                name: 'Api.Point',
                aliasOf: 'Geometry.Point',
                href: '../core/Geometry.Point.html',
                description: '<p>The point of the API. More.</p>'
            },
            {
                kind: 'function',
                name: 'Api.distance',
                aliasOf: 'Geometry.distance',
                href: '../core/Geometry.distance.html',
                description: '<p>Distance between two points.</p>'
            }
        ]);
    });

    it('renders the kind icon, the target after an arrow; an unresolved alias without either', () => {
        const html = NamespacePage({ namespace: data, namespaceEntry: api, depth: 1 }).replace(
            / __(self|source)="[^"]*"/g,
            ''
        );
        expect(html).not.toContain('<th scope="col">Kind</th>');
        expect(html).toMatch(
            /<tr data-cdx-namespace-member="interface" data-cdx-namespace-alias="Geometry.Point"><td class="cdx-namespace-member-name"><span class="cdx-ref-kind-icon cdx-ref-kind-icon--interface" aria-hidden="true" title="Interface">If<\/span><span class="sr-only">Interface <\/span><a href="..\/core\/Geometry.Point.html"><code>Api.Point<\/code><\/a><span class="cdx-namespace-alias-of">[^<]*Geometry.Point<\/span><\/td><td>The point of the API<\/td>/
        );
        expect(html).toContain(
            '<tr data-cdx-namespace-member="alias" data-cdx-namespace-alias="Elsewhere.Lost"><td class="cdx-namespace-member-name"><span class="cdx-namespace-kind-blank" aria-hidden="true"></span><code>Api.Lost</code>'
        );
    });
});

describe('namespace aliases in the exports', () => {
    it('writes the aliases of a namespace with qualified names, and the top-level ones', () => {
        const [api] = exportNamespaces(namespaces as never);
        expect(api.aliases).toEqual([
            { name: 'Api.Point', target: 'Geometry.Point' },
            { name: 'Api.distance', target: 'Geometry.distance' },
            { name: 'Api.Lost', target: 'Elsewhere.Lost' }
        ]);
        expect(exportNamespaces(namespaces as never).map(entry => entry.name)).toContain('Empty');
        expect(exportNamespaces(namespaces as never)[1].aliases).toBeUndefined();
        expect(exportAliases([pointAlias, topLevel] as never)).toEqual([
            { name: 'Pt', target: 'Geometry.Point' }
        ]);
    });

    it('lists the aliases in llm-md and skips an empty namespace', () => {
        const data: ExportData = {
            schemaVersion: EXPORT_SCHEMA_VERSION,
            generatedAt: '',
            compodocxVersion: '',
            components: [],
            pipes: [],
            directives: [],
            injectables: [],
            guards: [],
            interceptors: [],
            classes: [],
            interfaces: [],
            namespaces: exportNamespaces(namespaces as never),
            aliases: [{ name: 'Pt', target: 'Geometry.Point' }]
        };
        const out = renderLlmMd(data, { projectName: 'p' });
        expect(out).toContain(
            '### Api\n\nFile: `/repo/src/api.ts`\nAliases:\n- `Api.Point` -> `Geometry.Point`'
        );
        expect(out).not.toContain('### Empty');
        expect(out).toContain('## Aliases\n\n- `Pt` -> `Geometry.Point`');
    });
});
