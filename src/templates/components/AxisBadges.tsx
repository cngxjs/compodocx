import Html from '@kitajs/html';
import Configuration from '../../app/configuration';
import type { EntityKind } from '../../app/engines/dependencies.engine';
import type { TableKind } from '../../app/links/symbol-id';
import { axisValuesOf, type EntityAxis } from '../helpers/axes';
import { escapeHtmlText } from '../helpers/escape';
import { ownEntry } from '../helpers/symbol-facts';

/** The axis values of an engine object of `kind`; empty without declared axes. */
export const entityAxes = (
    kind: EntityKind | TableKind,
    item: { readonly name?: unknown; readonly file?: unknown } | undefined
): readonly EntityAxis[] => {
    const data = Configuration.mainData;
    return axisValuesOf(data.semantic, ownEntry(data, kind, item));
};

/** One hero chip per classified axis, `<label>: <value>`. */
export const AxisBadges = (props: { readonly axes: readonly EntityAxis[] }): string =>
    props.axes
        .map(axis => {
            const text = escapeHtmlText(`${axis.label}: ${axis.value}`);
            return (
                <span class="cdx-badge cdx-badge--axis" data-cdx-axis={axis.name}>
                    {text}
                </span>
            ) as string;
        })
        .join('');
