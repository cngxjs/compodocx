import type { SymbolKind } from '../../src/app/links/layout';
import {
    bucketPage,
    clusterPage,
    featurePage,
    type PageOptions,
    pageOf,
    rootPage
} from '../src/helpers/pages';

/**
 * Server-absolute URLs of generated pages for `page.goto`, built on the page
 * layout so the specs do not spell out output folders.
 */

/** URL of a symbol page, e.g. `/components/Foo.html`. */
export const pageUrl = (kind: SymbolKind, name: string, opts?: PageOptions): string =>
    `/${pageOf(kind, name, opts)}`;

/** URL of a top-level page, e.g. `/utilities.html`. */
export const rootUrl = (page: string): string => `/${rootPage(page)}`;

/** URL of a feature page. */
export const featureUrl = (segments: readonly string[]): string => `/${featurePage(segments)}`;

/** URL of a bucket landing page. */
export const bucketUrl = (segments: readonly string[]): string => `/${bucketPage(segments)}`;

/** URL of the page of a feature type with its providers and features. */
export const clusterUrl = (featureType: string): string => `/${clusterPage(featureType)}`;
