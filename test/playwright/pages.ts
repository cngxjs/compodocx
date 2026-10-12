import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { type PageKind, safeFileName } from '../../src/app/links/layout';
import { featurePage, type GeneratedPages, pagesIn, rootPage } from '../src/helpers/pages';

/**
 * Server-absolute URLs of generated pages for `page.goto`. Symbol pages live
 * in their feature's folder, so they are looked up in the docs tree the
 * running Playwright project serves instead of being spelled out here.
 *
 * Call these inside a test or hook: the project is read from `test.info()`.
 */

/** Output folder each project's webServer generates (see playwright.config.ts). */
const PROJECT_DOCS: Readonly<Record<string, string>> = {
    chrome: 'doc',
    firefox: 'doc',
    webkit: 'doc',
    todomvc: '/tmp/compodoc-todomvc',
    standalone: '/tmp/compodoc-standalone',
    'standalone-feature': '/tmp/compodoc-standalone-feature',
    semantic: '/tmp/compodoc-semantic',
    styles: '/tmp/compodoc-style',
    routing: '/tmp/compodoc-routing',
    // Specs prefix the version folder themselves (`/v2.0.0${pageUrl(...)}`).
    'multi-version': '/tmp/compodoc-multi-version/v2.0.0'
};

/** Which page of a symbol: its file name, and its folder when several features hold one. */
export interface PageUrlOptions {
    /** File name when it is not the safe name, e.g. `Todo-2` for a same-kind copy. */
    readonly file?: string;
    /** Folder segments of the feature, for a name more than one feature holds. */
    readonly folder?: readonly string[];
}

const trees = new Map<string, GeneratedPages>();

const docsDir = (): string => {
    const project = test.info().project.name;
    const dir = PROJECT_DOCS[project];
    if (!dir) {
        throw new Error(`No docs folder known for Playwright project "${project}"`);
    }
    return dir;
};

/** The generated pages of the running project. */
export const docsPages = (): GeneratedPages => {
    const dir = docsDir();
    let pages = trees.get(dir);
    if (!pages) {
        pages = pagesIn(dir);
        trees.set(dir, pages);
    }
    return pages;
};

/** Root-relative page of a symbol; `folder` picks one of several features holding the name. */
const symbolPage = (kind: PageKind, name: string, opts: PageUrlOptions = {}): string => {
    if (!opts.folder) {
        return docsPages().of(kind, name, opts);
    }
    const page = `${opts.folder.join('/')}/${opts.file ?? safeFileName(name)}.html`;
    if (!existsSync(join(docsDir(), page))) {
        throw new Error(`No ${kind} page ${page} in ${docsDir()}`);
    }
    return page;
};

/** URL of a symbol page, e.g. `/core/select/Foo.html`. */
export const pageUrl = (kind: PageKind, name: string, opts?: PageUrlOptions): string =>
    `/${symbolPage(kind, name, opts)}`;

/** URL of a top-level page, e.g. `/utilities.html`. */
export const rootUrl = (page: string): string => `/${rootPage(page)}`;

/** URL of a feature page. */
export const featureUrl = (segments: readonly string[]): string => `/${featurePage(segments)}`;

/** URL of the page of a feature type with its providers and features. */
export const clusterUrl = (featureType: string): string =>
    `/${symbolPage('provider', featureType)}`;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches an `href` that points at `url` from any page depth, e.g. `../core/Foo.html`. */
export const hrefTo = (url: string): RegExp =>
    new RegExp(`(?:^|/)${escapeRegExp(url.replace(/^\//, ''))}$`);
