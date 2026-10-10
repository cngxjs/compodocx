import { buildEntityIndex } from '../../utils/entity-index.util';
import { logger } from '../../utils/logger';
import Configuration, { pageOutputPath } from '../configuration';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';
import type { PageInterface } from '../interfaces/page.interface';
import { featureSegments } from '../links/feature-paths';
import { hrefFor, hrefText, pageLocation, pagePath, ROOT_DEPTH } from '../links/layout';
import { buildRedirects, type Redirects, rewriteLegacyLinks } from '../links/redirects';
import { placedLink } from '../links/resolve';
import type { TableKind } from '../links/symbol-id';
import { entryInFile } from '../links/symbol-table';

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
            page,
            ...((page as { children?: PageInterface[] }).children ?? [])
        ]);
        const pages = new Set([...Configuration.pages, ...additional].map(pageOutputPath));
        const features = mainData.semantic?.features?.features ?? [];
        const utilities = pagePath(pageLocation({ type: 'root', page: 'utilities' }));
        const redirects = mainData.symbols
            ? buildRedirects({
                  table: mainData.symbols,
                  di: mainData.di,
                  features: featureSegments(features).segments.values(),
                  pages,
                  utilities: pages.has(utilities) ? utilities : undefined
              })
            : {};
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
        let finalPath = Configuration.mainData.output;

        if (Configuration.mainData.output.lastIndexOf('/') === -1) {
            finalPath += '/';
        }
        finalPath += pageOutputPath(page);

        FileEngine.writeSync(finalPath, htmlData);
        return Promise.resolve();
    }

    public async processPages(): Promise<void> {
        this.legacy = undefined;
        this.buildDependencyGraph();
        this.buildEntityIndex();
        Configuration.mainData.generatedAt = new Date().toISOString();
        const pages = [...Configuration.pages].sort((a, b) => a.name.localeCompare(b.name));

        logger.info('Process pages');
        await Promise.all(pages.map(page => this.processPage(page)));
    }

    /**
     * Build the standalone component dependency graph from all components
     * that have standalone: true and imports.
     */
    private buildDependencyGraph() {
        const components = (Configuration.mainData.components as any[]) ?? [];
        const directives = (Configuration.mainData.directives as any[]) ?? [];
        const pipes = (Configuration.mainData.pipes as any[]) ?? [];
        const injectables = (Configuration.mainData.injectables as any[]) ?? [];

        // Build a name→type+url lookup for all known entities
        const { symbols, di } = Configuration.mainData;
        const urlOf = (kind: TableKind, item: any): string | undefined => {
            const entry = symbols && entryInFile(symbols, kind, item.name, item.file);
            const link = entry && placedLink(symbols, entry, di);
            return link && hrefText(hrefFor(link.target, ROOT_DEPTH, link.anchor));
        };
        const entityMap = new Map<string, { type: string; url?: string }>();
        const graphKinds = [
            ['component', components],
            ['directive', directives],
            ['pipe', pipes],
            ['injectable', injectables]
        ] as const;
        for (const [kind, list] of graphKinds) {
            for (const item of list) {
                entityMap.set(item.name, { type: kind, url: urlOf(kind, item) });
            }
        }

        const nodeSet = new Set<string>();
        const edges: Array<{ source: string; target: string }> = [];

        for (const comp of components) {
            if (!comp.standalone || !comp.imports?.length) {
                continue;
            }
            nodeSet.add(comp.name);
            for (const imp of comp.imports) {
                const impName = typeof imp === 'string' ? imp : imp.name;
                if (!impName) {
                    continue;
                }
                nodeSet.add(impName);
                edges.push({ source: comp.name, target: impName });
            }
        }

        const nodes = Array.from(nodeSet).map(name => {
            const info = entityMap.get(name);
            return {
                name,
                type: info?.type ?? 'external',
                url: info?.url
            };
        });

        Configuration.mainData.dependencyGraph = { nodes, edges };
    }

    private buildEntityIndex() {
        const index = buildEntityIndex(
            Configuration.mainData as unknown as Record<string, unknown>
        );
        Configuration.mainData.entityIndex = index;
    }
}
