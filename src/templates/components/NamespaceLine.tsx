import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import { hrefFor, hrefText } from '../../app/links/layout';
import { placedLink } from '../../app/links/resolve';
import { entryInFile, lookupEntry } from '../../app/links/symbol-table';
import { t } from '../helpers';

/** The engine fields the line reads. */
interface ScopedItem {
    readonly file?: unknown;
    readonly namespace?: unknown;
    readonly augments?: unknown;
}

/** Link to the page of namespace `name`, the declaring file's own entry first. */
const namespaceHref = (
    name: string,
    file: string | undefined,
    depth: number
): string | undefined => {
    const { symbols, di } = Configuration.mainData;
    if (!symbols) {
        return undefined;
    }
    const entry =
        entryInFile(symbols, 'namespace', name, file) ??
        lookupEntry(symbols, name, 'doc-link', 'namespace');
    const link = entry && placedLink(symbols, entry, di);
    return link ? hrefText(hrefFor(link.target, depth, link.anchor)) : undefined;
};

/**
 * The hero line of a namespace member (`Namespace Bridge`, linked to the
 * namespace page) or of a module augmentation member (`Augments vitest`).
 * Empty for any other symbol.
 */
export const NamespaceLine = (props: { readonly item: ScopedItem; readonly depth: number }) => {
    const { item, depth } = props;
    if (typeof item.augments === 'string' && item.augments) {
        return (
            <p class="cdx-entity-hero-namespace" data-cdx-augments={item.augments}>
                {t('augments')} <code>{Html.escapeHtml(item.augments) as string}</code>
            </p>
        ) as string;
    }
    if (typeof item.namespace !== 'string' || !item.namespace) {
        return '';
    }
    const file = typeof item.file === 'string' ? item.file : undefined;
    const href = namespaceHref(item.namespace, file, depth);
    const name = <code>{item.namespace}</code>;
    return (
        <p class="cdx-entity-hero-namespace" data-cdx-namespace={item.namespace}>
            {t('namespace')} {href ? <a href={href}>{name}</a> : name}
        </p>
    ) as string;
};
