/**
 * Graph rendering with D3 v7 (lazy-loaded): the DOM tree here, the dependency
 * graphs in `dependency-graph.ts`.
 * Replaces: tree.js (vis-network), svg-pan-zoom.controls.js,
 * lazy-load-graphs.js, and all associated libs.
 */

import { initLocalGraph, initProjectGraph } from './dependency-graph';

declare const COMPONENT_TEMPLATE: string;
declare const COMPONENTS: Array<{ name: string; selector: string }>;
declare const DIRECTIVES: Array<{ name: string; selector: string }>;
declare const ACTUAL_COMPONENT: { name: string };

type D3Module = typeof import('d3');

let d3: D3Module | null = null;

const loadD3 = async (): Promise<D3Module> => {
    if (d3) {
        return d3;
    }
    d3 = await import('d3');
    return d3;
};

// DOM tree (replaces tree.js + vis-network)
interface TreeNode {
    name: string;
    type: string;
    isComponent?: boolean;
    isDirective?: boolean;
    componentName?: string;
    children: TreeNode[];
}

//Parse HTML template string into a tree structure
const parseTemplate = (html: string): TreeNode => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const walk = (el: Element): TreeNode => {
        const tagName = el.tagName.toLowerCase();
        const node: TreeNode = {
            name: tagName,
            type: 'tag',
            children: []
        };

        // Check if this element matches a component selector
        for (const comp of COMPONENTS) {
            if (comp.selector === tagName) {
                node.isComponent = true;
                node.componentName = comp.name;
                break;
            }
        }

        // Check if this element has a directive attribute
        for (const dir of DIRECTIVES) {
            const attrs = Array.from(el.attributes).map(a => a.name);
            if (attrs.some(attr => dir.selector.includes(attr))) {
                node.isDirective = true;
                node.componentName = dir.name;
                break;
            }
        }

        for (const child of el.children) {
            node.children.push(walk(child));
        }

        return node;
    };

    // Get first element child of body
    const root = doc.body.firstElementChild;
    if (!root) {
        return { name: 'div', type: 'tag', children: [] };
    }
    return walk(root);
};

