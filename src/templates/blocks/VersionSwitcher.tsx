import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { hrefFor, hrefText } from '../../app/links/layout';

type VersionSwitcherProps = {
    /** The version label of the current build (e.g. `v0.3.0`). */
    readonly currentLabel: string;
    /** Per-page depth so the manifest URL is correctly relative. */
    readonly depth: number;
    /** Switcher dropdown cap. `0` is unlimited. */
    readonly maxVersionsShown: number;
};

/**
 * Topbar widget that lets the reader switch between built versions.
 *
 * The server side knows three things: the label the page belongs to, the
 * relative URL to `versions.json`, and the dropdown cap. The dropdown
 * itself is populated client-side at runtime from `versions.json` so a
 * later build's manifest extends every previously-shipped page.
 */
export const VersionSwitcher = (props: VersionSwitcherProps): string => {
    const custom = renderCustomTemplate('version-switcher', props);
    if (custom !== null) {
        return custom;
    }
    // The manifest sits at <versionsRoot>/versions.json — one folder ABOVE
    // <versionsRoot>/<label>/<page-path>. So every page needs one extra
    // parent traversal beyond `props.depth`.
    const manifestUrl = hrefText(
        hrefFor({ type: 'asset', path: 'versions.json' }, props.depth + 1)
    );
    const cap = Number.isFinite(props.maxVersionsShown) ? props.maxVersionsShown : 10;
    return (
        <div
            class="cdx-version-switcher"
            data-compodoc="version-switcher"
            data-cdx-current-label={props.currentLabel}
            data-cdx-manifest-url={manifestUrl}
            data-cdx-max-shown={String(cap)}
        >
            <button
                type="button"
                class="cdx-version-switcher-trigger"
                aria-haspopup="listbox"
                aria-expanded="false"
                aria-label={`Switch documentation version (current: ${props.currentLabel})`}
            >
                <span class="cdx-version-switcher-label">{props.currentLabel}</span>
                <svg
                    class="cdx-version-switcher-caret"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>
            <div class="cdx-version-switcher-menu" role="listbox" hidden>
                {/* populated by client-side js from versions.json */}
            </div>
        </div>
    ) as string;
};
