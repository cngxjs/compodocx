import * as path from 'node:path';

import AngularApiUtil from '../../utils/angular-api.util';
import { buildEntityIndex } from '../../utils/entity-index.util';
import { logger } from '../../utils/logger';
import Configuration, { pageOutputPath } from '../configuration';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';
import { buildGraphModel, defaultKinds, graphFile, visibleGraph } from '../graph';
import type { PageInterface } from '../interfaces/page.interface';
import { featureSegments } from '../links/feature-paths';
import { pageLocation, pagePath, ROOT_DEPTH } from '../links/layout';
import {
    type MarkdownPages,
    type MissingMarkdownLink,
    missingMarkdownLinksReport,
    rewriteMarkdownLinks,
    toPosix
} from '../links/markdown-links';
import {
    buildRedirects,
    type Redirects,
    rewriteLegacyLinks,
    withAliases
} from '../links/redirects';
import {
    type MissingSiteLink,
    missingSiteLinksReport,
    rewriteSiteLinks
} from '../links/site-links';
import { isAdditionalGroup } from './additional-page-tree';
import {
    contentVersion,
    ENTITIES_SCRIPT,
    entitiesScript,
    GRAPH_SCRIPT,
    graphScript,
    MENU_SCRIPT,
    menuScript
} from './shared-scripts';

/** Pages of the additional documentation, nested ones included; groups have none. */
const additionalPagesOf = (pages: readonly PageInterface[]): PageInterface[] =>
    pages.flatMap((page: PageInterface) => [
        ...(isAdditionalGroup(page) ? [] : [page]),
        ...((page as { children?: PageInterface[] }).children ?? [])
    ]);

const absolutePosix = (base: string, file: string): string => toPosix(path.resolve(base, file));

/** Contexts of the root pages rendered from the project Markdown files. */
const ROOT_MARKDOWN_CONTEXTS: ReadonlySet<string> = new Set([
    'readme',
    'changelog',
    'contributing',
    'license',
    'todo'
]);

/** File name (no extension) of a root Markdown page: `README` for the index. */
const rootMarkdownName = (page: PageInterface): string =>
    page.context === 'readme' ? 'README' : page.context.toUpperCase();

/**
 * Page field holding the symbol of a symbol page, per context. Its `file`
 * is the TypeScript source of the JSDoc and the neighbour README the page
 * shows. Pages of several files (DI clusters, features) are not listed.
 */
const SYMBOL_DATA_KEYS: Readonly<Record<string, string>> = {
    component: 'component',
    directive: 'directive',
    class: 'class',
    interface: 'interface',
    injectable: 'injectable',
    service: 'service',
    pipe: 'pipe',
    entity: 'entity',
    token: 'token',
    provider: 'provider',
    namespace: 'namespace',
    guard: 'injectable',
    interceptor: 'injectable',
    resolver: 'resolver',
    function: 'function',
    variable: 'variable',
    typealias: 'typealias',
    enumeration: 'enumeration'
};

/** The TypeScript file of a symbol page, absolute; undefined for other pages. */
const symbolSourceOf = (page: PageInterface): string | undefined => {
    const key = SYMBOL_DATA_KEYS[page.context];
    const file = key === undefined ? undefined : (page[key] as { file?: unknown })?.file;
    return typeof file === 'string' && file !== '' ? absolutePosix(process.cwd(), file) : undefined;
};

/** The neighbour README a symbol page shows (`foo.component.md`), absolute. */
const symbolReadmeOf = (page: PageInterface): string | undefined => {
    const key = SYMBOL_DATA_KEYS[page.context];
    const readme = key === undefined ? undefined : (page[key] as { readme?: unknown })?.readme;
    const file = symbolSourceOf(page);
    return typeof readme === 'string' && file !== undefined
        ? `${file.replace(/\.ts$/, '')}.md`
        : undefined;
};

/** The README a feature page shows, absolute. */
const featureReadmeOf = (page: PageInterface): string | undefined => {
    const file = (page.feature as { readme?: { file?: unknown } } | undefined)?.readme?.file;
    return typeof file === 'string' ? absolutePosix(process.cwd(), file) : undefined;
};

/**
 * The file the `.md` links of a page are resolved against: the Markdown file
 * of an additional page, the README or a feature page, the TypeScript file of
 * a symbol page. Undefined for any other page, which resolves root-absolute
 * links only.
 */
const markdownSourceOf = (page: PageInterface): string | undefined => {
    const { mainData } = Configuration;
    if (page.context === 'feature') {
        return featureReadmeOf(page);
    }
    if (page.context === 'additional-page' && page.additionalPageSource) {
        return absolutePosix(mainData.includes, page.additionalPageSource.file);
    }
    return page.context === 'readme'
        ? absolutePosix(process.cwd(), `${rootMarkdownName(page)}.md`)
        : symbolSourceOf(page);
};

