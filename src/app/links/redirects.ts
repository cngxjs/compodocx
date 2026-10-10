import * as path from 'node:path';
import { type DiView, placementOf } from '../di/model';
import { hrefFor, pageLocation, pagePath, relativePrefix } from './layout';
import {
    type LegacyPlacement,
    legacyCollectionPaths,
    legacyFeaturePaths,
    legacyNames,
    legacyPaths
} from './legacy-paths';
import { placedLink } from './resolve';
import type { SymbolTable } from './symbol-table';

/** Old root-relative page path (anchor allowed) -> current path (anchor allowed). */
export type Redirects = Readonly<Record<string, string>>;

export const REDIRECTS_SCHEMA_VERSION = 1 as const;

/** The `redirects.json` written next to the pages of a version. */
export interface RedirectsFile {
    readonly schemaVersion: typeof REDIRECTS_SCHEMA_VERSION;
    readonly redirects: Redirects;
}

export interface RedirectInput {
    readonly table: SymbolTable;
    readonly di?: DiView;
    /** Page segments of every feature. */
    readonly features: Iterable<readonly string[]>;
    /** Current pages; an old path that is a current page is not redirected. */
    readonly pages: ReadonlySet<string>;
    /** Whether the utilities landing page exists (target of old collection pages). */
    readonly utilities?: string;
}

const legacyPlacement = (di: DiView | undefined, entry: Parameters<typeof placementOf>[1]) => {
    const type = placementOf(di, entry).type;
    return (
        ['own', 'provider', 'cluster-owner'].includes(type) ? type : 'other'
    ) as LegacyPlacement;
};

const withHref = (target: ReturnType<typeof hrefFor>): string =>
    `${target.path}${target.anchor ? `#${target.anchor}` : ''}`;

/**
 * Where every page of earlier layouts went: symbol pages to where the symbol
 * is documented now (its page, or its section on a cluster page), feature and
 * bucket pages to the feature page, collection pages to the utilities groups.
 * The first symbol to claim an old path keeps it; current pages are never keys.
 */
export const buildRedirects = (input: RedirectInput): Redirects => {
    const redirects = new Map<string, string>();
    const add = (from: string, to: string): void => {
        const page = from.split('#')[0];
        if (
            from !== to &&
            !input.pages.has(from) &&
            !input.pages.has(page) &&
            !redirects.has(from)
        ) {
            redirects.set(from, to);
        }
    };
    const names = legacyNames(input.table);
    for (const entry of input.table.byId.values()) {
        const link = placedLink(input.table, entry, input.di);
        if (!link) {
            continue;
        }
        const to = withHref(hrefFor(link.target, 0, link.anchor));
        const oldName = names.get(entry.id) ?? entry.ref.name;
        for (const from of legacyPaths(entry, oldName, legacyPlacement(input.di, entry.id))) {
            add(from, to);
        }
    }
    for (const segments of input.features) {
        const to = pagePath(pageLocation({ type: 'feature', segments }));
        for (const from of legacyFeaturePaths(segments)) {
            add(from, to);
        }
    }
    if (input.utilities) {
        for (const { path: from, group } of legacyCollectionPaths()) {
            add(from, `${input.utilities}#${group}`);
        }
    }
    return Object.fromEntries([...redirects].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
};

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#)/i;

/**
 * Hand-written links (README and additional-page markdown) that still point
 * at an old page: each `href` on the page at `page` (root-relative) that
 * resolves to a redirect key and is not a current page is pointed at the
 * page it moved to. Generated links never hit an old path.
 */
const patterns = new WeakMap<Redirects, RegExp | undefined>();

/** Matches a relative href that starts with a folder some old path starts with; built once per map. */
const legacyHrefPattern = (redirects: Redirects): RegExp | undefined => {
    if (!patterns.has(redirects)) {
        const folders = new Set(
            Object.keys(redirects).map(key => key.slice(0, Math.max(key.indexOf('/'), 0)))
        );
        folders.delete('');
        const escaped = [...folders].map(folder => folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        patterns.set(
            redirects,
            escaped.length > 0
                ? new RegExp(`\\shref="(?:\\.\\.?/)*(?:${escaped.join('|')})/`)
                : undefined
        );
    }
    return patterns.get(redirects);
};

export const rewriteLegacyLinks = (
    html: string,
    page: string,
    depth: number,
    redirects: Redirects,
    pages: ReadonlySet<string>
): string => {
    // Most pages hold no link into an old folder; leave them as they are.
    const pattern = legacyHrefPattern(redirects);
    if (!pattern?.test(html)) {
        return html;
    }
    return html.replace(
        /(\shref=")([^"]*)(")/g,
        (match, open: string, href: string, close: string) => {
            if (!href || EXTERNAL.test(href)) {
                return match;
            }
            const hash = href.indexOf('#');
            const file = hash === -1 ? href : href.slice(0, hash);
            const anchor = hash === -1 ? undefined : href.slice(hash + 1);
            let decoded = file;
            try {
                decoded = decodeURIComponent(file);
            } catch {
                // keep the raw path
            }
            const resolved = path.posix.normalize(
                path.posix.join(path.posix.dirname(page), decoded)
            );
            if (resolved.startsWith('../') || pages.has(resolved)) {
                return match;
            }
            const to =
                (anchor !== undefined && redirects[`${resolved}#${anchor}`]) || redirects[resolved];
            if (to === undefined) {
                return match;
            }
            const [toPath, toAnchor] = to.split('#');
            const keep =
                anchor !== undefined && !redirects[`${resolved}#${anchor}`] ? anchor : toAnchor;
            return `${open}${relativePrefix(depth)}${toPath}${keep ? `#${keep}` : ''}${close}`;
        }
    );
};
