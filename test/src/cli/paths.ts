import {
    hrefFor,
    hrefText,
    type MiscKind,
    pageLocation,
    pagePath
} from '../../../src/app/links/layout';

/** Root-relative file of a miscellaneous collection page, e.g. the functions page. */
export const collectionPage = (kind: MiscKind): string =>
    pagePath(pageLocation({ type: 'misc-collection', kind }));

/** Link to a miscellaneous collection page from a page at `fromDepth`. */
export const collectionHref = (kind: MiscKind, fromDepth: number): string =>
    hrefText(hrefFor({ type: 'misc-collection', kind }, fromDepth));
