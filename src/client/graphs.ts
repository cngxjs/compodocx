/**
 * Graph rendering with D3 v7 (lazy-loaded).
 * Replaces: routes.js (D3 v3), tree.js (vis-network), svg-pan-zoom.controls.js,
 * lazy-load-graphs.js, and all associated libs.
 */

declare const ROUTES_INDEX: any;
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

// Lazy SVG loading (replaces lazy-load-graphs.js)
const initLazyGraphs = () => {
    const lazyEls = document.querySelectorAll<HTMLObjectElement>('[lazy]');
    if (lazyEls.length === 0) {
        return;
    }

    // The scroll container is .content, not the viewport.
    // Use it as IntersectionObserver root so elements inside it are detected.
    const scrollRoot = document.querySelector('.content') as HTMLElement | null;

    const observer = new IntersectionObserver(
        entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) {
                    return;
                }
                const el = entry.target as HTMLObjectElement;
                const src = el.getAttribute('lazy');
                if (src) {
                    el.data = src;
                    el.removeAttribute('lazy');
                }
                observer.unobserve(el);
            });
        },
        { root: scrollRoot, rootMargin: '200px' }
    );

    lazyEls.forEach(el => observer.observe(el));
};

// SVG pan-zoom (replaces svg-pan-zoom lib)
const initSvgPanZoom = async () => {
    const container = document.getElementById('module-graph-svg');
    if (!container) {
        return;
    }

    const svgEl = container.querySelector('svg');
    if (!svgEl) {
        return;
    }

    // A11y: mark graph as decorative image with label
    svgEl.setAttribute('role', 'img');
    svgEl.setAttribute('aria-label', 'Module dependency graph');

    const { zoom, select, zoomIdentity } = await loadD3();

    const svgSelection = select(svgEl);

    // Graphviz SVGs have a <g> with its own transform (scale/rotate/translate).
    // We must NOT overwrite that. Instead, wrap all SVG content in a new <g>
    // and apply D3 zoom transforms to the wrapper only.
    const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    wrapper.setAttribute('class', 'zoom-wrapper');
    // Move all existing children into the wrapper
    while (svgEl.firstChild) {
        wrapper.appendChild(svgEl.firstChild);
    }
    svgEl.appendChild(wrapper);

    // Make SVG fill its container and use viewBox for scaling
    const bbox = wrapper.getBBox();
    svgEl.setAttribute('viewBox', `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`);
    svgEl.style.width = '100%';
    svgEl.style.maxHeight = '400px';
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');

    const wrapperSelection = select(wrapper);

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.5, 5])
        .on('zoom', event => {
            wrapperSelection.attr('transform', event.transform);
        });

    svgSelection.call(zoomBehavior);

    // Wire zoom buttons + a11y labels
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    const reset = document.getElementById('reset');
    const fullscreen = document.getElementById('fullscreen');

    zoomIn?.setAttribute('aria-label', 'Zoom in');
    zoomOut?.setAttribute('aria-label', 'Zoom out');
    reset?.setAttribute('aria-label', 'Reset zoom');

    zoomIn?.addEventListener('click', e => {
        e.preventDefault();
        svgSelection.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
    });

    zoomOut?.addEventListener('click', e => {
        e.preventDefault();
        svgSelection.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
    });

    reset?.addEventListener('click', e => {
        e.preventDefault();
        svgSelection.transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
    });

    if (fullscreen) {
        let isFullscreen = false;
        const originalContainerHeight = container.style.height;
        const originalMaxHeight = svgEl.style.maxHeight;

        fullscreen.addEventListener('click', () => {
            if (isFullscreen) {
                container.style.height = originalContainerHeight;
                svgEl.style.maxHeight = originalMaxHeight || '400px';
                isFullscreen = false;
                fullscreen.setAttribute('aria-label', 'Fullscreen');
            } else {
                container.style.height = '85vh';
                svgEl.style.maxHeight = 'none';
                isFullscreen = true;
                fullscreen.setAttribute('aria-label', 'Exit fullscreen');
            }
            svgEl.style.height = `${container.clientHeight}px`;
            svgSelection.transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
        });
    }
};

// Routes graph (replaces routes.js + D3 v3)
const htmlEntities = (str: string): string =>
    String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');

