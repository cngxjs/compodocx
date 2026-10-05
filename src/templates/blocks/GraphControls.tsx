import Html from '@kitajs/html';
import { t } from '../helpers';

type GraphZoomControlsProps = {
    readonly prefix?: string;
};

/** Zoom in / reset / zoom out button group for graph containers. */
export function GraphZoomControls({ prefix = '' }: GraphZoomControlsProps): string {
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

/** Standard legend for dependency graphs (component, directive, pipe, injectable). */
export const DEPENDENCY_LEGEND_ITEMS: LegendItem[] = [
    { colorVar: 'var(--color-cdx-entity-component)', labelKey: 'component' },
    { colorVar: 'var(--color-cdx-entity-directive)', labelKey: 'directive' },
    { colorVar: 'var(--color-cdx-entity-pipe)', labelKey: 'pipe' },
    { colorVar: 'var(--color-cdx-entity-service)', labelKey: 'injectable' }
];
