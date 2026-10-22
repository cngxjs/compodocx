import { isErr, type Result } from '../../lib';
import { detectAiGeneratedMarker } from '../../utils/ai-generated.util';
import { COMPODOC_DEFAULTS } from '../../utils/defaults';
import type { AdditionalAlias } from '../interfaces/main-data.interface';
import type { PageInterface } from '../interfaces/page.interface';
import { type PageLocation, pagePath } from '../links/layout';
import type {
    ResolvedAdditionalGroup,
    ResolvedAdditionalPage,
    ResolvedAdditionalPages
} from './additional-page-resolver';

/** Content of a page file: the rendered HTML and the Markdown as written. */
export interface AdditionalPageContent {
    readonly html: string;
    readonly raw: string;
}

/** A page whose file could not be read. */
export interface SkippedAdditionalPage {
    readonly nodePath: string;
    readonly file: string;
}

export interface AdditionalPageTree {
    /** Depth-1 pages in sidebar order, the deeper pages in their `children`. */
    readonly pages: PageInterface[];
    /** Redirects of the aliases of the pages that are written. */
    readonly aliases: AdditionalAlias[];
    readonly skipped: SkippedAdditionalPage[];
}

export const skippedPageMessage = (page: SkippedAdditionalPage): string =>
    `Additional pages: summary.json${page.nodePath} (${page.file}) not found, page skipped`;

const GROUP_CONTEXT = 'additional-group';

/** True for a sidebar group of the additional pages: no page, only `children`. */
export const isAdditionalGroup = (page: PageInterface): boolean => page.context === GROUP_CONTEXT;

/** Node path of the top-level summary node of `nodePath` (`[2]`, `.children[2]`). */
const rootOf = (nodePath: string): string => nodePath.slice(0, nodePath.indexOf(']') + 1);

const rootIndexOf = (root: string): number => Number(root.slice(root.indexOf('[') + 1, -1));

const groupOf = (group: ResolvedAdditionalGroup): PageInterface => ({
    name: group.label,
    ...(group.title !== group.label && { displayName: group.title }),
    id: group.segments.join('/'),
    context: GROUP_CONTEXT,
    depth: 1,
    children: []
});

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
 * path. A page whose file cannot be read is skipped with its aliases. Each
 * top-level summary node gives one entry: its page, or a group when it has no
 * page (no file, or a missing one); a group without pages below it is left
 * out. A page deeper than 1 is stored in the children of the entry of its
 * top-level node.
 */
export const buildAdditionalPages = (
    resolved: ResolvedAdditionalPages,
    read: (file: string) => Result<AdditionalPageContent>,
    locate: (segments: readonly string[]) => PageLocation
): AdditionalPageTree => {
    const entries = new Map<string, PageInterface>(
        resolved.groups.map(group => [rootOf(group.nodePath), groupOf(group)])
    );
    const aliases: AdditionalAlias[] = [];
    const skipped: SkippedAdditionalPage[] = [];
    for (const resolvedPage of resolved.pages) {
        const root = rootOf(resolvedPage.nodePath);
        const content = read(resolvedPage.file);
        if (isErr(content)) {
            skipped.push({ nodePath: resolvedPage.nodePath, file: resolvedPage.file });
            if (resolvedPage.depth === 1) {
                entries.set(root, groupOf(resolvedPage));
            }
            continue;
        }
        for (const alias of resolvedPage.aliases) {
            aliases.push({
                from: pagePath(locate(alias.split('/'))),
                to: pagePath(locate(resolvedPage.segments)),
                title: resolvedPage.title
            });
        }
        const page = pageOf(resolvedPage, content.value, locate(resolvedPage.segments));
        if (resolvedPage.depth === 1) {
            entries.set(root, page);
        } else {
            entries.get(root).children.push(page);
        }
    }
    const pages = [...entries]
        .sort(([a], [b]) => rootIndexOf(a) - rootIndexOf(b))
        .map(([, entry]) => entry)
        .filter(entry => !isAdditionalGroup(entry) || entry.children.length > 0);
    return { pages, aliases, skipped };
};
