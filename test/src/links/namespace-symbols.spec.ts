import { afterEach, describe, expect, it } from 'vitest';
import Configuration from '../../../src/app/configuration';
import { buildRedirects } from '../../../src/app/links/redirects';
import {
    buildSymbolTable,
    entryInFile,
    lookupEntry,
    lookupName,
    placeInFolders
} from '../../../src/app/links/symbol-table';
import { parseDescription } from '../../../src/templates/helpers/parse-description';

const FILE = 'src/bridge.ts';

const table = placeInFolders(
    buildSymbolTable(
        {
            interfaces: [
                { name: 'StateSource', file: FILE, namespace: 'Bridge' },
                { name: 'StateSource', file: FILE, namespace: 'Other' },
                { name: 'Shape', file: 'src/shape.ts' },
                { name: 'Shape', file: FILE, namespace: 'Bridge' }
            ],
            miscellaneous: {
                typealiases: [
                    {
                        name: 'Deep',
                        file: FILE,
                        namespace: 'Bridge.Inner',
                        ctype: 'miscellaneous',
                        subtype: 'typealias'
                    }
                ]
            }
        } as never,
        { cwd: '/repo' }
    ),
    () => ['core']
);

const entryOf = (name: string) => table.byId.get(lookupName(table, name, 'doc-link') as never);

describe('namespace member symbols', () => {
    it('ids and pages use the qualified name', () => {
        expect(table.byId.has(`interface:${FILE}#Bridge.StateSource` as never)).toBe(true);
        expect(table.byId.has(`typealias:${FILE}#Bridge.Inner.Deep` as never)).toBe(true);
        expect(entryOf('Bridge.Inner.Deep')?.fileName).toBe('Bridge.Inner.Deep');
    });

    it('gives two namespaces with one member name two ids and two pages', () => {
        const bridge = entryOf('Bridge.StateSource');
        const other = entryOf('Other.StateSource');
        expect(bridge?.id).not.toBe(other?.id);
        expect([bridge?.fileName, other?.fileName]).toEqual([
            'Bridge.StateSource',
            'Other.StateSource'
        ]);
    });

    it('still resolves the bare name of a unique member', () => {
        expect(entryOf('Deep')?.ref.name).toBe('Bridge.Inner.Deep');
    });

    it('keeps a bare name for the symbol of that very name', () => {
        expect(entryOf('Shape')?.ref.file).toBe('src/shape.ts');
        expect(entryOf('Bridge.Shape')?.ref.file).toBe(FILE);
    });

    it('finds the member of the qualified name among same-file members', () => {
        const entry = entryInFile(table, 'interface', 'Other.StateSource', FILE);
        expect(entry?.ref.name).toBe('Other.StateSource');
        expect(lookupEntry(table, 'Bridge.StateSource', 'doc-link')?.ref.name).toBe(
            'Bridge.StateSource'
        );
    });

    it('redirects the page of the bare member name to the qualified page', () => {
        const redirects = buildRedirects({ table, features: [], pages: new Set() });
        expect(redirects['core/Deep.html']).toBe('core/Bridge.Inner.Deep.html');
        expect(redirects['core/StateSource.html']).toBe('core/Bridge.StateSource.html');
    });

    describe('the namespace itself', () => {
        const withNamespaces = placeInFolders(
            buildSymbolTable(
                {
                    interfaces: [
                        { name: 'StateSource', file: FILE, namespace: 'Bridge', type: 'interface' }
                    ],
                    namespaces: [
                        {
                            name: 'Bridge',
                            file: FILE,
                            type: 'namespace',
                            members: ['Bridge.Inner', 'Bridge.StateSource']
                        },
                        {
                            name: 'Inner',
                            file: FILE,
                            namespace: 'Bridge',
                            type: 'namespace',
                            members: ['Bridge.Inner.Deep']
                        }
                    ]
                } as never,
                { cwd: '/repo' }
            ),
            () => ['core']
        );

        afterEach(() => {
            Configuration.mainData.symbols = undefined;
        });

        it('is the doc-link target of its name', () => {
            expect(lookupEntry(withNamespaces, 'Bridge', 'doc-link')?.ref.kind).toBe('namespace');
            expect(lookupEntry(withNamespaces, 'Bridge.Inner', 'doc-link')?.ref.kind).toBe(
                'namespace'
            );
            expect(lookupEntry(withNamespaces, 'Bridge', 'entity-index')?.fileName).toBe('Bridge');
        });

        it('resolves {@link Ns} to the namespace page', () => {
            Configuration.mainData.symbols = withNamespaces;
            expect(parseDescription('see {@link Bridge}', 1)).toBe(
                'see <a href="../core/Bridge.html">Bridge</a>'
            );
            expect(parseDescription('see {@link Bridge.StateSource}', 1)).toContain(
                'href="../core/Bridge.StateSource.html"'
            );
        });
    });
});
