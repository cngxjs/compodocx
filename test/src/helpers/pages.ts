import {
    hrefFor,
    hrefText,
    type PageKind,
    type PageTarget,
    pageLocation,
    pagePath
} from '../../../src/app/links/layout';

/**
 * Output paths for assertions, built on the page layout so tests do not spell
 * out folder names. The literal format is pinned in layout-contract.spec.ts.
 */
export interface PageOptions {
    /** Page name of a same-name copy, e.g. `Todo-1`. */
    readonly duplicate?: string;
}

const symbolTarget = (kind: PageKind, name: string, opts: PageOptions = {}): PageTarget => ({
    type: 'symbol',
    kind,
    name,
    duplicateName: opts.duplicate
});

/** Root-relative page file of a symbol, e.g. `components/Foo.html`. */
export const pageOf = (kind: PageKind, name: string, opts?: PageOptions): string =>
    pagePath(pageLocation(symbolTarget(kind, name, opts)));

/** Link to a symbol from a page at `fromDepth`, e.g. `../components/Foo.html`. */
export const hrefTo = (
    kind: PageKind,
    name: string,
    fromDepth: number,
    opts?: PageOptions
): string => hrefText(hrefFor(symbolTarget(kind, name, opts), fromDepth));

/** Root-relative file of the page of a feature type, its providers and features. */
export const clusterPage = (featureType: string): string =>
    pagePath(pageLocation({ type: 'cluster', name: featureType }));

/** Root-relative file of a top-level page, e.g. `coverage.html`. */
export const rootPage = (page: string): string => pagePath(pageLocation({ type: 'root', page }));

/** Root-relative file of a feature page. */
export const featurePage = (segments: readonly string[]): string =>
    pagePath(pageLocation({ type: 'feature', segments }));

/** Root-relative file of a bucket landing page. */
export const bucketPage = (segments: readonly string[]): string =>
    pagePath(pageLocation({ type: 'bucket', segments }));
