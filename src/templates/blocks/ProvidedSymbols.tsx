import type { SymbolKey } from '../../app/compiler/semantic/model';
import Configuration from '../../app/configuration';
import type { SymbolTable } from '../../app/links/symbol-table';
import { t } from '../helpers';
import { factKeyEntries } from '../helpers/used-by';
import { SymbolChips } from './ReferencedBySection';

/** Kinds a provider provides; other symbols with the same key are not linked. */
const PROVIDED_KINDS: ReadonlySet<string> = new Set(['token', 'service', 'injectable']);

/**
 * The tokens, services and injectables a provider provides, as the same
 * headed chip list as Provided by, Injected by and Used by (`id="provides"`),
 * each chip coloured by its kind.
 */
export const ProvidedSymbols = (
    keys: readonly SymbolKey[],
    table: SymbolTable,
    depth: number
): string =>
    SymbolChips({
        entries: factKeyEntries(
            {
                symbols: table,
                semantic: Configuration.mainData.semantic,
                di: Configuration.mainData.di
            },
            keys
        ).filter(entry => PROVIDED_KINDS.has(entry.kind)),
        depth,
        id: 'provides',
        title: t('provides'),
        className: 'cdx-di-provides',
        block: 'provides'
    });