const initRoutesGraph = async () => {
    const target = document.getElementById('body-routes');
    if (!target || typeof ROUTES_INDEX === 'undefined') {
        return;
    }

    const { select, tree, hierarchy, linkHorizontal } = await loadD3();

    // Clean string children from route tree
    const cleanStringChildren = (obj: any) => {
        for (const prop in obj) {
            if (!Object.hasOwn(obj, prop)) {
                continue;
            }
            if (prop === 'children' && Array.isArray(obj[prop])) {
                obj[prop] = obj[prop].filter((c: any) => typeof c !== 'string');
            }
            if (typeof obj[prop] === 'object' && obj[prop] !== null) {
                cleanStringChildren(obj[prop]);
            }
        }
    };

    const data = ROUTES_INDEX;
    cleanStringChildren(data);

    const root = hierarchy(data);
    const nodeCount = root.descendants().length;

    // Calculate dimensions based on tree size
    const nodeHeight = 90;
    const nodeWidth = 250;
    const height = nodeCount * nodeHeight;
    const width = (root.height + 1) * nodeWidth;

    const treeLayout = tree<any>().size([height, width - 160]);
    treeLayout(root);

    const svg = select(target)
        .append('svg')
        .attr('id', 'main')
        .attr('width', width + 40)
        .attr('height', height + 40)
        .attr('role', 'img')
        .attr('aria-label', 'Application routes graph');

    const g = svg.append('g').attr('transform', 'translate(20,20)');

    // Draw links
    g.selectAll('.link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('fill', 'none')
        .attr('stroke', 'var(--color-cdx-border, #ccc)')
        .attr('stroke-width', 1.5)
        .attr(
            'd',
            linkHorizontal<any, any>()
                .x((d: any) => d.y)
                .y((d: any) => d.x)
        );

    // Draw nodes
    const node = g
        .selectAll('.node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d: any) => `translate(${d.y},${d.x})`);

    // Node marker
    node.append('circle')
        .attr('r', 5)
        .attr('fill', (d: any) =>
            d.children
                ? 'var(--color-cdx-primary, #3163d8)'
                : 'var(--color-cdx-entity-component, #36ab9b)'
        )
        .attr('class', (d: any) => (d.children ? 'icon has-children' : 'icon'));

    // Native SVG tooltip
    node.append('title').text((d: any) => {
        const parts = [d.data.path || d.data.name];
        if (d.data.component) {
            parts.push(`Component: ${d.data.component}`);
        }
        if (d.data.guarded) {
            parts.push('Guarded');
        }
        if (d.data.redirectTo) {
            parts.push(`→ ${d.data.redirectTo}`);
        }
        return parts.join('\n');
    });

    // Node text
    node.append('text')
        .attr('x', 0)
        .attr('y', 10)
        .attr('dy', '.35em')
        .attr('class', 'text')
        .attr('text-anchor', 'start')
        .html((d: any) => buildNodeLabel(d.data));

    // Route indicator icons (unicode, replaces Ionicons)
    node.append('text')
        .attr('y', 45)
        .attr('x', -18)
        .attr('class', 'icon')
        .attr('font-size', '13px')
        .attr('fill', 'var(--color-cdx-text-muted, #888)')
        .text((d: any) => {
            if (d.data.loadChildren || d.data.loadComponent) {
                return '\u21BB'; // ↻ lazy
            }
            if (d.data.guarded) {
                return '\u26A0'; // ⚠ guarded
            }
            return '';
        });

    // Calculate bounding boxes and add backgrounds
    node.each(function (this: SVGGElement) {
        const texts = this.querySelectorAll('text.text');
        texts.forEach(text => {
            const bbox = (text as SVGTextElement).getBBox();
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('width', String(bbox.width));
            rect.setAttribute('height', String(bbox.height));
            rect.setAttribute('x', String(bbox.x));
            rect.setAttribute('y', String(bbox.y));
            rect.style.fill = 'var(--color-cdx-bg, white)';
            rect.style.fillOpacity = '0.85';
            this.insertBefore(rect, text);
        });
    });

    // Resize SVG to fit content
    const mainGroup = g.node();
    if (mainGroup) {
        const bbox = mainGroup.getBBox();
        svg.attr('width', bbox.width + 50).attr('height', bbox.height + 50);
    }

    // Add pan-zoom via mouse wheel / drag
    const { zoom } = await loadD3();
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', event => {
            g.attr('transform', event.transform);
        });
    svg.call(zoomBehavior);
};

