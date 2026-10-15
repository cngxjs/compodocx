import Html from '@kitajs/html';
import { IconGitBranch } from '../components/Icons';

/**
 * Renders the Angular Router path for a component/entity as an inline
 * chip. Lives in the Info tab description area (below the description
 * prose, above metadata). Returns empty string when no route is set.
 *
 * Separate from {@link ExternalLinks} because external links (Storybook,
 * Figma, GitHub …) belong in the entity hero - they apply to every tab
 * - while the route is description-level metadata that only needs to
 * appear on the Info tab.
 */
export const RouteChip = (props: { readonly route?: string }): string => {
    if (!props.route) {
        return '';
    }

    return (
        <div class="cdx-route-chip" title={`Route: ${props.route}`}>
            <span class="cdx-route-chip-icon" aria-hidden="true">
                {IconGitBranch()}
            </span>
            <span class="cdx-route-chip-label">Route</span>
            <code class="cdx-route-chip-path">{props.route}</code>
        </div>
    ) as string;
};
