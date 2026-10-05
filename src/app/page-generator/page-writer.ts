import { buildEntityIndex } from '../../utils/entity-index.util';
import { logger } from '../../utils/logger';
import Configuration from '../configuration';
import FileEngine from '../engines/file.engine';
import HtmlEngine from '../engines/html.engine';

export class PageWriter {
    public processPage(page): Promise<void> {
        logger.info('Process page', page.name);

        const htmlData = HtmlEngine.render(Configuration.mainData, page);
        let finalPath = Configuration.mainData.output;

        if (Configuration.mainData.output.lastIndexOf('/') === -1) {
            finalPath += '/';
        }
        if (page.path) {
            finalPath += `${page.path}/`;
        }

        if (page.filename) {
            finalPath += `${page.filename}.html`;
        } else {
            finalPath += `${page.name}.html`;
        }

        FileEngine.writeSync(finalPath, htmlData);
        return Promise.resolve();
    }

    public async processPages(): Promise<void> {
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
        const entityMap = new Map<string, { type: string; url?: string }>();
        for (const c of components) {
            entityMap.set(c.name, { type: 'component', url: `./components/${c.name}.html` });
        }
        for (const d of directives) {
            entityMap.set(d.name, { type: 'directive', url: `./directives/${d.name}.html` });
        }
        for (const p of pipes) {
            entityMap.set(p.name, { type: 'pipe', url: `./pipes/${p.name}.html` });
        }
        for (const s of injectables) {
            entityMap.set(s.name, { type: 'injectable', url: `./injectables/${s.name}.html` });
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
