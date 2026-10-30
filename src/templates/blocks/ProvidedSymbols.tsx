import Html from '@kitajs/html';
import type { SymbolKey } from '../../app/compiler/semantic/model';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import { symbolId, type TableKind } from '../../app/links/symbol-id';
import type { SymbolTable } from '../../app/links/symbol-table';
import { t } from '../helpers';

/** Kinds a provider provides, in display order, with the label of their line. */
const PROVIDED_KINDS: ReadonlyArray<{ readonly kind: TableKind; readonly label: string }> = [
    { kind: 'token', label: 'tokens' },
    { kind: 'service', label: 'services' },
    { kind: 'injectable', label: 'injectables' }
];

/** Links to the token, service and injectable pages a provider provides, one line per kind. */
export const ProvidedSymbols = (
    keys: readonly SymbolKey[],
    table: SymbolTable,
    depth: number
): string =>
    PROVIDED_KINDS.map(({ kind, label }) => {
        const links = keys
            .map(key => table.byId.get(symbolId({ kind, file: key.file, name: key.name })))
            .flatMap(entry => {
                const link = entry && placedLink(table, entry, Configuration.mainData.di);
                return entry && link
                    ? [
                          (
                              <a href={hrefText(hrefFor(link.target, depth, link.anchor))}>
                                  <code>{entry.ref.name}</code>
                              </a>
                          ) as string
                      ]
                    : [];
            });
        return links.length > 0
            ? ((
                  <p class="cdx-di-provided-tokens">
                      {t(label)}: {links.join(', ')}
                  </p>
              ) as string)
            : '';
    }).join('');
