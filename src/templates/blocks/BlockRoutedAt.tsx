import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import type { RoutedAtProps } from '../helpers/routed-at';

/**
 * The routes a component is rendered at, or the places a route array is
 * mounted at, each linking its row on the routes page. Empty without links.
 *
 * Overridable as `block-routed-at` via `--templates`.
 */
export const BlockRoutedAt = (props: RoutedAtProps | undefined): string => {
    if (!props || props.links.length === 0) {
        return '';
    }
    const custom = renderCustomTemplate('block-routed-at', props);
    if (custom !== null) {
        return custom;
    }
    return (
        <section class="cdx-content-section cdx-routed-at" data-compodoc="routed-at">
            <h3 class="cdx-section-heading" id={props.id}>
                {Html.escapeHtml(props.title)}
                <a class="cdx-member-permalink" href={`#${props.id}`}>
                    #
                </a>
            </h3>
            <div class="cdx-chip-list">
                {props.links.map(link => (
                    <a class="cdx-chip cdx-chip--route" href={link.href}>
                        <code>{Html.escapeHtml(link.label)}</code>
                    </a>
                ))}
            </div>
        </section>
    ) as string;
};
