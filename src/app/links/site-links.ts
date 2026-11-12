import { relativePrefix } from './layout';
import type { Redirects } from './redirects';

export interface SiteLinkOptions {
    /** Root URL of the published docs site, with a trailing slash; `''` turns the rewrite off. */
    readonly siteUrl: string;
    /** Folder depth of the page the HTML is written to. */
    readonly depth: number;
}

export interface SiteLinkResult {
    readonly html: string;
    /** Site links whose page this build does not have, as written, in document order. */
    readonly missing: readonly string[];
}

const decoded = (file: string): string => {
    try {
        return decodeURIComponent(file);
    } catch {
        return file;
    }
};

const attributeText = (href: string): string => href.replace(/&/g, '&amp;');

/** Index of the first `?` or `#`, the length without either. */
const suffixStart = (rest: string): number => {
    const found = [rest.indexOf('?'), rest.indexOf('#')].filter(index => index !== -1);
    return found.length === 0 ? rest.length : Math.min(...found);
};

/**
 * Root-relative paths a site path may name: the path itself, then the path
 * without its first folder (the version folder of a versioned site).
 */
const candidatesOf = (file: string): string[] => {
    const page = file === '' || file.endsWith('/') ? `${file}index.html` : file;
    const slash = page.indexOf('/');
    return slash === -1 ? [page] : [page, page.slice(slash + 1)];
};

/**
 * Links to the published docs site made to stay in the version being
 * built: each `href` that starts with `siteUrl` is looked up among the pages
 * of this build (or the old page paths of `redirects`), first as written
 * after `siteUrl`, then without its first folder, so `main/x/`, `v1.2.0/x/`
 * and `x/` reach the same page without a list of version labels. A folder
 * link names its `index.html`. A found page is linked relative to the page
 * depth, query and anchor kept; a link without a page stays as written and
 * is listed in `missing`. Other links are untouched.
 */
export const rewriteSiteLinks = (
    html: string,
    options: SiteLinkOptions,
    pages: ReadonlySet<string>,
    redirects: Redirects
): SiteLinkResult => {
    const { siteUrl, depth } = options;
    const missing: string[] = [];
    if (siteUrl === '') {
        return { html, missing };
    }
    const hasPage = (file: string): boolean => pages.has(file) || Object.hasOwn(redirects, file);
    const rewritten = html.replace(
        /(<a\s[^>]*?href=")([^"]*)(")/g,
        (match, open: string, href: string, close: string) => {
            const url = href.replace(/&amp;/g, '&');
            if (!url.startsWith(siteUrl)) {
                return match;
            }
            const rest = url.slice(siteUrl.length);
            const end = suffixStart(rest);
            const page = candidatesOf(decoded(rest.slice(0, end))).find(hasPage);
            if (page === undefined) {
                missing.push(url);
                return match;
            }
            return `${open}${attributeText(`${relativePrefix(depth)}${page}${rest.slice(end)}`)}${close}`;
        }
    );
    return { html: rewritten, missing };
};

/** A site link without a page in this build. */
export interface MissingSiteLink {
    /** Page the link is on, root-relative. */
    readonly source: string;
    /** The link as written. */
    readonly target: string;
}

export interface MissingSiteLinksReport {
    /** The count line, logged as a warning. */
    readonly summary: string;
    /** One indented `source: target` line per link, listed with `--verbose`. */
    readonly details: readonly string[];
}

/**
 * The build notice for site links without a page: a count line, then one
 * line per link, sorted by source, then target. The same link (source and
 * target) counts once. Undefined without links.
 */
export const missingSiteLinksReport = (
    links: Iterable<MissingSiteLink>
): MissingSiteLinksReport | undefined => {
    const unique = new Map<string, MissingSiteLink>();
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
            ? '1 link to a page this build does not have (--verbose lists it)'
            : `${sorted.length} links to pages this build does not have (--verbose lists them)`;
    return {
        summary: `Site links: ${counted}`,
        details: sorted.map(item => `  ${item.source}: ${item.target}`)
    };
};
