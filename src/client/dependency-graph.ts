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
import { buildSchedule, dependencyLevels, levelAt } from './graph-levels';

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
/** Time between two hops of the impact wave. */
const HOP_MS = 280;
/** Speed of the flow particles on screen. */
const PARTICLE_PX_PER_S = 110;
/** Fade-in of the islands before the first symbols of the build-up appear. */
const HULL_FADE_MS = 400;
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
        easeCubicInOut,
        easeBackOut,
        timer
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
    const particleLayer = layer('particles');
    const ringLayer = layer('rings');
    const nodeLayer = layer('nodes');
    const labelLayer = layer('labels');
    const islandLabelLayer = layer('island-labels');

    let view: View = { nodes: [], edges: [], islands: [] };
    let k = 1;
    let fit = zoomIdentity;
    let userZoomed = false;
    let focus: { readonly node: ViewNode; readonly related: ReadonlySet<string> } | null = null;
    /** The clicked symbol and what its impact wave has reached so far. */
    let ripple: {
        readonly node: ViewNode;
        readonly hit: Set<string>;
        readonly run: number;
    } | null = null;
    /** The hovered or clicked symbol whose neighbourhood keeps its labels. */
    const emphasis = () => (ripple ? { node: ripple.node, related: ripple.hit } : focus);

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
        const focus = emphasis();
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
            // While the build-up grows the edges, they keep their own geometry.
            if (building) {
                return;
            }
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
    // A click on the background clears the impact wave.
    svg.on('click', () => stopRipple());

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

    let particleFrame = 0;
    const stopParticles = () => {
        cancelAnimationFrame(particleFrame);
        particleFrame = 0;
        particleLayer.selectAll('*').remove();
    };

    /** Two particles per relation of `node` travel along it in import direction. */
    const startParticles = (node: ViewNode) => {
        stopParticles();
        if (reducedMotion) {
            return;
        }
        const items = view.edges
            .filter(e => e.source === node || e.target === node)
            .flatMap(e => {
                const geo = edgeGeometry(e.source, e.target, k);
                const length = Math.max(1, Math.hypot(geo.x2 - geo.x1, geo.y2 - geo.y1));
                return [0, 0.5].map(offset => ({ geo, length, offset, kind: e.kind }));
            });
        const dots = particleLayer
            .selectAll<SVGCircleElement, (typeof items)[number]>('circle')
            .data(items)
            .join('circle')
            .attr('class', d => `cdx-graph-particle cdx-graph-edge--${d.kind}`)
            .attr('r', 2.4 / k);
        const start = performance.now();
        const tick = (now: number) => {
            // Constant speed on screen, whatever the zoom.
            const travelled = ((now - start) / 1000) * (PARTICLE_PX_PER_S / k);
            dots.each(function (d) {
                const t = (travelled / d.length + d.offset) % 1;
                this.setAttribute('cx', String(d.geo.x1 + (d.geo.x2 - d.geo.x1) * t));
                this.setAttribute('cy', String(d.geo.y1 + (d.geo.y2 - d.geo.y1) * t));
                this.setAttribute('opacity', String(Math.min(1, t * 6, (1 - t) * 6)));
            });
            particleFrame = requestAnimationFrame(tick);
        };
        particleFrame = requestAnimationFrame(tick);
    };

    const setFocus = (node: ViewNode | null) => {
        if (node) {
            startParticles(node);
        } else {
            stopParticles();
        }
        // During an impact wave the wave keeps the highlight.
        if (ripple) {
            return;
        }
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

        // Without a glide every attribute is set at once: a zero-length transition
        // would run a tick later, after the build-up has already interrupted it.
        const hulls = hullLayer
            .selectAll<SVGPathElement, Island>('path')
            .data(view.islands, d => d.id)
            .join(enter =>
                enter
                    .append('path')
                    .attr('class', 'cdx-graph-hull')
                    .attr('opacity', duration ? 0 : null)
            );
        if (duration) {
            hulls
                .transition()
                .duration(duration)
                .ease(ease)
                .attr('opacity', 1)
                .attr('d', d => hullPath(d.members));
        } else {
            hulls.attr('opacity', null).attr('d', d => hullPath(d.members));
        }

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
                        .attr('opacity', duration ? 0 : null);
                    g.append('line').attr('class', 'cdx-graph-edge');
                    g.filter(e => e.kind === 'composes')
                        .append('line')
                        .attr('class', 'cdx-graph-edge-inner');
                    g.append('line').attr('class', 'cdx-graph-edge-head');
                    return g;
                },
                update => update,
                exit =>
                    duration
                        ? exit
                              .transition()
                              .duration(duration / 3)
                              .attr('opacity', 0)
                              .remove()
                        : exit.remove()
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
                group
                    .transition()
                    .duration(duration)
                    .ease(ease)
                    .attr('opacity', 1)
                    .on('end', () => group.attr('opacity', null));
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
                            d => `translate(${d.x},${d.y})${duration ? ' scale(0.01)' : ''}`
                        );
                    // A real link, so a modifier or middle click opens the page like any
                    // link; a plain click starts the impact wave instead. Not in the tab
                    // order: the page lists every symbol for keyboard and screen readers.
                    const link = g
                        .append('a')
                        .attr('class', 'cdx-graph-node-link')
                        .attr('tabindex', '-1');
                    link.append('g').attr('class', 'cdx-graph-glyph');
                    link.append('circle').attr('class', 'cdx-graph-hit');
                    link.append('title');
                    g.on('pointerenter', (_event, d) => setFocus(d));
                    g.on('pointerleave', () => setFocus(null));
                    g.on('click', (event: MouseEvent, d) => {
                        const opensLink =
                            event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
                        if (opensLink && d.url) {
                            return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                        playRipple(d);
                    });
                    return g;
                },
                update => update,
                exit =>
                    duration
                        ? exit
                              .transition()
                              .duration(duration / 3)
                              .attr('opacity', 0)
                              .remove()
                        : exit.remove()
            )
            .attr(
                'class',
                d => `dep-node cdx-graph-node cdx-graph-node--${d.kind}${d.url ? ' is-link' : ''}`
            );
        nodes.select('a').attr('href', d => (d.url ? `${root}${d.url}` : null));
        nodes.select('g.cdx-graph-glyph').html(d => glyphMarkup(d.kind, d.r));
        nodes.select('circle.cdx-graph-hit').attr('r', d => d.r + 2);
        nodes.select('title').text(d => `${d.name} (${d.kind})`);
        const at = (d: ViewNode) => `translate(${d.x},${d.y})`;
        if (duration) {
            nodes.transition().duration(duration).ease(ease).attr('transform', at);
        } else {
            nodes.attr('transform', at);
        }

        const labels = labelLayer
            .selectAll<SVGTextElement, ViewNode>('text')
            .data(view.nodes, d => d.id)
            .join(enter =>
                enter.append('text').attr('class', 'cdx-graph-label is-culled').attr('dy', '1.1em')
            )
            .text(d => d.name);
        const labelAt = (d: ViewNode) => ({ x: d.x, y: d.y + d.r });
        if (duration) {
            labels
                .transition()
                .duration(duration)
                .ease(ease)
                .attr('x', d => labelAt(d).x)
                .attr('y', d => labelAt(d).y);
        } else {
            labels.attr('x', d => labelAt(d).x).attr('y', d => labelAt(d).y);
        }

        const islandLabels = islandLabelLayer
            .selectAll<SVGTextElement, Island>('text')
            .data(view.islands, d => d.id)
            .join(enter => enter.append('text').attr('class', 'cdx-graph-island-label is-culled'))
            .text(d => d.label);
        if (duration) {
            islandLabels
                .transition()
                .duration(duration)
                .ease(ease)
                .attr('x', d => islandLabelAnchor(d.members).x)
                .attr('y', d => islandLabelAnchor(d.members).y);
        } else {
            islandLabels
                .attr('x', d => islandLabelAnchor(d.members).x)
                .attr('y', d => islandLabelAnchor(d.members).y);
        }

        for (const n of view.nodes) {
            positions.set(n.id, { x: n.x, y: n.y });
        }
        setTimeout(cullLabels, duration);
    };

    const badge = container.parentElement?.querySelector<HTMLElement>('.cdx-graph-impact');
    let rippleRun = 0;

    const stopRipple = () => {
        rippleRun++;
        if (!ripple) {
            return;
        }
        ripple = null;
        svg.classed('is-rippling', false);
        nodeLayer.selectAll('g.cdx-graph-node').classed('is-hit', false);
        edgeLayer.selectAll('g.cdx-graph-edge-group').classed('is-wave', false);
        ringLayer.selectAll('*').interrupt().remove();
        if (badge) {
            badge.hidden = true;
            badge.replaceChildren();
        }
        cullLabels();
    };

    /** The badge of an impact wave: the symbol (a link to its page) and who uses it. */
    const showBadge = (node: ViewNode, total: number, direct: number, features: number) => {
        if (!badge) {
            return;
        }
        const name = document.createElement(node.url ? 'a' : 'strong');
        name.className = 'cdx-graph-impact-name';
        name.textContent = node.name;
        if (node.url && name instanceof HTMLAnchorElement) {
            name.href = `${root}${node.url}`;
        }
        const impact = document.createElement('span');
        impact.className = 'cdx-graph-impact-text';
        impact.textContent =
            total > 0
                ? (badge.dataset.cdxTemplate ?? '')
                      .replace('{total}', String(total))
                      .replace('{direct}', String(direct))
                      .replace('{features}', String(features))
                : (badge.dataset.cdxNone ?? '');
        const hint = document.createElement('small');
        hint.className = 'cdx-graph-impact-hint';
        hint.textContent = badge.dataset.cdxHint ?? '';
        badge.replaceChildren(name, impact, hint);
        badge.hidden = false;
    };

    /**
     * The impact wave: everything that uses `node`, directly or through others,
     * lights up hop by hop with a pulse; the rest dims. Clicking it again clears.
     */
    const playRipple = (node: ViewNode) => {
        if (ripple?.node === node) {
            stopRipple();
            return;
        }
        stopRipple();
        stopBuild();
        const users = new Map<string, ViewEdge[]>();
        for (const e of view.edges) {
            users.set(e.target.id, [...(users.get(e.target.id) ?? []), e]);
        }
        const hops = new Map<string, number>([[node.id, 0]]);
        const wave = new Set<ViewEdge>();
        const queue = [node.id];
        for (let head = 0; head < queue.length; head++) {
            const v = queue[head];
            const hop = hops.get(v) ?? 0;
            for (const e of users.get(v) ?? []) {
                if (!hops.has(e.source.id)) {
                    hops.set(e.source.id, hop + 1);
                    queue.push(e.source.id);
                }
                if (hops.get(e.source.id) === hop + 1) {
                    wave.add(e);
                }
            }
        }
        const run = ++rippleRun;
        ripple = { node, hit: new Set(), run };
        setFocus(null);
        focus = null;
        svg.classed('is-focusing', false).classed('is-rippling', true);
        const byHop = new Map<number, ViewNode[]>();
        for (const n of view.nodes) {
            const hop = hops.get(n.id);
            if (hop !== undefined) {
                byHop.set(hop, [...(byHop.get(hop) ?? []), n]);
            }
        }
        const at = (hop: number) => (reducedMotion ? 0 : hop * HOP_MS);
        for (const [hop, reached] of byHop) {
            setTimeout(() => {
                if (ripple?.run !== run) {
                    return;
                }
                const ids = new Set(reached.map(n => n.id));
                for (const id of ids) {
                    ripple.hit.add(id);
                }
                nodeLayer
                    .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
                    .filter(d => ids.has(d.id))
                    .classed('is-hit', true);
                edgeLayer
                    .selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group')
                    .filter(e => wave.has(e) && ids.has(e.source.id))
                    .classed('is-wave', true);
                if (!reducedMotion) {
                    for (const n of reached) {
                        ringLayer
                            .append('circle')
                            .attr('class', 'cdx-graph-pulse')
                            .attr('cx', n.x)
                            .attr('cy', n.y)
                            .attr('r', n.r)
                            .transition()
                            .duration(900)
                            .ease(easeCubicOut)
                            .attr('r', n.r + 30 / k)
                            .style('opacity', 0)
                            .remove();
                    }
                }
                cullLabels();
            }, at(hop));
        }
        const reachedIds = [...hops.keys()].filter(id => id !== node.id);
        const groupOfId = new Map(view.nodes.map(n => [n.id, n.group]));
        const features = new Set(
            reachedIds.map(id => groupOfId.get(id) ?? '').filter(group => !group.startsWith('~'))
        );
        showBadge(
            node,
            reachedIds.length,
            [...hops.values()].filter(hop => hop === 1).length,
            features.size
        );
    };

    const status = container.parentElement?.querySelector<HTMLElement>('.cdx-graph-status');
    let building = false;
    let buildTimer: ReturnType<D3['timer']> | null = null;

    /** End a running build-up at once: every part at its final place. */
    const stopBuild = () => {
        buildTimer?.stop();
        buildTimer = null;
        if (!building) {
            return;
        }
        building = false;
        hullLayer.selectAll('path').interrupt().attr('opacity', null);
        nodeLayer
            .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
            .interrupt()
            .attr('transform', n => `translate(${n.x},${n.y})`);
        edgeLayer.selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group').each(function (e) {
            select(this).selectAll('line').interrupt().attr('opacity', null);
            placeEdge(this, e);
        });
        svg.classed('is-building', false).classed('is-revealing', false);
        if (status) {
            status.hidden = true;
        }
        cullLabels();
    };

    /**
     * Build the graph up: the islands fade in, then the symbols pop in level by
     * level, primitives first (level 0 island by island from the middle), and
     * each edge grows from the user to what it uses once the user is there.
     */
    const playBuild = () => {
        stopBuild();
        stopRipple();
        if (reducedMotion || view.nodes.length === 0) {
            cullLabels();
            return;
        }
        building = true;
        const level = dependencyLevels(
            view.nodes.map(n => n.id),
            view.edges.map(e => ({ source: e.source.id, target: e.target.id }))
        );
        const schedule = buildSchedule(
            view.nodes.map(n => ({
                id: n.id,
                group: n.group,
                x: n.x,
                y: n.y,
                level: level.get(n.id) ?? 0
            }))
        );
        const appear = (n: ViewNode) => HULL_FADE_MS + (schedule.at.get(n.id) ?? 0);
        // CSS opacity transitions would lag behind the build-up; they come back after it.
        svg.classed('is-revealing', true).classed('is-building', true);
        hullLayer
            .selectAll('path')
            .interrupt()
            .attr('opacity', 0)
            .transition()
            .duration(HULL_FADE_MS + 200)
            .attr('opacity', 1);
        nodeLayer
            .selectAll<SVGGElement, ViewNode>('g.cdx-graph-node')
            .interrupt()
            .attr('opacity', null)
            .attr('transform', n => `translate(${n.x},${n.y}) scale(0.01)`)
            .transition()
            .delay(appear)
            .duration(450)
            .ease(easeBackOut.overshoot(1.7))
            .attr('transform', n => `translate(${n.x},${n.y})`);
        edgeLayer
            .selectAll<SVGGElement, ViewEdge>('g.cdx-graph-edge-group')
            .interrupt()
            .attr('opacity', null)
            .each(function (e) {
                const geo = edgeGeometry(e.source, e.target, k);
                const start = appear(e.source) + 160;
                const group = select(this);
                group
                    .selectAll('.cdx-graph-edge, .cdx-graph-edge-inner')
                    .interrupt()
                    .attr('x1', geo.x1)
                    .attr('y1', geo.y1)
                    .attr('x2', geo.x1)
                    .attr('y2', geo.y1)
                    .transition()
                    .delay(start)
                    .duration(320)
                    .ease(easeCubicOut)
                    .attr('x2', geo.x2)
                    .attr('y2', geo.y2);
                group
                    .select('.cdx-graph-edge-head')
                    .interrupt()
                    .attr('opacity', 0)
                    .attr('x1', geo.hx)
                    .attr('y1', geo.hy)
                    .attr('x2', geo.x2)
                    .attr('y2', geo.y2)
                    .transition()
                    .delay(start + 300)
                    .duration(160)
                    .attr('opacity', 1);
            });
        const template = status?.dataset.cdxTemplate ?? '';
        if (status && template) {
            status.hidden = false;
        }
        const end = HULL_FADE_MS + schedule.endMs + 800;
        buildTimer = timer(elapsed => {
            if (status && template) {
                status.textContent = template
                    .replace(
                        '{level}',
                        String(levelAt(schedule, Math.max(0, elapsed - HULL_FADE_MS)) + 1)
                    )
                    .replace('{total}', String(schedule.top + 1));
            }
            if (elapsed > end) {
                stopBuild();
            }
        });
    };

    /** Show the fitted graph and build it up. */
    const reveal = () => {
        computeFit();
        svg.call(zoomBehavior.transform, fit);
        world.attr('visibility', null);
        playBuild();
    };

    /** Show the graph for new kinds: lay out what moved, then glide there. */
    const showKinds = async (next: Set<GraphKind>) => {
        stopBuild();
        stopRipple();
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

    document.getElementById('dep-replay')?.addEventListener('click', e => {
        e.preventDefault();
        playBuild();
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
