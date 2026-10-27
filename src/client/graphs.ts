/**
 * Graph rendering with D3 v7 (lazy-loaded): the DOM tree and the dependency graph.
 * Replaces: tree.js (vis-network), svg-pan-zoom.controls.js,
 * lazy-load-graphs.js, and all associated libs.
 */

import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3';
import { initProjectGraph } from './dependency-graph';
import { degrees, fitTransform, graphHeight, nonOverlapping, visibleGraph } from './graph-layout';

declare const COMPONENT_TEMPLATE: string;
declare const COMPONENTS: Array<{ name: string; selector: string }>;
declare const DIRECTIVES: Array<{ name: string; selector: string }>;
declare const ACTUAL_COMPONENT: { name: string };
declare const DEPENDENCY_GRAPH:
    | {
          nodes: Array<{ name: string; type: string; url?: string }>;
          edges: Array<{ source: string; target: string }>;
      }
    | undefined;

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

// Entity color map for dependency graph nodes
const entityColorMap: Record<string, string> = {
    component: 'var(--color-cdx-entity-component, #14b8a6)',
    directive: 'var(--color-cdx-entity-directive, #7c3aed)',
    pipe: 'var(--color-cdx-entity-pipe, #ec4899)',
    external: 'var(--color-cdx-text-muted, #888)',
    injectable: 'var(--color-cdx-entity-service, #f59e0b)',
    service: 'var(--color-cdx-entity-service, #f59e0b)',
    guard: 'var(--color-cdx-entity-guard, #ef4444)',
    interceptor: 'var(--color-cdx-entity-interceptor, #c026d3)'
};

/** Label size on screen; the label font is divided by the zoom so it stays this size. */
const LABEL_FONT_PX = 11;
const LABEL_LINE_PX = 14;
/** Space kept around the laid-out graph when it is fitted into the viewport. */
const FIT_PAD_PX = 28;
const FIT_MAX_SCALE = 1.5;
/** The most connected nodes keep their label even over other nodes. */
const HUB_LABELS = 8;
const HUB_MIN_DEGREE = 3;

interface DepNode extends SimulationNodeDatum {
    readonly name: string;
    readonly type: string;
    readonly url?: string;
    readonly r: number;
    readonly degree: number;
    readonly labelWidth: number;
}

interface DepLink extends SimulationLinkDatum<DepNode> {
    source: DepNode;
    target: DepNode;
}

/** Deterministic random source so a graph lays out the same way on every load. */
const seededRandom = (): (() => number) => {
    let state = 1;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
};

/** Label widths at the label font, measured once per render without layout. */
const labelMeasurer = (container: HTMLElement): ((text: string) => number) => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) {
        return text => text.length * LABEL_FONT_PX * 0.6;
    }
    context.font = `${LABEL_FONT_PX}px ${getComputedStyle(container).fontFamily}`;
    return text => context.measureText(text).width;
};

