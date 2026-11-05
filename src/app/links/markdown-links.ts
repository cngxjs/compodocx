import * as path from 'node:path';
import { relativePrefix } from './layout';

/**
 * Markdown files that have a page: absolute source file (posix separators,
 * normalized) -> root-relative page path.
 */
export type MarkdownPages = ReadonlyMap<string, string>;

export interface MarkdownLinkSource {
    /** Absolute path of the Markdown file the HTML was rendered from (posix separators). */
    readonly file: string;
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
 * listed in `missing`. External links and `#anchor` links are untouched.
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
            const base = file.startsWith('/') ? source.root : path.posix.dirname(source.file);
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

/** The warning for a `.md` link without a page; paths as the caller shows them. */
export const missingMarkdownPageMessage = (page: string, target: string): string =>
    `${page}: link to ${target} has no additional page`;
