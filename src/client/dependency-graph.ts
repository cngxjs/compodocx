/**
 * The project dependency graph on the overview: loads `js/graph.js` once the
 * graph scrolls into view, draws the build-time layout as feature islands,
 * and lays the graph out again when the shown kinds change.
 */

import {
    defaultKinds,
    GRAPH_SCHEMA_VERSION,
    type GraphEdgeKind,
    type GraphFile,
    type GraphKind,
    visibleGraph
} from '../app/graph/format';
import { degreesOf, groupOf, type LayoutNode, layoutSteps, nodeRadius } from '../app/graph/layout';
import { edgeGeometry, glyphMarkup, hullPoints, islandLabelAnchor, labelOrder } from './graph-draw';
import { type Box, fitTransform, graphHeight, nonOverlapping } from './graph-layout';

declare global {
    interface Window {
        __CDX_GRAPH__?: GraphFile;
    }
}

type D3 = typeof import('d3');

/** Label size on screen; the label font is divided by the zoom so it stays this size. */
const LABEL_FONT_PX = 11;
const LABEL_LINE_PX = 14;
const FIT_PAD_PX = 28;
const FIT_MAX_SCALE = 2;
/** Duration of the glide to new positions after the shown kinds change. */
const GLIDE_MS = 700;
/** Layout work per animation frame before the next frame is awaited. */
const FRAME_BUDGET_MS = 10;

interface ViewNode {
    readonly id: string;
    readonly name: string;
    readonly kind: GraphKind;
    readonly url?: string;
    readonly group: string;
    readonly r: number;
    readonly degree: number;
    readonly labelWidth: number;
    x: number;
    y: number;
}

interface ViewEdge {
    readonly key: string;
    readonly source: ViewNode;
    readonly target: ViewNode;
    readonly kind: GraphEdgeKind;
    /** Between two islands: drawn faint until one end is hovered. */
    readonly far: boolean;
}

interface Island {
    readonly id: string;
    readonly label: string;
    readonly labelWidth: number;
    readonly members: readonly ViewNode[];
}

interface View {
    readonly nodes: readonly ViewNode[];
    readonly edges: readonly ViewEdge[];
    readonly islands: readonly Island[];
}

const loaded = new Map<string, Promise<GraphFile | undefined>>();

/** The graph data behind `src`, loaded once as a classic script (works on `file://` too). */
export const loadGraphFile = (src: string): Promise<GraphFile | undefined> => {
    const known = loaded.get(src);
    if (known) {
        return known;
    }
    const pending = new Promise<GraphFile | undefined>(resolve => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            const file = window.__CDX_GRAPH__;
            window.__CDX_GRAPH__ = undefined;
            resolve(file?.schemaVersion === GRAPH_SCHEMA_VERSION ? file : undefined);
        };
        script.onerror = () => resolve(undefined);
        document.head.appendChild(script);
    });
    loaded.set(src, pending);
    return pending;
};

const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve));

/** Label widths at the label font, measured once without layout. */
const textMeasurer = (container: HTMLElement, weight: string): ((text: string) => number) => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) {
        return text => text.length * LABEL_FONT_PX * 0.62;
    }
    context.font = `${weight} ${LABEL_FONT_PX}px ${getComputedStyle(container).fontFamily}`;
    return text => context.measureText(text).width;
};

const overlapsAny = (box: Box, others: readonly Box[]): boolean =>
    others.some(
        o =>
            box.x < o.x + o.width &&
            o.x < box.x + box.width &&
            box.y < o.y + o.height &&
            o.y < box.y + box.height
    );

