import {
    hrefFor,
    hrefText,
    type PageTarget,
    pageLocation,
    pagePath,
    type SymbolKind
} from '../../../src/app/links/layout';

/**
 * Output paths for assertions, built on the page layout so tests do not spell
 * out folder names. The literal format is pinned in layout-contract.spec.ts.
 */
export interface PageOptions {
    /** Page name of a same-name copy, e.g. `Todo-1`. */
    readonly duplicate?: string;
    /** The detail page of a tagged miscellaneous symbol. */
    readonly detail?: boolean;
}

const symbolTarget = (kind: SymbolKind, name: string, opts: PageOptions = {}): PageTarget => ({
    type: 'symbol',
    kind,
    name,
    duplicateName: opts.duplicate,
    detail: opts.detail
});

/** Root-relative page file of a symbol, e.g. `components/Foo.html`. */
export const pageOf = (kind: SymbolKind, name: string, opts?: PageOptions): string =>
    pagePath(pageLocation(symbolTarget(kind, name, opts)));

/** Link to a symbol from a page at `fromDepth`, e.g. `../components/Foo.html`. */
export const hrefTo = (
    kind: SymbolKind,
    name: string,
    fromDepth: number,
    opts?: PageOptions
): string => hrefText(hrefFor(symbolTarget(kind, name, opts), fromDepth));

/** Root-relative collection anchor of a miscellaneous symbol. */
export const miscAnchor = (kind: SymbolKind, name: string): string =>
    hrefText(hrefFor(symbolTarget(kind, name), 0), 'bare');

/** Root-relative file of a top-level page, e.g. `coverage.html`. */
export const rootPage = (page: string): string => pagePath(pageLocation({ type: 'root', page }));

/** Root-relative file of a bucket landing page. */
export const bucketPage = (segments: readonly string[]): string =>
    pagePath(pageLocation({ type: 'bucket', segments }));
