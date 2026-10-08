import { factKey } from '../../app/compiler/semantic/model';
import { isHidden } from '../../app/di/model';
import type { EntityKind } from '../../app/engines/dependencies.engine';
import { pageLocation } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import { type TableKind, toSymbolKey } from '../../app/links/symbol-id';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import type { ReferencedByEntry } from '../blocks/ReferencedBySection';
import { entryFacts, type FactsContext, ownEntry } from './symbol-facts';

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

export type UsedByContext = FactsContext;

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
    const own = ownEntry(data, kind, item);
    const facts = entryFacts(data.semantic, own);
    if (!data.symbols || !own || !facts) {
        return [];
    }
    const table = data.symbols;
    const index = byFactKey(table);
    return facts.usedBy
        .map(key => index.get(factKey(key)))
        .filter((user): user is SymbolEntry => user !== undefined && user.id !== own.id)
        .filter(user => !isHidden(data.di, user.id))
        .flatMap(user => {
            const link = placedLink(table, user, data.di);
            if (!link) {
                return [];
            }
            const location = pageLocation(link.target);
            return [
                {
                    name: user.ref.name,
                    kind: user.ref.kind,
                    hrefPrefix: location.path,
                    ...(location.filename === user.ref.name ? {} : { pageName: location.filename }),
                    ...(link.anchor ? { anchor: link.anchor } : {})
                }
            ];
        })
        .sort((a, b) => a.name.localeCompare(b.name));
};