// Build the label HTML for a route node
const buildNodeLabel = (d: any): string => {
    let label = '';
    if (d.kind === 'root') {
        label += `<tspan x="0" dy="1.4em">${htmlEntities(d.name)}</tspan>`;
    } else if (d.kind === 'component') {
        label += `<tspan x="0" dy="1.4em">${d.path || d.name}</tspan>`;
        if (d.component) {
            label += `<tspan x="0" dy="1.4em"><a href="./components/${d.component}.html">${d.component}</a></tspan>`;
        } else if (d.name?.includes('Component')) {
            label += `<tspan x="0" dy="1.4em">${d.name}</tspan>`;
        }
        if (d.outlet) {
            label += `<tspan x="0" dy="1.4em">&lt;outlet&gt; : ${d.outlet}</tspan>`;
        }
    } else {
        label += `<tspan x="0" dy="1.4em">/${d.path || d.name}</tspan>`;
        if (d.component) {
            label += `<tspan x="0" dy="1.4em"><a href="./components/${d.component}.html">${d.component}</a></tspan>`;
        }
        if (d.canActivate) {
            label += '<tspan x="0" dy="1.4em">&#10003; canActivate</tspan>';
        }
        if (d.canDeactivate) {
            label += '<tspan x="0" dy="1.4em">&#215;&nbsp;&nbsp;canDeactivate</tspan>';
        }
        if (d.canActivateChild) {
            label += '<tspan x="0" dy="1.4em">&#10003; canActivateChild</tspan>';
        }
        if (d.redirectTo) {
            label += `<tspan x="0" dy="1.4em">&rarr; ${d.redirectTo}</tspan>`;
        }
        if (d.pathMatch) {
            label += `<tspan x="0" dy="1.4em">&gt; ${d.pathMatch}</tspan>`;
        }
        if (d.outlet) {
            label += `<tspan x="0" dy="1.4em">&lt;outlet&gt; : ${d.outlet}</tspan>`;
        }
    }
    return label;
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

        // Node ellipses — entity-color tokens
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

        // Node labels — white on colored entity nodes, dark on plain HTML
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
    module: 'var(--color-cdx-entity-module, #3b82f6)',
    injectable: 'var(--color-cdx-entity-service, #f59e0b)',
    guard: 'var(--color-cdx-entity-guard, #ef4444)',
    interceptor: 'var(--color-cdx-entity-interceptor, #c026d3)'
};

