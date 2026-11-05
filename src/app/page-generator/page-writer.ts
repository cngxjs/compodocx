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
    missingMarkdownPageMessage,
    rewriteMarkdownLinks,
    toPosix
} from '../links/markdown-links';
import {
    buildRedirects,
    type Redirects,
    rewriteLegacyLinks,
    withAliases
} from '../links/redirects';
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

/** The Markdown file a page was rendered from: an additional page or the README. */
const markdownSourceOf = (page: PageInterface): string | undefined => {
    const { mainData } = Configuration;
    if (page.context === 'additional-page' && page.additionalPageSource) {
        return absolutePosix(mainData.includes, page.additionalPageSource.file);
    }
    return page.context === 'readme'
        ? absolutePosix(process.cwd(), `${rootMarkdownName(page)}.md`)
        : undefined;
};

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

    /**
     * The page of every Markdown file that has one, built once per run: the
     * additional pages and the root pages of the project files (README.md
     * and its neighbours in the cwd).
     */
    private markdownPages(): MarkdownPages {
        this.markdown ??= new Map([
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

    /** Relative `.md` links of a Markdown page pointed at the generated pages. */
    private withMarkdownLinks(html: string, page: PageInterface): string {
        const file = markdownSourceOf(page);
        if (file === undefined) {
            return html;
        }
        const root = absolutePosix(Configuration.mainData.includes ?? '', '.');
        const result = rewriteMarkdownLinks(
            html,
            { file, root, depth: page.depth ?? ROOT_DEPTH },
            this.markdownPages()
        );
        const shown = (absolute: string): string => toPosix(path.relative(process.cwd(), absolute));
        for (const target of result.missing) {
            logger.warn(missingMarkdownPageMessage(shown(file), shown(target)));
        }
        return result.html;
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
        const htmlData = rewriteLegacyLinks(
            this.withMarkdownLinks(HtmlEngine.render(Configuration.mainData, page), page),
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
