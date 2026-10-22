import { detectAiGeneratedMarker } from '../../utils/ai-generated.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import type { AdditionalAlias } from '../interfaces/main-data.interface';
import type { PageInterface } from '../interfaces/page.interface';
import { type PageLocation, pagePath } from '../links/layout';
import type { ResolvedAdditionalPage } from './additional-page-resolver';

/** Content of a page file: the rendered HTML and the Markdown as written. */
export interface AdditionalPageContent {
    readonly html: string;
    readonly raw: string;
}

export interface AdditionalPageTree {
    /** Depth-1 pages in sidebar order, the deeper pages in their `children`. */
    readonly pages: PageInterface[];
    readonly aliases: AdditionalAlias[];
}

const pageOf = (
    resolved: ResolvedAdditionalPage,
    content: AdditionalPageContent,
    location: PageLocation
): PageInterface => ({
    name: resolved.label,
    ...(resolved.title !== resolved.label && { displayName: resolved.title }),
    ...(resolved.heading && { pageHeading: resolved.title }),
    id: resolved.domId,
    filename: location.filename,
    context: 'additional-page',
    path: location.path,
    additionalPage: content.html,
    additionalPageSource: {
        slug: resolved.segments.join('/'),
        file: resolved.file,
        markdown: content.raw
    },
    aiGenerated: detectAiGeneratedMarker(content.raw),
    depth: location.depth,
    childrenLength: resolved.childrenLength,
    children: [],
    lastChild: false,
    pageType: COMPODOC_DEFAULTS.PAGE_TYPES.INTERNAL
});

/**
 * Builds the page objects of the resolved additional pages (in document
 * order) and the redirects of their aliases. `read` gives the content of a
 * page file as named in summary.json, `locate` the output location of a slug
 * path. A page deeper than 1 is stored in the children of the last depth-1
 * page before it.
 */
export const buildAdditionalPages = (
    resolved: readonly ResolvedAdditionalPage[],
    read: (file: string) => AdditionalPageContent,
    locate: (segments: readonly string[]) => PageLocation
): AdditionalPageTree => {
    const pages: PageInterface[] = [];
    const aliases: AdditionalAlias[] = [];
    let lastLevelOnePage: PageInterface | undefined;
    for (const resolvedPage of resolved) {
        for (const alias of resolvedPage.aliases) {
            aliases.push({
                from: pagePath(locate(alias.split('/'))),
                to: pagePath(locate(resolvedPage.segments)),
                title: resolvedPage.title
            });
        }
        const page = pageOf(resolvedPage, read(resolvedPage.file), locate(resolvedPage.segments));
        if (resolvedPage.depth === 1) {
            lastLevelOnePage = page;
            pages.push(page);
        } else {
            lastLevelOnePage.children.push(page);
        }
    }
    return { pages, aliases };
};