/** Draw the overview graph into `container`; resolves once it is shown. */
export const drawDependencyGraph = async (
    container: HTMLElement,
    file: GraphFile,
    d3: D3
): Promise<void> => {
    const root = container.dataset.cdxRoot ?? '';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = textMeasurer(container, '400');
    const measureIsland = textMeasurer(container, '600');
    const featureLabel = new Map(file.features.map(f => [f.id, f.label]));
    const positions = new Map(
        file.nodes.flatMap(n =>
            n.x === undefined || n.y === undefined ? [] : [[n.id, { x: n.x, y: n.y }] as const]
        )
    );
    const chips = [
        ...(container
            .closest('.cdx-graph-container')
            ?.querySelectorAll<HTMLButtonElement>('.cdx-graph-chip[data-cdx-kind]') ?? [])
    ];
    const kindOf = (chip: HTMLElement) => chip.dataset.cdxKind as GraphKind;
    let kinds =
        chips.length > 0
            ? new Set(chips.filter(c => c.getAttribute('aria-pressed') === 'true').map(kindOf))
            : defaultKinds(file.nodes);

    /** The shown part of the graph at the current kinds, positioned where known. */
    const viewOf = (): { view: View; unplaced: boolean } => {
        const visible = visibleGraph(file, kinds);
        const degree = degreesOf(visible.edges);
        const nodes: ViewNode[] = visible.nodes.map(n => {
            const at = positions.get(n.id);
            return {
                id: n.id,
                name: n.name,
                kind: n.kind,
                url: n.url,
                group: groupOf(n),
                degree: degree.get(n.id) ?? 0,
                r: nodeRadius(degree.get(n.id) ?? 0),
                labelWidth: measure(n.name),
                x: at?.x ?? Number.NaN,
                y: at?.y ?? Number.NaN
            };
        });
        const byId = new Map(nodes.map(n => [n.id, n]));
        const edges: ViewEdge[] = visible.edges.flatMap(e => {
            const source = byId.get(e.source);
            const target = byId.get(e.target);
            return source && target
                ? [
                      {
                          key: `${e.source}>${e.target}>${e.kind}`,
                          source,
                          target,
                          kind: e.kind,
                          far: source.group !== target.group
                      }
                  ]
                : [];
        });
        const groups = new Map<string, ViewNode[]>();
        for (const n of nodes) {
            groups.set(n.group, [...(groups.get(n.group) ?? []), n]);
        }
        const islands: Island[] = [...groups].flatMap(([id, members]) => {
            const label = featureLabel.get(id);
            return label !== undefined && members.length > 1
                ? [{ id, label, labelWidth: measureIsland(label), members }]
                : [];
        });
        return {
            view: { nodes, edges, islands },
            unplaced: nodes.some(n => Number.isNaN(n.x))
        };
    };

    let layoutRun = 0;
    /** Lay the view out from the current positions, a slice per animation frame. */
    const layOut = async (view: View): Promise<boolean> => {
        const run = ++layoutRun;
        const layout: LayoutNode[] = view.nodes.map(n => ({
            id: n.id,
            group: n.group,
            r: n.r,
            ...(Number.isNaN(n.x) ? {} : { x: n.x, y: n.y })
        }));
        let frameStart = performance.now();
        for (const _ of layoutSteps(
            d3,
            layout,
            view.edges.map(e => ({ source: e.source.id, target: e.target.id }))
        )) {
            if (performance.now() - frameStart > FRAME_BUDGET_MS) {
                await nextFrame();
                if (run !== layoutRun) {
                    return false;
                }
                frameStart = performance.now();
            }
        }
        for (const [i, n] of view.nodes.entries()) {
            n.x = layout[i].x ?? 0;
            n.y = layout[i].y ?? 0;
        }
        return true;
    };

    const {
        select,
        zoom,
        zoomIdentity,
        polygonHull,
        line,
        curveCatmullRomClosed,
        easeCubicOut,
        easeCubicInOut
    } = d3;

    const svg = select(container)
        .append('svg')
        .attr('class', 'cdx-project-graph')
        .attr('role', 'img')
        .attr('aria-label', container.dataset.cdxLabel ?? '')
        .style('width', '100%');
    const world = svg.append('g').attr('visibility', 'hidden');
    const layer = (name: string) => world.append('g').attr('class', `cdx-graph-layer-${name}`);
    const hullLayer = layer('hulls');
    const edgeLayer = layer('edges');
    layer('particles');
    layer('rings');
    const nodeLayer = layer('nodes');
    const labelLayer = layer('labels');
    const islandLabelLayer = layer('island-labels');

    let view: View = { nodes: [], edges: [], islands: [] };
    let k = 1;
    let fit = zoomIdentity;
    let userZoomed = false;
    let focus: { readonly node: ViewNode; readonly related: ReadonlySet<string> } | null = null;

    const hullPath = (members: readonly ViewNode[]): string => {
        const hull = polygonHull(hullPoints(members));
        return hull ? (line().curve(curveCatmullRomClosed.alpha(1))(hull) ?? '') : '';
    };

    const placeEdge = (g: SVGGElement, e: ViewEdge) => {
        const geo = edgeGeometry(e.source, e.target, k);
        for (const el of g.querySelectorAll<SVGLineElement>(
            '.cdx-graph-edge, .cdx-graph-edge-inner'
        )) {
            el.setAttribute('x1', String(geo.x1));
            el.setAttribute('y1', String(geo.y1));
            el.setAttribute('x2', String(geo.x2));
            el.setAttribute('y2', String(geo.y2));
        }
        const head = g.querySelector<SVGLineElement>('.cdx-graph-edge-head');
        head?.setAttribute('x1', String(geo.hx));
        head?.setAttribute('y1', String(geo.hy));
        head?.setAttribute('x2', String(geo.x2));
        head?.setAttribute('y2', String(geo.y2));
    };

    /**
     * Show the labels that fit at the current zoom: island names first (the
     * biggest islands first), then symbols by degree. No label overlaps
     * another label or a node. While a node is hovered only it and its
     * neighbours are labelled.
     */
    const cullLabels = () => {
        const gap = 2 / k;
        const circles: Box[] = view.nodes.map(n => ({
            x: n.x - n.r,
            y: n.y - n.r,
            width: n.r * 2,
            height: n.r * 2
        }));
        const islandBoxes: Box[] = view.islands.map(island => {
            const anchor = islandLabelAnchor(island.members);
            const width = island.labelWidth / k;
            return {
                x: anchor.x - width / 2,
                y: anchor.y - LABEL_LINE_PX / k,
                width,
                height: LABEL_LINE_PX / k
            };
        });
        const islandOrder = view.islands
            .map((_, i) => i)
            .filter(i => !focus || view.islands[i].members.some(m => focus?.related.has(m.id)))
            .sort((a, b) => view.islands[b].members.length - view.islands[a].members.length);
        const shownIslands = nonOverlapping(islandBoxes, islandOrder, gap);
        const labelBoxes: Box[] = view.nodes.map(n => ({
            x: n.x - n.labelWidth / 2 / k,
            y: n.y + n.r + 3 / k,
            width: n.labelWidth / k,
            height: LABEL_LINE_PX / k
        }));
        const order = labelOrder(view.nodes);
        const nodeOrder = focus
            ? [
                  view.nodes.indexOf(focus.node),
                  ...order.filter(
                      i => view.nodes[i] !== focus?.node && focus?.related.has(view.nodes[i].id)
                  )
              ]
            : order;
        const kept = [...shownIslands].map(i => islandBoxes[i]);
        const shown = new Set<number>();
        for (const i of nodeOrder) {
            const box = labelBoxes[i];
            if (!box || overlapsAny(box, kept)) {
                continue;
            }
            // Around the hovered node, labels may cross nodes; elsewhere they keep clear.
            if (!focus && overlapsAny(box, circles)) {
                continue;
            }
            kept.push({
                x: box.x - gap,
                y: box.y - gap,
                width: box.width + gap * 2,
                height: box.height + gap * 2
            });
            shown.add(i);
        }
        const islandShown = new Set([...shownIslands].map(i => view.islands[i].id));
        islandLabelLayer
            .selectAll<SVGTextElement, Island>('text')
            .classed('is-culled', d => !islandShown.has(d.id));
        const nodeShown = new Set([...shown].map(i => view.nodes[i].id));
        labelLayer
            .selectAll<SVGTextElement, ViewNode>('text')
            .classed('is-culled', d => !nodeShown.has(d.id));
    };

    let frame = 0;
    const scheduleFrame = () => {
        if (frame) {
            return;
        }
        frame = requestAnimationFrame(() => {
            frame = 0;
            edgeLayer.selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group').each(function (e) {
                placeEdge(this, e);
            });
            cullLabels();
        });
    };

    const zoomBehavior = zoom<SVGSVGElement, unknown>().on('zoom', event => {
        world.attr('transform', event.transform);
        k = event.transform.k;
        svg.style('--cdx-graph-k', String(k));
        if (event.sourceEvent) {
            userZoomed = true;
        }
        scheduleFrame();
    });
    svg.call(zoomBehavior).on('dblclick.zoom', null);

    const height = () => graphHeight(view.nodes.length);

    const computeFit = () => {
        if (view.nodes.length === 0) {
            fit = zoomIdentity;
            return;
        }
        const xs = view.nodes.flatMap(n => [n.x - n.r - 40, n.x + n.r + 40]);
        const ys = view.nodes.flatMap(n => [n.y - n.r - 34, n.y + n.r + 24]);
        const bounds = {
            x: Math.min(...xs),
            y: Math.min(...ys),
            width: Math.max(...xs) - Math.min(...xs),
            height: Math.max(...ys) - Math.min(...ys)
        };
        const t = fitTransform(
            bounds,
            container.clientWidth || 800,
            height(),
            FIT_PAD_PX,
            FIT_MAX_SCALE
        );
        fit = zoomIdentity.translate(t.x, t.y).scale(t.k);
        zoomBehavior.scaleExtent([Math.min(0.1, t.k / 2), 6]);
    };

    const setFocus = (node: ViewNode | null) => {
        const related = new Set<string>(node ? [node.id] : []);
        if (node) {
            for (const e of view.edges) {
                if (e.source === node) {
                    related.add(e.target.id);
                }
                if (e.target === node) {
                    related.add(e.source.id);
                }
            }
        }
        focus = node ? { node, related } : null;
        svg.classed('is-focusing', !!node);
        nodeLayer
            .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
            .classed('is-related', d => related.has(d.id));
        labelLayer
            .selectAll<SVGTextElement, ViewNode>('text')
            .classed('is-related', d => related.has(d.id));
        edgeLayer
            .selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group')
            .classed('is-related', e => !!node && (e.source === node || e.target === node));
        hullLayer
            .selectAll<SVGPathElement, Island>('path')
            .classed('is-related', d => d.members.some(m => related.has(m.id)));
        cullLabels();
    };

    /** Draw `view`; with `glide` the kept parts move to their new places. */
    const render = (glide: boolean) => {
        const duration = glide && !reducedMotion ? GLIDE_MS : 0;
        const ease = easeCubicInOut;
        svg.style('height', `${height()}px`);

        hullLayer
            .selectAll<SVGPathElement, Island>('path')
            .data(view.islands, d => d.id)
            .join(enter =>
                enter
                    .append('path')
                    .attr('class', 'cdx-graph-hull')
                    .attr('opacity', glide ? 0 : null)
            )
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('opacity', 1)
            .attr('d', d => hullPath(d.members));

        edgeLayer
            .selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group')
            .data(view.edges, e => e.key)
            .join(
                enter => {
                    const g = enter
                        .append('g')
                        .attr(
                            'class',
                            e =>
                                `cdx-graph-edge-group cdx-graph-edge--${e.kind}${e.far ? ' is-far' : ''}`
                        )
                        .attr('opacity', glide ? 0 : null);
                    g.append('line').attr('class', 'cdx-graph-edge');
                    g.filter(e => e.kind === 'composes')
                        .append('line')
                        .attr('class', 'cdx-graph-edge-inner');
                    g.append('line').attr('class', 'cdx-graph-edge-head');
                    return g;
                },
                update => update,
                exit =>
                    exit
                        .transition()
                        .duration(duration / 3)
                        .attr('opacity', 0)
                        .remove()
            )
            .each(function (e) {
                if (!duration) {
                    placeEdge(this, e);
                    return;
                }
                const geo = edgeGeometry(e.source, e.target, k);
                const group = select(this);
                group
                    .selectAll('.cdx-graph-edge, .cdx-graph-edge-inner')
                    .transition()
                    .duration(duration)
                    .ease(ease)
                    .attr('x1', geo.x1)
                    .attr('y1', geo.y1)
                    .attr('x2', geo.x2)
                    .attr('y2', geo.y2);
                group
                    .select('.cdx-graph-edge-head')
                    .transition()
                    .duration(duration)
                    .ease(ease)
                    .attr('x1', geo.hx)
                    .attr('y1', geo.hy)
                    .attr('x2', geo.x2)
                    .attr('y2', geo.y2);
            })
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('opacity', 1)
            .on('end', function () {
                select(this).attr('opacity', null);
            });

        const nodes = nodeLayer
            .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
            .data(view.nodes, d => d.id)
            .join(
                enter => {
                    const g = enter
                        .append('g')
                        .attr('class', 'cdx-graph-node')
                        .attr(
                            'transform',
                            d => `translate(${d.x},${d.y})${glide ? ' scale(0.01)' : ''}`
                        );
                    g.append('g').attr('class', 'cdx-graph-glyph');
                    g.append('circle').attr('class', 'cdx-graph-hit');
                    g.append('title');
                    g.on('pointerenter', (_event, d) => setFocus(d));
                    g.on('pointerleave', () => setFocus(null));
                    g.on('click', (_event, d) => {
                        if (d.url) {
                            document.location.href = `${root}${d.url}`;
                        }
                    });
                    return g;
                },
                update => update,
                exit =>
                    exit
                        .transition()
                        .duration(duration / 3)
                        .attr('opacity', 0)
                        .remove()
            )
            .attr(
                'class',
                d => `dep-node cdx-graph-node cdx-graph-node--${d.kind}${d.url ? ' is-link' : ''}`
            );
        nodes.select('g.cdx-graph-glyph').html(d => glyphMarkup(d.kind, d.r));
        nodes.select('circle.cdx-graph-hit').attr('r', d => d.r + 2);
        nodes.select('title').text(d => `${d.name} (${d.kind})`);
        nodes
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('transform', d => `translate(${d.x},${d.y})`);

        labelLayer
            .selectAll<SVGTextElement, ViewNode>('text')
            .data(view.nodes, d => d.id)
            .join(enter =>
                enter.append('text').attr('class', 'cdx-graph-label is-culled').attr('dy', '1.1em')
            )
            .text(d => d.name)
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('x', d => d.x)
            .attr('y', d => d.y + d.r);

        islandLabelLayer
            .selectAll<SVGTextElement, Island>('text')
            .data(view.islands, d => d.id)
            .join(enter => enter.append('text').attr('class', 'cdx-graph-island-label is-culled'))
            .text(d => d.label)
            .transition()
            .duration(duration)
            .ease(ease)
            .attr('x', d => islandLabelAnchor(d.members).x)
            .attr('y', d => islandLabelAnchor(d.members).y);

        for (const n of view.nodes) {
            positions.set(n.id, { x: n.x, y: n.y });
        }
        setTimeout(cullLabels, duration);
    };

    let revealRun = 0;
    /** Show the fitted graph; the nodes grow outward from the middle. */
    const reveal = () => {
        computeFit();
        svg.call(zoomBehavior.transform, fit);
        cullLabels();
        world.attr('visibility', null);
        if (reducedMotion || view.nodes.length === 0) {
            return;
        }
        // CSS opacity transitions would lag behind the entrance; they come back after it.
        svg.classed('is-revealing', true);
        const cx = view.nodes.reduce((sum, n) => sum + n.x, 0) / view.nodes.length;
        const cy = view.nodes.reduce((sum, n) => sum + n.y, 0) / view.nodes.length;
        const distance = (n: ViewNode) => Math.hypot(n.x - cx, n.y - cy);
        const farthest = Math.max(1, ...view.nodes.map(distance));
        const delay = (n: ViewNode) => (distance(n) / farthest) * 500;
        const hulls = hullLayer
            .selectAll('path')
            .attr('opacity', 0)
            .transition()
            .duration(500)
            .attr('opacity', 1);
        const nodes = nodeLayer
            .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
            .attr('opacity', 0)
            .attr('transform', n => `translate(${n.x},${n.y}) scale(0.2)`)
            .transition()
            .delay(delay)
            .duration(600)
            .ease(easeCubicOut)
            .attr('opacity', 1)
            .attr('transform', n => `translate(${n.x},${n.y})`)
            .on('end', function () {
                select(this).attr('opacity', null);
            });
        const edges = edgeLayer
            .selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group')
            .attr('opacity', 0)
            .transition()
            .delay(e => Math.max(delay(e.source), delay(e.target)) + 450)
            .duration(400)
            .attr('opacity', 1)
            .on('end', function () {
                select(this).attr('opacity', null);
            });
        const run = ++revealRun;
        Promise.allSettled([hulls.end(), nodes.end(), edges.end()]).then(() => {
            if (run === revealRun) {
                svg.classed('is-revealing', false);
            }
        });
    };

    /** Show the graph for new kinds: lay out what moved, then glide there. */
    const showKinds = async (next: Set<GraphKind>) => {
        kinds = next;
        const { view: nextView } = viewOf();
        setFocus(null);
        if (!(await layOut(nextView))) {
            return;
        }
        view = nextView;
        render(true);
        if (!userZoomed) {
            computeFit();
            svg.transition()
                .duration(reducedMotion ? 0 : GLIDE_MS)
                .call(zoomBehavior.transform, fit);
        }
    };

    const first = viewOf();
    view = first.view;
    if (first.unplaced) {
        await layOut(view);
    }
    render(false);
    reveal();

    if ('ResizeObserver' in window) {
        let lastWidth = container.clientWidth;
        new ResizeObserver(() => {
            const width = container.clientWidth;
            if (userZoomed || width === lastWidth || width === 0) {
                return;
            }
            lastWidth = width;
            computeFit();
            svg.call(zoomBehavior.transform, fit);
        }).observe(container);
    }

    for (const chip of chips) {
        chip.addEventListener('click', e => {
            e.preventDefault();
            const kind = kindOf(chip);
            const next = new Set(kinds);
            if (next.has(kind)) {
                next.delete(kind);
            } else {
                next.add(kind);
            }
            chip.setAttribute('aria-pressed', String(next.has(kind)));
            void showKinds(next);
        });
    }

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
        computeFit();
        svg.transition().duration(300).call(zoomBehavior.transform, fit);
    });
};

/** Load and draw the overview graph once its container scrolls into view. */
export const initProjectGraph = (container: HTMLElement, loadD3: () => Promise<D3>): void => {
    const src = container.dataset.cdxGraphSrc;
    if (!src) {
        return;
    }
    const start = async () => {
        const [file, d3] = await Promise.all([loadGraphFile(src), loadD3()]);
        if (file && container.isConnected) {
            await drawDependencyGraph(container, file, d3);
        }
    };
    if (!('IntersectionObserver' in window)) {
        void start();
        return;
    }
    const observer = new IntersectionObserver(
        entries => {
            if (entries.some(e => e.isIntersecting)) {
                observer.disconnect();
                start().catch(e => console.error('Dependency graph init failed:', e));
            }
        },
        { rootMargin: '200px' }
    );
    observer.observe(container);
};
