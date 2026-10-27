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

/** Path of a file in the output folder, from its path below the site root. */
const outputPath = (file: string): string => {
    const { output } = Configuration.mainData;
    return `${output}${output.lastIndexOf('/') === -1 ? '/' : ''}${file}`;
};

export class PageWriter {
    private legacy?: { readonly redirects: Redirects; readonly pages: ReadonlySet<string> };

    /**
     * The redirect map of this run (old page paths of earlier layouts) and
     * the pages it is written next to, built once on the first page.
     */
    private legacyLinks(): { readonly redirects: Redirects; readonly pages: ReadonlySet<string> } {
        if (this.legacy) {
            return this.legacy;
        }
        const { mainData } = Configuration;
        const additional = mainData.additionalPages.flatMap((page: PageInterface) => [
            ...(isAdditionalGroup(page) ? [] : [page]),
            ...((page as { children?: PageInterface[] }).children ?? [])
        ]);
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
            HtmlEngine.render(Configuration.mainData, page),
            pageOutputPath(page),
            page.depth ?? ROOT_DEPTH,
            redirects,
            pages
        );
        FileEngine.writeSync(outputPath(pageOutputPath(page)), htmlData);
        return Promise.resolve();
    }

    /** Render the sidebar once and write it as the shared script every page loads. */
    private writeMenu(): void {
        const script = menuScript(HtmlEngine.renderMenu(Configuration.mainData));
        FileEngine.writeSync(outputPath(MENU_SCRIPT), script);
        HtmlEngine.menuVersion = contentVersion(script);
    }

    public async processPages(): Promise<void> {
        this.legacy = undefined;
        await this.writeGraph();
        this.buildEntityIndex();
        Configuration.mainData.generatedAt = new Date().toISOString();
        this.writeMenu();
        const pages = [...Configuration.pages].sort((a, b) => a.name.localeCompare(b.name));

        logger.info('Process pages');
        await Promise.all(pages.map(page => this.processPage(page)));
    }

    /**
     * Lay the project's dependency graph out and write it as the script the
     * overview loads once the graph scrolls into view. Nothing without symbols
     * or with the graph disabled.
     */
    private async writeGraph(): Promise<void> {
        const { mainData } = Configuration;
        mainData.graph = undefined;
        if (mainData.disableGraph || !mainData.symbols) {
            return;
        }
        const model = buildGraphModel(mainData.symbols, mainData.semantic, mainData.di);
        if (model.nodes.length === 0) {
            return;
        }
        const force = await import('d3');
        const script = graphScript(graphFile(force, model));
        FileEngine.writeSync(outputPath(GRAPH_SCRIPT), script);
        mainData.graph = {
            model,
            version: contentVersion(script),
            shown: visibleGraph(model, defaultKinds(model.nodes)).nodes.length
        };
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
