import Html from '@kitajs/html';
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