// Standalone Component Dependency Graph (D3 force-directed)
const initDependencyGraph = async () => {
    const container = document.getElementById('dependency-graph-container');
    if (!container || typeof DEPENDENCY_GRAPH === 'undefined') {
        return;
    }
    // The overview loads the project graph on its own.
    if (container.dataset.cdxGraphSrc) {
        return;
    }
    if (!DEPENDENCY_GRAPH.nodes.length) {
        return;
    }
    const graph = DEPENDENCY_GRAPH;

    const {
        select,
        forceSimulation,
        forceLink,
        forceManyBody,
        forceCollide,
        forceX,
        forceY,
        zoom,
        zoomIdentity,
        scaleSqrt,
        easeCubicOut
    } = await loadD3();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = labelMeasurer(container);
    const externalsToggle = document.getElementById('dep-externals');
    let showExternals = container.dataset.cdxExternals !== 'hidden';

    /** Lay out the visible graph; positions are final when this returns. */
    const layout = (): { nodes: DepNode[]; links: DepLink[] } => {
        const visible = visibleGraph(graph, showExternals);
        const degreeOf = degrees(visible.edges);
        const radius = scaleSqrt()
            .domain([1, Math.max(1, ...degreeOf.values())])
            .range([6, 18])
            .clamp(true);
        const nodes: DepNode[] = visible.nodes.map(n => ({
            name: n.name,
            type: n.type,
            url: n.url,
            degree: degreeOf.get(n.name) ?? 0,
            r: radius(degreeOf.get(n.name) ?? 1),
            labelWidth: measure(n.name)
        }));
        const byName = new Map(nodes.map(n => [n.name, n]));
        const links: DepLink[] = visible.edges.map(e => ({
            source: byName.get(e.source)!,
            target: byName.get(e.target)!
        }));

        const simulation = forceSimulation<DepNode>(nodes)
            .randomSource(seededRandom())
            .force(
                'link',
                forceLink<DepNode, DepLink>(links).distance(l => l.source.r + l.target.r + 36)
            )
            .force(
                'charge',
                forceManyBody<DepNode>()
                    .strength(d => -60 - d.r * 6)
                    .distanceMax(500)
            )
            .force(
                'collide',
                forceCollide<DepNode>()
                    .radius(d => d.r + 10)
                    .strength(0.9)
                    .iterations(2)
            )
            // A weak pull to the middle keeps unconnected nodes near the rest.
            .force('x', forceX<DepNode>(0).strength(0.05))
            .force('y', forceY<DepNode>(0).strength(0.05))
            .stop();
        const ticks = Math.ceil(
            Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())
        );
        simulation.tick(ticks);
        return { nodes, links };
    };

    const svg = select(container)
        .append('svg')
        .attr('class', 'cdx-dep-graph')
        .attr('role', 'img')
        .attr('aria-label', 'Standalone component dependency graph')
        .style('width', '100%')
        .style('border-width', 'var(--color-cdx-graph-border-width, 0)')
        .style('border-style', 'solid')
        .style('border-color', 'var(--color-cdx-graph-border, transparent)')
        .style('border-radius', 'var(--color-cdx-graph-radius, var(--radius-cdx-lg, 12px))')
        .style('background', 'var(--color-cdx-graph-bg, var(--color-cdx-bg-alt))')
        .style('cursor', 'grab');

    // Arrow marker for directed edges (source imports target)
    svg.append('defs')
        .append('marker')
        .attr('id', 'dep-arrow')
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 8)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4Z')
        .attr('fill', 'var(--color-cdx-text-muted, #6b7280)')
        .attr('fill-opacity', 0.7);

    const g = svg.append('g');

    let nodes: DepNode[] = [];
    let fit = zoomIdentity;
    let scale = 1;
    let userZoomed = false;
    let revealed = false;
    let revealRun = 0;

    /** The hovered node and the names of it and its neighbours; null without hover. */
    let focus: { readonly node: DepNode; readonly related: ReadonlySet<string> } | null = null;

    /**
     * Show the labels that fit at the current zoom, most connected first, and
     * hide the rest. The hubs are placed first and may cover other nodes; every
     * other label keeps clear of all nodes. While a node is hovered only it and
     * its neighbours are labelled.
     */
    let cullFrame = 0;
    const cullLabels = () => {
        cullFrame = 0;
        const k = scale;
        const gap = 2 / k;
        const boxes = nodes.map(d => ({
            x: (d.x ?? 0) - d.labelWidth / 2 / k,
            y: (d.y ?? 0) + d.r + 3 / k,
            width: d.labelWidth / k,
            height: LABEL_LINE_PX / k
        }));
        const circles = nodes.map(d => ({
            x: (d.x ?? 0) - d.r,
            y: (d.y ?? 0) - d.r,
            width: d.r * 2,
            height: d.r * 2
        }));
        const order = nodes
            .map((_, i) => i)
            .sort(
                (a, b) =>
                    nodes[b].degree - nodes[a].degree || nodes[a].name.localeCompare(nodes[b].name)
            );

        let shown: Set<number>;
        if (focus) {
            const { node: hovered, related } = focus;
            const focusOrder = [
                nodes.indexOf(hovered),
                ...order.filter(i => nodes[i] !== hovered && related.has(nodes[i].name))
            ];
            shown = nonOverlapping(boxes, focusOrder, gap);
        } else {
            const hubs = nonOverlapping(
                boxes,
                order.slice(0, HUB_LABELS).filter(i => nodes[i].degree >= HUB_MIN_DEGREE),
                gap
            );
            const rest = nonOverlapping(
                boxes,
                order.filter(i => !hubs.has(i)),
                gap,
                [...circles, ...[...hubs].map(i => boxes[i])]
            );
            shown = new Set([...hubs, ...rest]);
        }
        g.selectAll<SVGTextElement, DepNode>('.cdx-graph-label').classed(
            'is-culled',
            (_, i) => !shown.has(i)
        );
    };
    const scheduleCull = () => {
        if (!cullFrame) {
            cullFrame = requestAnimationFrame(cullLabels);
        }
    };

    const zoomBehavior = zoom<SVGSVGElement, unknown>().on('zoom', event => {
        g.attr('transform', event.transform);
        scale = event.transform.k;
        svg.style('--cdx-graph-k', String(scale));
        if (event.sourceEvent) {
            userZoomed = true;
        }
        scheduleCull();
    });
    svg.call(zoomBehavior);

    /** Fit the drawn graph into the viewport, labels included. */
    const computeFit = () => {
        const xs = nodes.flatMap(d => [(d.x ?? 0) - d.r - 40, (d.x ?? 0) + d.r + 40]);
        const ys = nodes.flatMap(d => [(d.y ?? 0) - d.r, (d.y ?? 0) + d.r + 24]);
        const bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
        const t = fitTransform(
            bounds,
            container.clientWidth || 800,
            graphHeight(nodes.length),
            FIT_PAD_PX,
            FIT_MAX_SCALE
        );
        fit = zoomIdentity.translate(t.x, t.y).scale(t.k);
        zoomBehavior.scaleExtent([Math.min(0.1, t.k / 2), 4]);
    };

    const render = () => {
        const laidOut = layout();
        nodes = laidOut.nodes;
        g.selectAll('*').remove();
        svg.style('height', `${graphHeight(nodes.length)}px`);
        // Nothing shows before `reveal` has fitted the graph; animated parts start transparent.
        g.attr('visibility', 'hidden');
        const startOpacity = reducedMotion ? null : 0;

        const link = g
            .append('g')
            .selectAll<SVGLineElement, DepLink>('line')
            .data(laidOut.links)
            .join('line')
            .attr('class', 'dep-link cdx-graph-link')
            .attr('marker-end', 'url(#dep-arrow)')
            .attr('opacity', startOpacity)
            .each(function (this: SVGLineElement, d) {
                // End the line at the target's edge so the arrow stays visible.
                const sx = d.source.x ?? 0;
                const sy = d.source.y ?? 0;
                const dx = (d.target.x ?? 0) - sx;
                const dy = (d.target.y ?? 0) - sy;
                const dist = Math.hypot(dx, dy) || 1;
                const end = dist - d.target.r - 3;
                select(this)
                    .attr('x1', sx)
                    .attr('y1', sy)
                    .attr('x2', sx + (dx / dist) * end)
                    .attr('y2', sy + (dy / dist) * end);
            });

        const node = g
            .append('g')
            .selectAll<SVGGElement, DepNode>('g')
            .data(nodes)
            .join('g')
            .attr('class', d => `dep-node cdx-graph-node${d.url ? ' is-link' : ''}`)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .attr('opacity', startOpacity);

        node.append('circle')
            .attr('r', d => d.r)
            .attr('fill', d => entityColorMap[d.type] ?? entityColorMap.external);

        node.append('title').text(d => `${d.name} (${d.type})`);

        // Labels sit in their own layer above every node.
        const label = g
            .append('g')
            .selectAll<SVGTextElement, DepNode>('text')
            .data(nodes)
            .join('text')
            .attr('class', 'cdx-graph-label')
            .attr('x', d => d.x ?? 0)
            .attr('y', d => (d.y ?? 0) + d.r)
            .attr('dy', '1.1em')
            .attr('text-anchor', 'middle')
            .attr('opacity', startOpacity)
            .text(d => d.name);

        node.on('click', (_event, d) => {
            if (d.url) {
                document.location.href = d.url;
            }
        });

        // Hovering a node keeps it, its neighbours and their edges in focus.
        node.on('pointerenter', (_event, d) => {
            const related = new Set([d.name]);
            for (const l of laidOut.links) {
                if (l.source === d) {
                    related.add(l.target.name);
                }
                if (l.target === d) {
                    related.add(l.source.name);
                }
            }
            focus = { node: d, related };
            svg.classed('is-focusing', true);
            node.classed('is-related', n => related.has(n.name));
            label.classed('is-related', n => related.has(n.name));
            link.classed('is-related', l => l.source === d || l.target === d);
            cullLabels();
        });
        node.on('pointerleave', () => {
            focus = null;
            svg.classed('is-focusing', false);
            node.classed('is-related', false);
            label.classed('is-related', false);
            link.classed('is-related', false);
            cullLabels();
        });

        return { node, link, label };
    };

    let drawn = render();

    /** Fit, then grow the nodes outward from the middle and fade the edges in. */
    const reveal = () => {
        revealed = true;
        userZoomed = false;
        computeFit();
        svg.call(zoomBehavior.transform, fit);
        cullLabels();
        g.attr('visibility', null);
        if (reducedMotion) {
            return;
        }
        // CSS opacity transitions would lag behind the entrance; they come back after it.
        svg.classed('is-revealing', true);
        const cx = nodes.reduce((sum, d) => sum + (d.x ?? 0), 0) / nodes.length;
        const cy = nodes.reduce((sum, d) => sum + (d.y ?? 0), 0) / nodes.length;
        const distance = (d: DepNode) => Math.hypot((d.x ?? 0) - cx, (d.y ?? 0) - cy);
        const farthest = Math.max(1, ...nodes.map(distance));
        const delay = (d: DepNode) => (distance(d) / farthest) * 500;
        const start = (d: DepNode) =>
            `translate(${cx + ((d.x ?? 0) - cx) * 0.6},${cy + ((d.y ?? 0) - cy) * 0.6}) scale(0.2)`;

        const nodesIn = drawn.node
            .attr('transform', start)
            .transition()
            .delay(delay)
            .duration(600)
            .ease(easeCubicOut)
            .attr('opacity', 1)
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on('end', function (this: SVGGElement) {
                select(this).attr('opacity', null);
            });
        const labelsIn = drawn.label
            .transition()
            .delay(d => delay(d) + 350)
            .duration(300)
            .attr('opacity', 1)
            .on('end', function (this: SVGTextElement) {
                select(this).attr('opacity', null);
            });
        const linksIn = drawn.link
            .transition()
            .delay(d => Math.max(delay(d.source), delay(d.target)) + 450)
            .duration(400)
            .attr('opacity', 1)
            .on('end', function (this: SVGLineElement) {
                select(this).attr('opacity', null);
            });
        // An interrupted entrance rejects; only the latest entrance removes the class.
        const run = ++revealRun;
        Promise.allSettled([nodesIn.end(), labelsIn.end(), linksIn.end()]).then(() => {
            if (run === revealRun) {
                svg.classed('is-revealing', false);
            }
        });
    };

    // Lay out now, animate once the graph scrolls into view (or its tab opens).
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(e => e.isIntersecting)) {
                    observer.disconnect();
                    reveal();
                }
            },
            { threshold: 0.15 }
        );
        observer.observe(container);
    } else {
        reveal();
    }

    // Keep the graph fitted while the reader has not zoomed it themselves.
    if ('ResizeObserver' in window) {
        let lastWidth = container.clientWidth;
        new ResizeObserver(() => {
            const width = container.clientWidth;
            if (!revealed || userZoomed || width === lastWidth || width === 0) {
                return;
            }
            lastWidth = width;
            computeFit();
            svg.call(zoomBehavior.transform, fit);
        }).observe(container);
    }

    externalsToggle?.addEventListener('click', e => {
        e.preventDefault();
        showExternals = !showExternals;
        externalsToggle.setAttribute('aria-pressed', String(showExternals));
        drawn = render();
        reveal();
    });

    document.getElementById('dep-zoom-in')?.addEventListener('click', e => {
        e.preventDefault();
        userZoomed = true;
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
    });
    document.getElementById('dep-zoom-out')?.addEventListener('click', e => {
        e.preventDefault();
        userZoomed = true;
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
    });
    document.getElementById('dep-reset')?.addEventListener('click', e => {
        e.preventDefault();
        userZoomed = false;
        svg.transition().duration(300).call(zoomBehavior.transform, fit);
    });
};

export const initGraphs = () => {
    // Async graph initialization
    initDomTree().catch(e => console.error('DOM tree init failed:', e));
    initDependencyGraph().catch(e => console.error('Dependency graph init failed:', e));
    const projectGraph = document.getElementById('dependency-graph-container');
    if (projectGraph?.dataset.cdxGraphSrc) {
        initProjectGraph(projectGraph, loadD3);
    }
};
