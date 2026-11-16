import type { ClientTextKey, ClientTexts } from '../../utils/client-text';
import { t } from './i18n';

/**
 * Locale key of each client text and its placeholders. The locale strings
 * use `{{name}}`; the client gets `{name}` back and fills it itself.
 */
const LOCALE_KEYS: Readonly<Record<ClientTextKey, readonly [string, ...string[]]>> = {
    'source-code': ['source-code'],
    'show-all-lines': ['show-all-lines', 'count'],
    'show-less': ['show-less'],
    'search-start': ['search-start'],
    'search-unavailable': ['search-unavailable'],
    'search-no-results': ['search-no-results', 'query'],
    'facet-kind': ['kind'],
    'facet-library': ['library'],
    'facet-feature': ['feature'],
    'facet-more': ['facet-more', 'count'],
    'reset-filters': ['reset-filters'],
    shortcuts: ['keyboard-shortcuts'],
    'shortcuts-navigation': ['navigation'],
    'shortcuts-page': ['page'],
    'shortcuts-search': ['search'],
    'previous-entity': ['previous-entity'],
    'next-entity': ['next-entity'],
    'next-member': ['next-member'],
    'previous-member': ['previous-member'],
    'open-search': ['open-search'],
    'this-dialog': ['this-dialog'],
    'version-label': ['version-label', 'label'],
    'versions-loading': ['versions-loading'],
    'versions-none': ['versions-none'],
    'versions-file': ['versions-file'],
    'versions-showing': ['versions-showing', 'shown', 'total'],
    'versions-manifest': ['versions-manifest'],
    'dom-tree': ['dom-tree']
};

/** The client texts in the page language. */
export const clientTexts = (): ClientTexts =>
    Object.fromEntries(
        Object.entries(LOCALE_KEYS).map(([key, [localeKey, ...vars]]) => [
            key,
            t(localeKey, Object.fromEntries(vars.map(name => [name, `{${name}}`])))
        ])
    ) as ClientTexts;

/** `body[data-cdx-text]`: the client texts as JSON. */
export const clientTextAttribute = (): string => JSON.stringify(clientTexts());
