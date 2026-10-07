import { hrefText } from '../app/links/layout';
import { hrefForSymbol } from '../app/links/resolve';
import { parseSymbolId } from '../app/links/symbol-id';
import {
    buildSymbolTable,
    type EngineData,
    lookupName,
    policyKinds
} from '../app/links/symbol-table';

export interface EntityIndexEntry {
    href: string;
    kind: string;
}

export type EntityIndex = Record<string, EntityIndexEntry>;

const INDEX_KIND: Readonly<Record<string, string>> = { enumeration: 'enum' };

/**
 * Build the entity index from mainData. Call after entity collection, before
 * rendering. Keys are bare names; a name that several symbols carry resolves
 * through the `entity-index` lookup policy. Hrefs are root-relative.
 */
export function buildEntityIndex(mainData: Record<string, unknown>): EntityIndex {
    const table = buildSymbolTable(mainData as EngineData);
    const names = new Set<string>();
    for (const kind of policyKinds('entity-index')) {
        for (const entry of table.byId.values()) {
            if (entry.ref.kind === kind) {
                names.add(entry.ref.name);
            }
        }
    }

    const index: EntityIndex = {};
    for (const name of names) {
        const id = lookupName(table, name, 'entity-index');
        const href = id && hrefForSymbol(table, id, 0, { duplicate: true, detail: true });
        if (!id || !href) {
            continue;
        }
        const kind = parseSymbolId(id);
        const symbolKind = kind.ok ? kind.value.kind : '';
        index[name] = {
            href: hrefText(href, 'bare'),
            kind: INDEX_KIND[symbolKind] ?? symbolKind
        };
    }
    return index;
}