// Standalone Component Dependency Graph (D3 force-directed)
const initDependencyGraph = async () => {
    const container = document.getElementById('dependency-graph-container');
    if (!container || typeof DEPENDENCY_GRAPH === 'undefined') {
        return;
    }
    if (!DEPENDENCY_GRAPH.nodes.length) {
        return;
    }

    const {
        select,
        forceSimulation,
        forceLink,
        forceManyBody,
        forceCenter,
        forceCollide,
        zoom,
        zoomIdentity,
        scaleSqrt
    } = await loadD3();

    const width = container.clientWidth || 800;
    const height = Math.max(450, Math.min(700, DEPENDENCY_GRAPH.nodes.length * 25));

    // Build node/edge index
    const nodeMap = new Map(DEPENDENCY_GRAPH.nodes.map((n, i) => [n.name, i]));
    const links = DEPENDENCY_GRAPH.edges
        .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
        .map(e => ({ source: e.source, target: e.target }));

    // Count connections per node for radius scaling
    const connectionCount = new Map<string, number>();
    for (const e of DEPENDENCY_GRAPH.edges) {
        connectionCount.set(e.source, (connectionCount.get(e.source) ?? 0) + 1);
        connectionCount.set(e.target, (connectionCount.get(e.target) ?? 0) + 1);
    }

    const radiusScale = scaleSqrt()
        .domain([1, Math.max(1, ...connectionCount.values())])
        .range([8, 28]);

    const nodes = DEPENDENCY_GRAPH.nodes.map(n => ({
        ...n,
        r: radiusScale(connectionCount.get(n.name) ?? 1)
    }));

    const svg = select(container)
        .append('svg')
        .attr('role', 'img')
        .attr('aria-label', 'Standalone component dependency graph')
        .style('width', '100%')
        .style('height', `${height}px`)
        .style('border-width', 'var(--color-cdx-graph-border-width, 0)')
        .style('border-style', 'solid')
        .style('border-color', 'var(--color-cdx-graph-border, transparent)')
        .style('border-radius', 'var(--color-cdx-graph-radius, var(--radius-cdx-lg, 12px))')
        .style('background', 'var(--color-cdx-graph-bg, var(--color-cdx-bg-alt))')
        .style('cursor', 'grab');

    const g = svg.append('g');

    // Arrow marker for directed edges (source imports target)
    svg.append('defs')
        .append('marker')
        .attr('id', 'dep-arrow')
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 12)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-4L8,0L0,4Z')
        .attr('fill', 'var(--color-cdx-text-muted, #6b7280)')
        .attr('fill-opacity', 0.6);

    // Draw links with arrows
    const link = g
        .selectAll('.dep-link')
        .data(links)
        .enter()
        .append('line')
        .attr('class', 'dep-link')
        .attr('stroke', 'var(--color-cdx-text-muted, #6b7280)')
        .attr('stroke-opacity', 0.55)
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#dep-arrow)');

    // Draw nodes
    const node = g
        .selectAll('.dep-node')
        .data(nodes)
        .enter()
        .append('g')
        .attr('class', 'dep-node')
        .style('cursor', (d: any) => (d.url ? 'pointer' : 'default'));

    node.append('circle')
        .attr('r', (d: any) => d.r)
        .attr('fill', (d: any) => entityColorMap[d.type] ?? entityColorMap.module)
        .attr('stroke', 'var(--color-cdx-bg-elevated, white)')
        .attr('stroke-width', 2);

    // Native SVG tooltip
    node.append('title').text((d: any) => `${d.name} (${d.type})`);

    // Labels
    node.append('text')
        .attr('dy', (d: any) => d.r + 14)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', 'var(--color-cdx-text, #1a1a2e)')
        .text((d: any) => d.name);

    // Click to navigate
    node.on('click', (_event: any, d: any) => {
        if (d.url) {
            document.location.href = d.url;
        }
    });

    // Force simulation
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const simulation = forceSimulation(nodes as any)
        .force(
            'link',
            forceLink(links)
                .id((d: any) => d.name)
                .distance(80)
        )
        .force('charge', forceManyBody().strength(-120))
        .force('center', forceCenter(width / 2, height / 2))
        .force(
            'collide',
            forceCollide().radius((d: any) => d.r + 4)
        );

    // Shorten link endpoint to stop at target node edge (for arrow visibility)
    const updateLinks = () => {
        link.each(function (this: SVGLineElement, d: any) {
            const dx = d.target.x - d.source.x;
            const dy = d.target.y - d.source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetR = d.target.r ?? 8;
            const offset = targetR + 6; // node radius + arrow marker size
            this.setAttribute('x1', d.source.x);
            this.setAttribute('y1', d.source.y);
            this.setAttribute('x2', d.target.x - (dx / dist) * offset);
            this.setAttribute('y2', d.target.y - (dy / dist) * offset);
        });
    };

    if (reducedMotion) {
        simulation.stop();
        for (let i = 0; i < 300; i++) {
            simulation.tick();
        }
        updateLinks();
        node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    } else {
        simulation.on('tick', () => {
            updateLinks();
            node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        });
    }

    // Zoom + pan
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 4])
        .on('zoom', event => {
            g.attr('transform', event.transform);
        });
    svg.call(zoomBehavior);

    // Wire zoom buttons if present
    document.getElementById('dep-zoom-in')?.addEventListener('click', e => {
        e.preventDefault();
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
    });
    document.getElementById('dep-zoom-out')?.addEventListener('click', e => {
        e.preventDefault();
        svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
    });
    document.getElementById('dep-reset')?.addEventListener('click', e => {
        e.preventDefault();
        svg.transition().duration(300).call(zoomBehavior.transform, zoomIdentity);
    });
};

export const initGraphs = () => {
    // Lazy SVG loading runs synchronously (IntersectionObserver)
    initLazyGraphs();

    // Async graph initialization
    initSvgPanZoom().catch(e => console.error('SVG pan-zoom init failed:', e));
    initRoutesGraph().catch(e => console.error('Routes graph init failed:', e));
    initDomTree().catch(e => console.error('DOM tree init failed:', e));
    initDependencyGraph().catch(e => console.error('Dependency graph init failed:', e));
};
