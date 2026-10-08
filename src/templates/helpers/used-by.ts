import { factKey, type SemanticModel } from '../../app/compiler/semantic/model';
import { type DiView, isHidden } from '../../app/di/model';
import type { EntityKind } from '../../app/engines/dependencies.engine';
import { KIND_FOLDER } from '../../app/links/layout';
import { presentationKind, type TableKind, toSymbolKey } from '../../app/links/symbol-id';
import { entryInFile, type SymbolEntry, type SymbolTable } from '../../app/links/symbol-table';
import type { ReferencedByEntry } from '../blocks/ReferencedBySection';

const indexes = new WeakMap<SymbolTable, ReadonlyMap<string, SymbolEntry>>();

/** Table entries by fact key, built once per table. */
const byFactKey = (table: SymbolTable): ReadonlyMap<string, SymbolEntry> => {
    const known = indexes.get(table);
    if (known) {
        return known;
    }
    const index = new Map<string, SymbolEntry>();
    for (const entry of table.byId.values()) {
        const key = factKey(toSymbolKey(entry.ref));
        if (!index.has(key)) {
            index.set(key, entry);
        }
    }
    indexes.set(table, index);
    return index;
};

export interface UsedByContext {
    readonly symbols?: SymbolTable;
    readonly semantic?: SemanticModel;
    readonly di?: DiView;
}

/**
 * The documented symbols that use an engine object, from the semantic
 * facts. Users without a page (not documented, or hidden) are left out.
 * Empty without the semantic stage.
 */
export const usedByEntries = (
    data: UsedByContext,
    kind: EntityKind | TableKind,
    item: { readonly name?: unknown; readonly file?: unknown } | undefined
): ReferencedByEntry[] => {
    const { symbols: table, semantic } = data;
    if (!table || !semantic || typeof item?.name !== 'string') {
        return [];
    }
    const file = typeof item.file === 'string' ? item.file : undefined;
    const ownKind = presentationKind(kind as EntityKind, item);
    const own = entryInFile(table, ownKind, item.name, file);
    const facts = own && semantic.facts.get(factKey(toSymbolKey(own.ref)));
    if (!own || !facts) {
        return [];
    }
    const index = byFactKey(table);
    return facts.usedBy
        .map(key => index.get(factKey(key)))
        .filter((user): user is SymbolEntry => user !== undefined && user.id !== own.id)
        .filter(user => !isHidden(data.di, user.id))
        .map(user => ({
            name: user.ref.name,
            kind: user.ref.kind,
            hrefPrefix: KIND_FOLDER[user.ref.kind]
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
};
