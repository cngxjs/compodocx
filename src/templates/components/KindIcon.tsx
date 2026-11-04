import Html from '@kitajs/html';
import type { TableKind } from '../../app/links/symbol-id';
import { KIND_LETTER } from '../helpers/pagefind-meta';

/**
 * The letter icon of a symbol kind (`F`, `If`, `Ns`), coloured by kind.
 * Decorative: the caller names the kind in text where it matters; `title`
 * names it on hover.
 */
export const KindIcon = (kind: TableKind, title?: string): string =>
    (
        <span
            class={`cdx-ref-kind-icon cdx-ref-kind-icon--${kind}`}
            aria-hidden="true"
            title={title}
        >
            {KIND_LETTER[kind] ?? '?'}
        </span>
    ) as string;