/** A path as the build log shows it: relative to the cwd, posix separators. */
const shownPath = (absolute: string): string => toPosix(path.relative(process.cwd(), absolute));

/** Path of a file in the output folder, from its path below the site root. */
const outputPath = (file: string): string => {
    const { output } = Configuration.mainData;
    return `${output}${output.lastIndexOf('/') === -1 ? '/' : ''}${file}`;
};

export class PageWriter {
    /** Output files of the pages written by the current run. */
    private readonly written = new Set<string>();
    /** Output files written by earlier runs since the last `takeStalePages`. */
    private readonly earlier = new Set<string>();
    private legacy?: { readonly redirects: Redirects; readonly pages: ReadonlySet<string> };
    private markdown?: MarkdownPages;
    /** `.md` links without a page found by the current run. */
    private readonly missingMarkdown: MissingMarkdownLink[] = [];
    /** Links to the docs site (`siteUrl`) without a page, found by the current run. */
    private readonly missingSite: MissingSiteLink[] = [];

    /**
     * The page of every Markdown file that has one, built once per run: the
     * neighbour README of a symbol (its symbol page, first symbol of the
     * file wins), the README of a feature (its feature page), the root pages
     * of the project files (README.md and its neighbours in the cwd) and the
     * additional pages.
     */
    private markdownPages(): MarkdownPages {
        if (this.markdown) {
            return this.markdown;
        }
        const neighbourReadmes = Configuration.pages.flatMap((page): [string, string][] => {
            const file = symbolReadmeOf(page);
            return file === undefined ? [] : [[file, pageOutputPath(page)]];
        });
        const featureReadmes = Configuration.pages.flatMap((page): [string, string][] => {
            const file = page.context === 'feature' ? featureReadmeOf(page) : undefined;
            return file === undefined ? [] : [[file, pageOutputPath(page)]];
        });
        this.markdown = new Map([
            ...neighbourReadmes.reverse(),
            ...featureReadmes,
            ...Configuration.pages
                .filter(page => ROOT_MARKDOWN_CONTEXTS.has(page.context))
                .map((page): [string, string] => [
                    absolutePosix(process.cwd(), `${rootMarkdownName(page)}.md`),
                    pageOutputPath(page)
                ]),
            ...additionalPagesOf(Configuration.mainData.additionalPages).map(
                (page): [string, string] => [
                    absolutePosix(Configuration.mainData.includes, page.additionalPageSource.file),
                    pageOutputPath(page)
                ]
            )
        ]);
        return this.markdown;
    }

    /**
     * `.md` links of a page pointed at the generated pages: relative ones
     * against the file the page was rendered from, root-absolute ones against
     * the includes folder. Links without a page are kept for the report.
     */
    private withMarkdownLinks(html: string, page: PageInterface): string {
        const file = markdownSourceOf(page);
        const root = absolutePosix(Configuration.mainData.includes ?? '', '.');
        const result = rewriteMarkdownLinks(
            html,
            { file, root, depth: page.depth ?? ROOT_DEPTH },
            this.markdownPages()
        );
        const source = file === undefined ? pageOutputPath(page) : shownPath(file);
        for (const target of result.missing) {
            this.missingMarkdown.push({ source, target: shownPath(target) });
        }
        return result.html;
    }

    /**
     * Links of a page to the published docs site (`siteUrl`) pointed at the
     * pages of this build, before the old paths among them are redirected.
     * Links without a page stay absolute and are kept for the report.
     */
    private withSiteLinks(
        html: string,
        page: PageInterface,
        pages: ReadonlySet<string>,
        redirects: Redirects
    ): string {
        const siteUrl = Configuration.mainData.siteUrl ?? '';
        if (siteUrl === '') {
            return html;
        }
        const result = rewriteSiteLinks(
            html,
            { siteUrl, depth: page.depth ?? ROOT_DEPTH },
            pages,
            redirects
        );
        const source = pageOutputPath(page);
        for (const target of result.missing) {
            this.missingSite.push({ source, target });
        }
        return result.html;
    }

    /**
     * Log the `.md` links and the site links without a page found since
     * `processPages`, once per run after every page (additional pages
     * included) is written: a count line each as a warning, the links with
     * `--verbose`.
     */
    public reportMarkdownLinks(): void {
        const reports = [
            missingMarkdownLinksReport(this.missingMarkdown),
            missingSiteLinksReport(this.missingSite)
        ];
        this.missingMarkdown.length = 0;
        this.missingSite.length = 0;
        for (const report of reports) {
            if (report === undefined) {
                continue;
            }
            logger.warn(report.summary);
            logger.debug(report.details.join('\n'));
        }
    }

