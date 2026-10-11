import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
    hrefFor,
    hrefText,
    type PageKind,
    type PageTarget,
    pageLocation,
    pagePath,
    relativePrefix,
    safeFileName,
    symbolFolder
} from '../../../src/app/links/layout';

/**
 * Output paths for assertions, built on the page layout so tests do not spell
 * out folder names. The literal format is pinned in layout-contract.spec.ts.
 *
 * A symbol page lives in its feature's folder. Without a feature (a table
 * built without semantic facts, as in unit tests) it lives in its kind
 * folder, which is what `pageOf` and `hrefTo` build. Suites that read a
 * generated tree resolve the folder from the output with `pagesIn`.
 */
export interface PageOptions {
    /** File name when it is not the safe name, e.g. `Todo-2` for a same-name copy. */
    readonly file?: string;
    /** Folder segments (the feature); the kind folder by default. */
    readonly folder?: readonly string[];
}

const symbolTarget = (kind: PageKind, name: string, opts: PageOptions = {}): PageTarget => ({
    type: 'symbol',
    kind,
    name,
    folder: opts.folder ?? symbolFolder(kind),
    file: opts.file ?? safeFileName(name)
});

/** Root-relative page file of a symbol, e.g. `components/Foo.html`. */
export const pageOf = (kind: PageKind, name: string, opts?: PageOptions): string =>
    pagePath(pageLocation(symbolTarget(kind, name, opts)));

/** Link to a symbol from a page at `fromDepth`, e.g. `../components/Foo.html`. */
export const hrefTo = (
    kind: PageKind,
    name: string,
    fromDepth: number,
    opts?: PageOptions
): string => hrefText(hrefFor(symbolTarget(kind, name, opts), fromDepth));

/** Root-relative file of the page of a feature type, its providers and features. */
export const clusterPage = (featureType: string, folder = symbolFolder('interface')): string =>
    pagePath(
        pageLocation({
            type: 'cluster',
            name: featureType,
            folder,
            file: safeFileName(featureType)
        })
    );

/** Root-relative file of a top-level page, e.g. `coverage.html`. */
export const rootPage = (page: string): string => pagePath(pageLocation({ type: 'root', page }));

/** Root-relative file of a feature page. */
export const featurePage = (segments: readonly string[]): string =>
    pagePath(pageLocation({ type: 'feature', segments }));

/** Kinds as the generated pages name their context (`COMPODOC_CURRENT_PAGE_CONTEXT`). */
const CONTEXT_KIND: Readonly<Record<string, PageKind>> = {
    'di-cluster': 'provider',
    miscellaneous: 'function'
};

/** A generated tree's pages, found by kind and file name. */
export interface GeneratedPages {
    /** Root-relative page of a symbol, e.g. `core/select/Foo.html`. */
    readonly of: (kind: PageKind, name: string, opts?: { readonly file?: string }) => string;
    /** Link to a symbol from a page at `fromDepth`. */
    readonly href: (
        kind: PageKind,
        name: string,
        fromDepth: number,
        opts?: { readonly file?: string }
    ) => string;
    /** Root-relative page of a feature type's cluster. */
    readonly cluster: (featureType: string) => string;
    /** Depth of a root-relative page path. */
    readonly depthOf: (page: string) => number;
}

const walk = (root: string, dir = root, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            walk(root, full, out);
        } else if (name.endsWith('.html')) {
            out.push(relative(root, full).split('\\').join('/'));
        }
    }
    return out;
};

/**
 * The pages of the tree generated into `dir`, indexed lazily on first use
 * (suites call it before their `beforeAll` writes the tree). A page is
 * found by its file name and the kind its context names; a file name more
 * than one feature holds needs `file` or fails loudly.
 */
export const pagesIn = (dir: string): GeneratedPages => {
    let index: Map<string, string[]> | undefined;
    const pages = (): Map<string, string[]> => {
        if (!index) {
            index = new Map();
            for (const page of walk(dir)) {
                const html = readFileSync(join(dir, page), 'utf8');
                const context = /COMPODOC_CURRENT_PAGE_CONTEXT = '([^']*)'/.exec(html)?.[1];
                if (!context) {
                    continue;
                }
                const kind = CONTEXT_KIND[context] ?? context;
                const file = page.slice(page.lastIndexOf('/') + 1, -'.html'.length);
                const key = `${kind}:${file}`;
                index.set(key, [...(index.get(key) ?? []), page]);
            }
        }
        return index;
    };
    const of = (kind: PageKind, name: string, opts: { readonly file?: string } = {}): string => {
        const file = opts.file ?? safeFileName(name);
        const found = pages().get(`${kind}:${file}`) ?? [];
        if (found.length !== 1) {
            throw new Error(
                `${found.length} ${kind} pages named ${file}.html in ${dir}${found.length ? `: ${found.join(', ')}` : ''}`
            );
        }
        return found[0];
    };
    return {
        of,
        href: (kind, name, fromDepth, opts) =>
            `${relativePrefix(fromDepth)}${of(kind, name, opts)}`,
        cluster: featureType => of('provider', featureType),
        depthOf: page => page.split('/').length - 1
    };
};
