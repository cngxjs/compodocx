import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import Configuration from '../configuration';
import { pageLocation } from '../links/layout';
import { symbolTarget } from '../links/resolve';
import type { TableKind } from '../links/symbol-id';
import type { SymbolEntry } from '../links/symbol-table';

type FunctionalKind = Extract<TableKind, 'guard' | 'interceptor' | 'resolver'>;

/**
 * Functions and constants the table documents as guards, interceptors or
 * resolvers. The engine keeps them with the miscellaneous symbols.
 */
export const functionalEntries = (kind: FunctionalKind): SymbolEntry[] =>
    [...(Configuration.mainData.symbols?.byId.values() ?? [])].filter(
        entry =>
            entry.ref.kind === kind &&
            (entry.data as { ctype?: unknown })?.ctype === 'miscellaneous'
    );

/**
 * Queue one page per functional entry. Guard and interceptor pages read the
 * object from `injectable` (like their class-based siblings), resolvers from
 * `resolver`.
 */
export const enqueueFunctionalPages = (kind: FunctionalKind): number => {
    const entries = functionalEntries(kind);
    const dataKey = kind === 'resolver' ? 'resolver' : 'injectable';
    for (const entry of entries) {
        const location = pageLocation(symbolTarget(entry, { duplicate: true }));
        Configuration.addPage({
            path: location.path,
            name: `${kind}-${location.filename}`,
            filename: location.filename,
            id: `${kind}-${location.filename}`,
            context: kind,
            [dataKey]: entry.data,
            depth: location.depth,
            pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
        } as never);
    }
    return entries.length;
};
