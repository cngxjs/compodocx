import type { MiscKind, SymbolKind } from '../../src/app/links/layout';
import { collectionPage } from '../src/cli/paths';
import { bucketPage, miscAnchor, type PageOptions, pageOf } from '../src/helpers/pages';

/**
 * Server-absolute URLs of generated pages for `page.goto`, built on the page
 * layout so the specs do not spell out output folders.
 */

/** URL of a symbol page, e.g. `/components/Foo.html`. */
export const pageUrl = (kind: SymbolKind, name: string, opts?: PageOptions): string =>
    `/${pageOf(kind, name, opts)}`;

/** URL of a miscellaneous collection page. */
export const collectionUrl = (kind: MiscKind): string => `/${collectionPage(kind)}`;

/** URL of a miscellaneous symbol's anchor on its collection page. */
export const miscAnchorUrl = (kind: MiscKind, name: string): string => `/${miscAnchor(kind, name)}`;

/** URL of a bucket landing page. */
export const bucketUrl = (segments: readonly string[]): string => `/${bucketPage(segments)}`;