    /**
     * The redirect map of this run (old page paths of earlier layouts) and
     * the pages it is written next to, built once on the first page.
     */
    private legacyLinks(): { readonly redirects: Redirects; readonly pages: ReadonlySet<string> } {
        if (this.legacy) {
            return this.legacy;
        }
        const { mainData } = Configuration;
        const additional = additionalPagesOf(mainData.additionalPages);
        const pages = new Set([...Configuration.pages, ...additional].map(pageOutputPath));
        const features = mainData.semantic?.features?.features ?? [];
        const utilities = pagePath(pageLocation({ type: 'root', page: 'utilities' }));
        const symbolRedirects = mainData.symbols
            ? buildRedirects({
                  table: mainData.symbols,
                  di: mainData.di,
                  features: featureSegments(features).segments.values(),
                  pages,
                  utilities: pages.has(utilities) ? utilities : undefined
              })
            : {};
        const redirects = withAliases(symbolRedirects, mainData.additionalAliases);
        mainData.redirects = redirects;
        this.legacy = { redirects, pages };
        return this.legacy;
    }

    public processPage(page): Promise<void> {
        logger.info('Process page', page.name);

        const { redirects, pages } = this.legacyLinks();
        const html = this.withMarkdownLinks(HtmlEngine.render(Configuration.mainData, page), page);
        const htmlData = rewriteLegacyLinks(
            this.withSiteLinks(html, page, pages, redirects),
            pageOutputPath(page),
            page.depth ?? ROOT_DEPTH,
            redirects,
            pages
        );
        const file = outputPath(pageOutputPath(page));
        FileEngine.writeSync(file, htmlData);
        this.written.add(file);
        return Promise.resolve();
    }

    /**
     * Output files that earlier runs of this process wrote and the current
     * run did not; the record of earlier runs starts over. Files this
     * process never wrote are never listed.
     */
    public takeStalePages(): string[] {
        const stale = [...this.earlier].filter(file => !this.written.has(file));
        this.earlier.clear();
        return stale;
    }

    /** Render the sidebar once and write it as the shared script every page loads. */
    private writeMenu(): void {
        const script = menuScript(HtmlEngine.renderMenu(Configuration.mainData));
        FileEngine.writeSync(outputPath(MENU_SCRIPT), script);
        HtmlEngine.menuVersion = contentVersion(script);
    }

    public async processPages(): Promise<void> {
        this.legacy = undefined;
        this.markdown = undefined;
        this.missingMarkdown.length = 0;
        this.missingSite.length = 0;
        for (const file of this.written) {
            this.earlier.add(file);
        }
        this.written.clear();
        await this.writeGraph();
        this.buildEntityIndex();
        Configuration.mainData.generatedAt = new Date().toISOString();
        this.writeMenu();
        const pages = [...Configuration.pages].sort((a, b) => a.name.localeCompare(b.name));

        logger.info('Process pages');
        await Promise.all(pages.map(page => this.processPage(page)));
    }

    /**
     * Build the project's dependency graph for the overview and the
     * component pages. With the overview graph on, lay it out and write it
     * as the script the overview loads once the graph scrolls into view.
     */
    private async writeGraph(): Promise<void> {
        const { mainData } = Configuration;
        mainData.graph = undefined;
        if (!mainData.symbols) {
            return;
        }
        const model = buildGraphModel(mainData.symbols, mainData.semantic, mainData.di, name => {
            const api = AngularApiUtil.findApi(name).data;
            return api ? `https://angular.dev/${api.path}` : undefined;
        });
        if (model.nodes.length === 0) {
            return;
        }
        const shown = visibleGraph(model, defaultKinds(model.nodes)).nodes.length;
        if (mainData.disableGraph) {
            mainData.graph = { model, shown };
            return;
        }
        const force = await import('d3');
        const script = graphScript(graphFile(force, model));
        FileEngine.writeSync(outputPath(GRAPH_SCRIPT), script);
        mainData.graph = { model, shown, version: contentVersion(script) };
    }

    /** Build the entity index and write it as the shared script every page loads. */
    private buildEntityIndex() {
        const index = buildEntityIndex(
            Configuration.mainData as unknown as Record<string, unknown>
        );
        Configuration.mainData.entityIndex = index;
        const script = entitiesScript(index);
        FileEngine.writeSync(outputPath(ENTITIES_SCRIPT), script);
        HtmlEngine.entitiesVersion = contentVersion(script);
    }
}
