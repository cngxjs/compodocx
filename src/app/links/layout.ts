/**
 * The output layout: which folder and file every page lives in, and how a
 * link from one page reaches another. The only module that knows a folder
 * name. It imports nothing, so the browser bundle shares it.
 */

export type SymbolKind =
    | 'component'
    | 'directive'
    | 'injectable'
    | 'token'
    | 'pipe'
    | 'class'
    | 'interface'
    | 'guard'
    | 'interceptor'
    | 'entity'
    | 'resolver'
    | UtilityKind;

/** The kinds the Utilities chapter lists. */
export type UtilityKind = 'function' | 'variable' | 'typealias' | 'enumeration';

/**
 * Every symbol kind has a page of its own; `provider` is the page of a
 * provider without a feature type (a function or constant in the engine).
 */
export type PageKind = SymbolKind | 'provider';

export const KIND_FOLDER = {
    component: 'components',
    directive: 'directives',
    injectable: 'injectables',
    pipe: 'pipes',
    class: 'classes',
    interface: 'interfaces',
    guard: 'guards',
    interceptor: 'interceptors',
    entity: 'entities',
    token: 'tokens',
    resolver: 'resolvers',
    function: 'functions',
    variable: 'variables',
    typealias: 'typealiases',
    enumeration: 'enumerations',
    provider: 'providers'
} as const satisfies Record<PageKind, string>;

export const BUCKET_FOLDER = 'categories';

/** Depth of the pages at the output root. */
export const ROOT_DEPTH = 0;

const UTILITY_KINDS: ReadonlySet<string> = new Set<UtilityKind>([
    'function',
    'variable',
    'typealias',
    'enumeration'
]);

export const isPageKind = (kind: string): kind is PageKind =>
    Object.keys(KIND_FOLDER).includes(kind);

export const isUtilityKind = (kind: string): kind is UtilityKind => UTILITY_KINDS.has(kind);

/** The `hrefPrefix` of a kind: its folder. */
export const kindHrefPrefix = (kind: PageKind): string => KIND_FOLDER[kind];

const last = (items: readonly string[]): string => items[items.length - 1] ?? '';

export type PageTarget =
    | {
          readonly type: 'symbol';
          readonly kind: PageKind;
          readonly name: string;
          /** Page name of a same-name copy (`Todo-1`); used when set. */
          readonly duplicateName?: string;
      }
    /** The page of a feature type with its providers and feature functions. */
    | { readonly type: 'cluster'; readonly name: string }
    /** A top-level page: index, overview, routes, coverage, app-config, references, ... */
    | { readonly type: 'root'; readonly page: string }
    | { readonly type: 'bucket'; readonly segments: readonly string[] }
    | {
          readonly type: 'additional';
          readonly folder: string;
          /** Slugs of the ancestors and the page itself; the last one is the file name. */
          readonly slugs: readonly string[];
      }
    /** A file below the output root: styles, scripts, versions.json, pagefind. */
    | { readonly type: 'asset'; readonly path: string };

export interface PageLocation {
    /** Folder below the output root, `''` for the root. */
    readonly path: string;
    /** File name without `.html`. */
    readonly filename: string;
    /** Folder depth below the output root. */
    readonly depth: number;
}

export interface Href {
    /** Root-relative path of the target file. */
    readonly path: string;
    readonly anchor?: string;
    /** Depth of the page the link is rendered on. */
    readonly fromDepth: number;
}

/**
 * How a link climbs back to the output root:
 * - `relative`: `./` at depth 0, `../` per level otherwise.
 * - `description`: as `relative` up to depth 5, nothing deeper.
 * - `bare`: nothing at depth 0, `../` per level otherwise.
 */
export type PrefixStyle = 'relative' | 'description' | 'bare';

export const relativePrefix = (depth: number, style: PrefixStyle = 'relative'): string => {
    if (depth === 0) {
        return style === 'bare' ? '' : './';
    }
    if (style === 'description' && !(depth >= 1 && depth <= 5)) {
        return '';
    }
    return '../'.repeat(depth);
};

const joinPath = (folder: string, file: string): string => (folder ? `${folder}/${file}` : file);

/** Where a page is written. */
export const pageLocation = (target: PageTarget): PageLocation => {
    switch (target.type) {
        case 'symbol':
            return {
                path: KIND_FOLDER[target.kind],
                filename: target.duplicateName ?? target.name,
                depth: 1
            };
        case 'cluster':
            return { path: KIND_FOLDER.provider, filename: target.name, depth: 1 };
        case 'root':
            return { path: '', filename: target.page, depth: ROOT_DEPTH };
        case 'bucket': {
            const parents = target.segments.slice(0, -1);
            return {
                path: parents.length > 0 ? `${BUCKET_FOLDER}/${parents.join('/')}` : BUCKET_FOLDER,
                filename: last(target.segments),
                depth: target.segments.length
            };
        }
        case 'additional': {
            const filename = last(target.slugs);
            const nested = target.slugs.map(slug => `/${slug}`).join('');
            return {
                path: `${target.folder}${nested}`.replace(`/${filename}`, ''),
                filename,
                depth: target.slugs.length
            };
        }
        case 'asset': {
            const slash = target.path.lastIndexOf('/');
            return {
                path: slash === -1 ? '' : target.path.slice(0, slash),
                filename: target.path.slice(slash + 1),
                depth: target.path.split('/').length - 1
            };
        }
    }
};

/** File path of page `filename` in `folder` (`''` for none). */
export const pageFile = (folder: string, filename: string): string =>
    joinPath(folder, `${filename}.html`);

/** Root-relative file path of a page location. */
export const pagePath = (location: PageLocation): string =>
    pageFile(location.path, location.filename);

export const hrefFor = (target: PageTarget, fromDepth: number, anchor?: string): Href => {
    if (target.type === 'asset') {
        return { path: target.path, anchor, fromDepth };
    }
    return { path: pagePath(pageLocation(target)), anchor, fromDepth };
};

const safeAnchorPart = (text: string): string =>
    text.replaceAll('#', '').replace(/[^A-Za-z0-9_$.:-]/g, '-');

/**
 * The element id of a member section: the member name with `#` dropped and
 * any other character outside `[A-Za-z0-9_$.:-]` replaced by `-`. A page that
 * documents several symbols namespaces it with the owner (`<owner>--<member>`).
 * A member without a name (call signature) has no id.
 */
export function memberAnchor(member: string, owner?: string): string;
export function memberAnchor(member: string | undefined, owner?: string): string | undefined;
export function memberAnchor(member: string | undefined, owner?: string): string | undefined {
    if (typeof member !== 'string') {
        return undefined;
    }
    return owner ? `${safeAnchorPart(owner)}--${safeAnchorPart(member)}` : safeAnchorPart(member);
}

/** The `href` string: prefix, path and `#anchor`. */
export const hrefText = (href: Href, style: PrefixStyle = 'relative'): string =>
    `${relativePrefix(href.fromDepth, style)}${href.path}${href.anchor ? `#${href.anchor}` : ''}`;

const FOLDER_KIND: ReadonlyMap<string, PageKind> = new Map(
    Object.entries(KIND_FOLDER).map(([kind, folder]) => [folder, kind as PageKind])
);

/** The symbol kind whose folder a root-relative path starts with. */
export const kindOfPath = (path: string): PageKind | undefined =>
    FOLDER_KIND.get(path.replace(/^(\.\.?\/)+/, '').split('/')[0]);
