import { type DiView, hiddenFilter } from '../app/di/model';
import { hrefFor, hrefText } from '../app/links/layout';
import { placedLink } from '../app/links/resolve';
import {
    buildSymbolTable,
    type EngineData,
    lookupEntry,
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

    const di = mainData.di as DiView | undefined;
    const hidden = hiddenFilter(di);
    const index: EntityIndex = {};
    for (const name of names) {
        const entry = lookupEntry(table, name, 'entity-index', undefined, hidden);
        const link = entry && placedLink(table, entry, di, { duplicate: true });
        if (!entry || !link) {
            continue;
        }
        const href = hrefFor(link.target, 0, link.anchor);
        index[name] = {
            href: hrefText(href, 'bare'),
            kind: INDEX_KIND[entry.ref.kind] ?? entry.ref.kind
        };
    }
    return index;
}
