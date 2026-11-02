import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import { logger } from '../../utils/logger';
import type { INamespaceDep } from '../compiler/angular/dependencies.interfaces';
import Configuration from '../configuration';
import { type DiView, isHidden } from '../di/model';
import DependenciesEngine from '../engines/dependencies.engine';
import { hrefFor, hrefText, pageLocation } from '../links/layout';
import { placedLink, symbolTarget } from '../links/resolve';
import type { TableKind } from '../links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../links/symbol-table';

/** One declaration of a namespace: its kind, qualified name and, unless hidden, its page. */
export interface NamespaceMemberRow {
    readonly kind: TableKind;
    readonly name: string;
    readonly href?: string;
    /** Rendered description of the member (HTML). */
    readonly description: string;
}

/** What the `namespace` override receives under `namespace`. */
export interface NamespacePageData {
    /** Qualified name, `Outer.Inner` for an inner namespace. */
    readonly name: string;
    /** Dotted chain of the enclosing namespaces; undefined at the top level. */
    readonly namespace?: string;
    readonly file: string;
    readonly description: string;
    /** Import path of the nearest exporting barrel; undefined without semantic facts. */
    readonly entryPoint?: string;
    readonly members: readonly NamespaceMemberRow[];
}

/**
 * The table entries documented under a qualified member name, the
 * namespace's own file first. A bare-name listing is not a member.
 */
const memberEntries = (table: SymbolTable, name: string, file: string): SymbolEntry[] => {
    const entries = [...new Set(table.byName.get(name) ?? [])]
        .map(id => table.byId.get(id))
        .filter((entry): entry is SymbolEntry => entry?.ref.name === name);
    return [
        ...entries.filter(entry => entry.ref.file === file),
        ...entries.filter(entry => entry.ref.file !== file)
    ];
};

const memberRow = (
    table: SymbolTable,
    view: DiView | undefined,
    entry: SymbolEntry,
    depth: number
): NamespaceMemberRow => {
    const link = placedLink(table, entry, view);
    const description = (entry.data as { description?: unknown }).description;
    return {
        kind: entry.ref.kind,
        name: entry.ref.name,
        ...(link ? { href: hrefText(hrefFor(link.target, depth, link.anchor)) } : {}),
        description: typeof description === 'string' ? description : ''
    };
};

/** The page data of one namespace: its members in name order, each linked where documented. */
export const namespacePageData = (
    entry: SymbolEntry,
    table: SymbolTable,
    view: DiView | undefined,
    depth: number
): NamespacePageData => {
    const item = entry.data as INamespaceDep;
    return {
        name: entry.ref.name,
        ...(item.namespace ? { namespace: item.namespace } : {}),
        file: item.file,
        description: item.description ?? '',
        ...(entry.entryPoint ? { entryPoint: entry.entryPoint } : {}),
        members: (item.members ?? []).flatMap(name =>
            memberEntries(table, name, entry.ref.file).map(member =>
                memberRow(table, view, member, depth)
            )
        )
    };
};

/** The namespace entries of the symbol table that get a page, in name order. */
export const namespaceEntries = (
    table: SymbolTable | undefined,
    view: DiView | undefined
): readonly SymbolEntry[] =>
    [...(table?.byId.values() ?? [])]
        .filter(entry => entry.ref.kind === 'namespace' && !isHidden(view, entry.id))
        .sort((a, b) => (a.ref.name < b.ref.name ? -1 : a.ref.name > b.ref.name ? 1 : 0));

/** One page per namespace that reaches an entry point (or every one without semantic facts). */
export const createNamespacePageGenerator = () => ({
    prepare: (): Promise<true> => {
        const { mainData } = Configuration;
        const { symbols, di } = mainData;
        const entries = namespaceEntries(symbols, di);
        mainData.namespaces = DependenciesEngine.namespaces;
        if (!symbols || entries.length === 0) {
            return Promise.resolve(true);
        }
        logger.info('Prepare namespaces');
        for (const entry of entries) {
            const location = pageLocation(symbolTarget(entry));
            Configuration.addPage({
                path: location.path,
                name: location.filename,
                displayName: entry.ref.name,
                id: entry.id,
                filename: location.filename,
                context: 'namespace',
                namespace: namespacePageData(entry, symbols, di, location.depth),
                namespaceEntry: entry,
                depth: location.depth,
                pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
            });
        }
        return Promise.resolve(true);
    }
});

export type NamespacePageGenerator = ReturnType<typeof createNamespacePageGenerator>;