const initDomTree = async () => {
    const container = document.getElementById('tree-container');
    if (!container || typeof COMPONENT_TEMPLATE === 'undefined') {
        return;
    }

    const treeTab = document.getElementById('tree-tab');

    const { select, tree, hierarchy, linkVertical, zoom, zoomIdentity } = await loadD3();

    const renderTree = () => {
        container.innerHTML = '';
        const data = parseTemplate(COMPONENT_TEMPLATE);
        const root = hierarchy(data);

        const nodeCount = root.descendants().length;
        const layoutWidth = Math.max(600, nodeCount * 80);
        const layoutHeight = Math.max(400, nodeCount * 50);

        const treeLayout = tree<TreeNode>().size([layoutWidth - 100, layoutHeight - 100]);
        treeLayout(root);

        // Use viewBox for responsive sizing + D3 zoom for pan/zoom
        const svg = select(container)
            .append('svg')
            .attr('role', 'img')
            .attr('aria-label', 'Component DOM tree')
            .style('width', '100%')
            .style('height', '450px')
            .style('border-width', 'var(--color-cdx-graph-border-width, 0)')
            .style('border-style', 'solid')
            .style('border-color', 'var(--color-cdx-graph-border, transparent)')
            .style('border-radius', 'var(--color-cdx-graph-radius, var(--radius-cdx-lg, 12px))')
            .style('background', 'var(--color-cdx-graph-bg, var(--color-cdx-bg-alt))')
            .style('cursor', 'grab');

        const g = svg.append('g').attr('transform', 'translate(50,30)');

        // Links
        g.selectAll('.tree-link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'tree-link')
            .attr('fill', 'none')
            .attr('stroke', 'var(--color-cdx-border, #ccc)')
            .attr('stroke-width', 1.5)
            .attr(
                'd',
                linkVertical<any, any>()
                    .x((d: any) => d.x)
                    .y((d: any) => d.y)
            );

        // Nodes
        const node = g
            .selectAll('.tree-node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'tree-node')
            .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
            .style('cursor', (d: any) => (d.data.isComponent ? 'pointer' : 'default'));

        // Node ellipses - entity-color tokens
        node.append('ellipse')
            .attr('rx', (d: any) => {
                const label = d.data.name;
                return Math.max(30, label.length * 4 + 10);
            })
            .attr('ry', 15)
            .attr('fill', (d: any) => {
                if (d.data.isComponent) {
                    return 'var(--color-cdx-entity-component, #14b8a6)';
                }
                if (d.data.isDirective) {
                    return 'var(--color-cdx-entity-directive, #7c3aed)';
                }
                return 'var(--color-cdx-bg-elevated, #D2E5FF)';
            })
            .attr('stroke', 'var(--color-cdx-border, #ccc)');

        // Native SVG tooltip
        node.append('title').text((d: any) => {
            if (d.data.isComponent && d.data.componentName) {
                return `${d.data.name} (${d.data.componentName})`;
            }
            if (d.data.isDirective && d.data.componentName) {
                return `${d.data.name} [${d.data.componentName}]`;
            }
            return d.data.name;
        });

        // Node labels - white on colored entity nodes, dark on plain HTML
        node.append('text')
            .attr('dy', 4)
            .attr('text-anchor', 'middle')
            .attr('font-size', '12px')
            .attr('fill', (d: any) =>
                d.data.isComponent || d.data.isDirective
                    ? 'white'
                    : 'var(--color-cdx-text, #1a1a2e)'
            )
            .attr('font-weight', (d: any) =>
                d.data.isComponent || d.data.isDirective ? '600' : 'normal'
            )
            .text((d: any) => d.data.name);

        // Click handler for component nodes
        node.on('click', (_event: any, d: any) => {
            if (d.data.isComponent && d.data.componentName) {
                const current = globalThis.location;
                document.location.href =
                    current.origin +
                    current.pathname.replace(ACTUAL_COMPONENT.name, d.data.componentName);
            }
        });

        // Enable D3 zoom + fit to view
        const gNode = g.node();
        if (gNode) {
            const bbox = gNode.getBBox();
            const svgWidth = container.clientWidth;
            const svgHeight = 450;
            const pad = 20;

            const zoomBehavior = zoom<SVGSVGElement, unknown>()
                .scaleExtent([0.2, 4])
                .on('zoom', event => {
                    g.attr('transform', event.transform);
                });
            svg.call(zoomBehavior);

            // Calculate scale to fit entire tree with padding
            const scale =
                Math.min(svgWidth / (bbox.width + pad * 2), svgHeight / (bbox.height + pad * 2)) *
                0.85;
            const tx = (svgWidth - bbox.width * scale) / 2 - bbox.x * scale;
            const ty = (svgHeight - bbox.height * scale) / 2 - bbox.y * scale;
            svg.call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale));

            // Wire zoom buttons
            const treeZoomIn = document.getElementById('tree-zoom-in');
            const treeZoomOut = document.getElementById('tree-zoom-out');
            const treeReset = document.getElementById('tree-reset');

            treeZoomIn?.addEventListener('click', e => {
                e.preventDefault();
                svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
            });
            treeZoomOut?.addEventListener('click', e => {
                e.preventDefault();
                svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
            });
            treeReset?.addEventListener('click', e => {
                e.preventDefault();
                svg.transition()
                    .duration(300)
                    .call(zoomBehavior.transform, zoomIdentity.translate(tx, ty).scale(scale));
            });
        }
    };

    // Render on initial load
    setTimeout(renderTree, 200);

    // Re-render when tree tab is clicked
    treeTab?.addEventListener('click', () => {
        setTimeout(renderTree, 200);
    });

    // Re-render on resize (debounced)
    let resizeTimer: ReturnType<typeof setTimeout>;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (container.offsetParent) {
                renderTree();
            }
        }, 250);
    });
};

export const initGraphs = () => {
    // Async graph initialization
    initDomTree().catch(e => console.error('DOM tree init failed:', e));
    const dependencyGraph = document.getElementById('dependency-graph-container');
    if (dependencyGraph) {
        initProjectGraph(dependencyGraph, loadD3);
        initLocalGraph(dependencyGraph, loadD3);
    }
};
