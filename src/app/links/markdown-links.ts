import * as path from 'node:path';
import { relativePrefix } from './layout';

/**
 * Markdown files that have a page: absolute source file (posix separators,
 * normalized) -> root-relative page path.
 */
export type MarkdownPages = ReadonlyMap<string, string>;

export interface MarkdownLinkSource {
    /**
     * Absolute path of the file the HTML was rendered from (posix separators):
     * a Markdown file, or the TypeScript file of a symbol whose JSDoc and
     * neighbour README the page shows. Without one (a page shown from several
     * files) only root-absolute links are resolved.
     */
    readonly file?: string;
    /** Folder a root-absolute link (`/guides/x.md`) is resolved against (posix separators). */
    readonly root: string;
    /** Folder depth of the page the HTML is written to. */
    readonly depth: number;
}

export interface MarkdownLinkResult {
    readonly html: string;
    /** Absolute targets of `.md` links that have no page, in document order. */
    readonly missing: readonly string[];
}

/** A path with posix separators, for keys and sources of `MarkdownPages`. */
export const toPosix = (file: string): string => file.replace(/\\/g, '/');

const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;
const MD_FILE = /\.md$/i;

const decoded = (file: string): string => {
    const unescaped = file.replace(/&amp;/g, '&');
    try {
        return decodeURIComponent(unescaped);
    } catch {
        return unescaped;
    }
};

const attributeText = (href: string): string => href.replace(/&/g, '&amp;');

/**
 * Links between Markdown pages made to work in the output: each relative
 * `href` ending in `.md` (anchor and `%`-encoding allowed) is resolved
 * against the folder of the source file, a root-absolute one (`/...`)
 * against `root`. A target with a page points at that page, relative to the
 * page depth, anchor kept; a target without one is left as written and
 * listed in `missing`. External links and `#anchor` links are untouched, so
 * are relative links when the source has no file.
 */
export const rewriteMarkdownLinks = (
    html: string,
    source: MarkdownLinkSource,
    pages: MarkdownPages
): MarkdownLinkResult => {
    const missing: string[] = [];
    const rewritten = html.replace(
        /(<a\s[^>]*?href=")([^"]*)(")/g,
        (match, open: string, href: string, close: string) => {
            if (!href || SCHEME.test(href)) {
                return match;
            }
            const hash = href.indexOf('#');
            const file = decoded(hash === -1 ? href : href.slice(0, hash));
            if (!MD_FILE.test(file)) {
                return match;
            }
            const rootAbsolute = file.startsWith('/');
            if (!rootAbsolute && source.file === undefined) {
                return match;
            }
            const base = rootAbsolute ? source.root : path.posix.dirname(source.file);
            const target = path.posix.normalize(path.posix.join(base, file));
            const page = pages.get(target);
            if (page === undefined) {
                missing.push(target);
                return match;
            }
            const anchor = hash === -1 ? '' : href.slice(hash);
            return `${open}${attributeText(`${relativePrefix(source.depth)}${page}`)}${anchor}${close}`;
        }
    );
    return { html: rewritten, missing };
};

/** A `.md` link without a page; paths as the report shows them. */
export interface MissingMarkdownLink {
    /** File the link was written in. */
    readonly source: string;
    /** File the link points at. */
    readonly target: string;
}

export interface MissingMarkdownLinksReport {
    /** The count line, logged as a warning. */
    readonly summary: string;
    /** One indented `source: target` line per link, listed with `--verbose`. */
    readonly details: readonly string[];
}

/**
 * The build notice for `.md` links without a page: a count line, then one
 * line per link, sorted by source, then target. The same link (source and
 * target) counts once. Undefined without links.
 */
export const missingMarkdownLinksReport = (
    links: Iterable<MissingMarkdownLink>
): MissingMarkdownLinksReport | undefined => {
    const unique = new Map<string, MissingMarkdownLink>();
    for (const item of links) {
        unique.set(`${item.source}\0${item.target}`, item);
    }
    if (unique.size === 0) {
        return undefined;
    }
    const order = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
    const sorted = [...unique.values()].sort(
        (a, b) => order(a.source, b.source) || order(a.target, b.target)
    );
    const counted =
        sorted.length === 1
            ? '1 link to a .md file without a page (--verbose lists it)'
            : `${sorted.length} links to .md files without a page (--verbose lists them)`;
    return {
        summary: `Markdown links: ${counted}`,
        details: sorted.map(item => `  ${item.source}: ${item.target}`)
    };
};
