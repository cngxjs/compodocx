import Html from '@kitajs/html';
import {
    GRAPH_EDGE_KINDS,
    GRAPH_KINDS,
    GRAPH_KINDS_OFF,
    type GraphEdgeKind,
    type GraphKind
} from '../../app/graph/format';
import { glyphMarkup, kindClass } from '../../client/graph-draw';
import { t } from '../helpers';

type GraphZoomControlsProps = {
    readonly prefix?: string;
    /** Adds a button that plays the build-up animation again. */
    readonly replay?: boolean;
};

/** Zoom in / reset / zoom out button group for graph containers. */
export function GraphZoomControls({ prefix = '', replay = false }: GraphZoomControlsProps): string {
    return (
        <div class="cdx-graph-zoom-controls">
            <button type="button" id={`${prefix}zoom-in`} class="cdx-btn cdx-btn--sm">
                {t('zoomin')}
            </button>
            <button type="button" id={`${prefix}reset`} class="cdx-btn cdx-btn--sm">
                {t('reset')}
            </button>
            <button type="button" id={`${prefix}zoom-out`} class="cdx-btn cdx-btn--sm">
                {t('zoomout')}
            </button>
            {replay && (
                <button type="button" id={`${prefix}replay`} class="cdx-btn cdx-btn--sm">
                    {t('graph-replay')}
                </button>
            )}
        </div>
    ) as string;
}

type LegendItem = {
    readonly colorVar: string;
    readonly labelKey: string;
};

/** Colored-dot legend for dependency graphs. */
export function GraphLegend(props: { readonly items: LegendItem[] }): string {
    if (props.items.length === 0) {
        return '';
    }
    return (
        <div class="cdx-graph-legend">
            {props.items.map(item => (
                <div class="cdx-graph-legend-item">
                    <span
                        class="cdx-graph-legend-dot"
                        style={`background: ${item.colorVar}`}
                    ></span>
                    <span>{t(item.labelKey)}</span>
                </div>
            ))}
        </div>
    ) as string;
}

/** A short sample of an edge kind's stroke, drawn like the graph draws it. */
const relationSample = (kind: GraphEdgeKind): string =>
    `<svg class="cdx-graph-legend-edge cdx-graph-edge--${kind}" width="28" height="10" aria-hidden="true">` +
    `<line class="cdx-graph-edge" x1="2" y1="5" x2="26" y2="5"/>` +
    (kind === 'composes'
        ? `<line class="cdx-graph-edge-inner" x1="2" y1="5" x2="26" y2="5"/>`
        : '') +
    `<line class="cdx-graph-edge-head" x1="19" y1="5" x2="26" y2="5"/></svg>`;

/**
 * Legend of the project graph: the relation kinds it contains. The kind
 * filter chips explain the node kinds.
 */
export function GraphRelationLegend(props: {
    readonly edges: readonly { readonly kind: GraphEdgeKind }[];
}): string {
    const present = new Set(props.edges.map(e => e.kind));
    const kinds = GRAPH_EDGE_KINDS.filter(kind => present.has(kind));
    if (kinds.length === 0) {
        return '';
    }
    return (
        <div class="cdx-graph-legend cdx-graph-legend--relations">
            <span class="cdx-graph-legend-title">{t('graph-relations')}</span>
            {kinds.map(kind => (
                <div class="cdx-graph-legend-item" data-cdx-edge={kind}>
                    {relationSample(kind)}
                    <span>{t(`graph-edge-${kind}`)}</span>
                </div>
            ))}
        </div>
    ) as string;
}

/** Translation key of a kind's chip label: the plural kind, externals by their own name. */
const kindLabelKey = (kind: GraphKind): string =>
    kind === 'external' ? 'graph-external-imports' : `${kind}s`;

/**
 * One filter chip per node kind the graph contains, with its glyph and
 * count. Tokens, providers and externals start unpressed.
 */
export function GraphKindChips(props: {
    readonly nodes: readonly { readonly kind: GraphKind }[];
}): string {
    const counts = new Map<GraphKind, number>();
    for (const n of props.nodes) {
        counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
    }
    const kinds = GRAPH_KINDS.filter(kind => counts.has(kind));
    if (kinds.length === 0) {
        return '';
    }
    return (
        <fieldset class="cdx-graph-chips">
            <legend class="sr-only">{t('graph-show-kinds')}</legend>
            {kinds.map(kind => (
                <button
                    type="button"
                    class="cdx-btn cdx-btn--sm cdx-graph-chip"
                    data-cdx-kind={kind}
                    aria-pressed={String(!GRAPH_KINDS_OFF.has(kind))}
                >
                    {`<svg class="cdx-graph-chip-glyph ${kindClass(kind)}" width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">${glyphMarkup(kind, 5.5, 'none')}</svg>`}
                    <span>{t(kindLabelKey(kind))}</span>
                    <span class="cdx-graph-chip-count">{String(counts.get(kind))}</span>
                </button>
            ))}
        </fieldset>
    ) as string;
}

/** Legend of the node kinds a graph without filter chips contains, with their glyphs. */
export function GraphKindLegend(props: {
    readonly nodes: readonly { readonly kind: GraphKind }[];
}): string {
    const present = new Set(props.nodes.map(n => n.kind));
    const kinds = GRAPH_KINDS.filter(kind => present.has(kind));
    if (kinds.length === 0) {
        return '';
    }
    return (
        <div class="cdx-graph-legend cdx-graph-legend--kinds">
            {kinds.map(kind => (
                <div class="cdx-graph-legend-item" data-cdx-kind={kind}>
                    {`<svg class="cdx-graph-chip-glyph ${kindClass(kind)}" width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">${glyphMarkup(kind, 5.5, 'none')}</svg>`}
                    <span>{t(kindLabelKey(kind))}</span>
                </div>
            ))}
        </div>
    ) as string;
}
