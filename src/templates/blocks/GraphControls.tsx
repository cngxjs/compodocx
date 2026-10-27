import Html from '@kitajs/html';
import { GRAPH_EDGE_KINDS, type GraphEdgeKind } from '../../app/graph/format';
import { t } from '../helpers';

type GraphZoomControlsProps = {
    readonly prefix?: string;
    /** Number of external nodes; a toggle for them is rendered when above 0. */
    readonly externalCount?: number;
};

/** Zoom in / reset / zoom out button group for graph containers. */
export function GraphZoomControls({
    prefix = '',
    externalCount = 0
}: GraphZoomControlsProps): string {
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
            {externalCount > 0 && (
                <button
                    type="button"
                    id={`${prefix}externals`}
                    class="cdx-btn cdx-btn--sm cdx-graph-toggle"
                    aria-pressed="false"
                >
                    {t('graph-external-imports')}{' '}
                    <span class="cdx-graph-toggle-count">{String(externalCount)}</span>
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

/** Legend entries of the dependency graph, keyed by the node types they stand for. */
const DEPENDENCY_LEGEND: ReadonlyArray<LegendItem & { readonly types: readonly string[] }> = [
    {
        colorVar: 'var(--color-cdx-entity-component)',
        labelKey: 'component',
        types: ['component']
    },
    {
        colorVar: 'var(--color-cdx-entity-directive)',
        labelKey: 'directive',
        types: ['directive']
    },
    { colorVar: 'var(--color-cdx-entity-pipe)', labelKey: 'pipe', types: ['pipe'] },
    {
        colorVar: 'var(--color-cdx-entity-service)',
        labelKey: 'injectable',
        types: ['injectable', 'service']
    },
    {
        colorVar: 'var(--color-cdx-text-muted)',
        labelKey: 'graph-external-imports',
        types: ['external']
    }
];

/** The legend entries for the node types a dependency graph actually contains. */
export const dependencyLegendItems = (
    nodes: ReadonlyArray<{ readonly type: string }>
): LegendItem[] => {
    const present = new Set(nodes.map(n => n.type));
    return DEPENDENCY_LEGEND.filter(item => item.types.some(type => present.has(type))).map(
        ({ colorVar, labelKey }) => ({ colorVar, labelKey })
    );
};

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
