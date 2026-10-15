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
 * provider without a feature type (a function or constant in the engine),
 * `style` the page of a free-standing style file.
 */
export type PageKind = SymbolKind | 'provider' | 'style';

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
    provider: 'providers',
    style: 'stylesheets'
} as const satisfies Record<PageKind, string>;

/** The redirect map of a version, next to its pages (old page path -> current page path). */
export const REDIRECTS_FILE = 'redirects.json';

/** File name of a feature page inside the feature's folder. */
const FEATURE_INDEX = 'index';

/**
 * Folders the output root already holds (assets, additional pages, search
 * index); a feature folder never takes one of these names.
 */
export const RESERVED_ROOT_FOLDERS: readonly string[] = [
    'additional-documentation',
    'assets',
    'images',
    'js',
    'pagefind',
    'styles'
];

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

const last = (items: readonly string[]): string => items[items.length - 1] ?? '';

export type PageTarget =
    | {
          readonly type: 'symbol';
          readonly kind: PageKind;
          readonly name: string;
          /** Folder segments: the symbol's feature (`symbolFolder` without one). */
          readonly folder: readonly string[];
          /** File name without `.html`, unique in its folder (`folderFileNames`). */
          readonly file: string;
      }
    /** The page of a feature type with its providers and feature functions. */
    | {
          readonly type: 'cluster';
          readonly name: string;
          readonly folder: readonly string[];
          readonly file: string;
      }
    /** A top-level page: index, overview, routes, coverage, app-config, references, ... */
    | { readonly type: 'root'; readonly page: string }
    /** The page of a feature, `index` in its folder: import path segments (scope dropped), then the key. */
    | { readonly type: 'feature'; readonly segments: readonly string[] }
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

/** The folder of a symbol page without a feature (no semantic facts): its kind folder. */
export const symbolFolder = (kind: PageKind): readonly string[] => [KIND_FOLDER[kind]];

/** A page file name from a symbol name: characters outside `[A-Za-z0-9._-]` become `-`. */
export const safeFileName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, '-') || '-';

/** File names a symbol page never takes: the feature page of a folder is `index`. */
const RESERVED_FILE_NAMES: readonly string[] = ['index'];

export interface FileNameRequest {
    /** Symbol id; requests are ordered by it. */
    readonly id: string;
    readonly name: string;
    readonly kind: string;
}

/**
 * The file names of the symbol pages of one folder, by id. A name is made
 * safe (`safeFileName`); names that clash ignoring case keep the bare name
 * for the first symbol by id. Another clashing symbol gets `-<kind>` when it
 * is the only one of its kind in the clash and that kind differs from the
 * first one's, otherwise the next free `-2`, `-3`, ... `index` is reserved.
 */
export const folderFileNames = (
    requests: readonly FileNameRequest[]
): ReadonlyMap<string, string> => {
    const ordered = [...requests].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const clashes = new Map<string, FileNameRequest[]>();
    for (const request of ordered) {
        const key = safeFileName(request.name).toLowerCase();
        clashes.set(key, [...(clashes.get(key) ?? []), request]);
    }
    const taken = new Set(RESERVED_FILE_NAMES);
    const names = new Map<string, string>();
    const take = (id: string, file: string): void => {
        taken.add(file.toLowerCase());
        names.set(id, file);
    };
    for (const request of ordered) {
        const base = safeFileName(request.name);
        if (!taken.has(base.toLowerCase())) {
            take(request.id, base);
            continue;
        }
        const group = clashes.get(base.toLowerCase()) ?? [];
        const holder = group.find(other => names.get(other.id) === base);
        const sameKind = group.filter(other => other.kind === request.kind && other !== holder);
        const byKind = `${base}-${request.kind}`;
        if (
            holder?.kind !== request.kind &&
            sameKind.length === 1 &&
            !taken.has(byKind.toLowerCase())
        ) {
            take(request.id, byKind);
            continue;
        }
        let n = 2;
        while (taken.has(`${base}-${n}`.toLowerCase())) {
            n++;
        }
        take(request.id, `${base}-${n}`);
    }
    return names;
};

/** Folder depth of a root-relative folder path (`''` for the root). */
export const folderDepth = (path: string): number =>
    path === '' ? ROOT_DEPTH : path.split('/').length;

const located = (path: string, filename: string): PageLocation => ({
    path,
    filename,
    depth: folderDepth(path)
});

/** Where a page is written. Its depth follows from the folder path. */
export const pageLocation = (target: PageTarget): PageLocation => {
    switch (target.type) {
        case 'symbol':
        case 'cluster':
            return located(target.folder.join('/'), target.file);
        case 'root':
            return located('', target.page);
        case 'feature':
            return located(target.segments.join('/'), FEATURE_INDEX);
        case 'additional': {
            const filename = last(target.slugs);
            const nested = target.slugs.map(slug => `/${slug}`).join('');
            return located(`${target.folder}${nested}`.replace(`/${filename}`, ''), filename);
        }
        case 'asset': {
            const slash = target.path.lastIndexOf('/');
            return located(
                slash === -1 ? '' : target.path.slice(0, slash),
                target.path.slice(slash + 1)
            );
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

/**
 * The element id of a route on the routes page, or of a router section when
 * `id` is a root index: `route-<root>[-<child index>...]`. Route node ids are
 * `<root>-<index path>` (`0-2-1`), stable within one build.
 */
export const routeAnchor = (id: string): string => `route-${id.replace(/[^0-9-]/g, '-')}`;

/** The `href` string: prefix, path and `#anchor`. */
export const hrefText = (href: Href, style: PrefixStyle = 'relative'): string =>
    `${relativePrefix(href.fromDepth, style)}${href.path}${href.anchor ? `#${href.anchor}` : ''}`;
