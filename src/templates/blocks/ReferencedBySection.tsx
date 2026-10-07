import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { pageFile, relativePrefix } from '../../app/links/layout';
import { t } from '../helpers';

/** Entry rendered as a chip in the Referenced by list. */
export interface ReferencedByEntry {
    readonly name: string;
    readonly kind: string;
    readonly hrefPrefix: string;
}

/**
 * Builds the `<a>` href for a reference-page → primary-entity backlink.
 * Reference pages live at depth 1 (`interfaces/Foo.html`) or depth 2 for
 * `@category`-tagged miscellaneous detail pages
 * (`miscellaneous/functions/foo.html`); depth is supplied by the page.
 */
function referencedByHref(entry: ReferencedByEntry, depth: number): string {
    return `${relativePrefix(Math.max(depth, 0), 'bare')}${pageFile(entry.hrefPrefix, entry.name)}`;
}

/**
 * Renders the "Referenced by" chip-list section on a Reference-kind page.
 * Returns an empty string when `entries` is missing or empty — callers can
 * inline the call without an extra guard.
 *
 * Overridable as `referenced-by` via `--templates`.
 */
export const ReferencedBySection = (props: {
    entries?: ReferencedByEntry[];
    depth: number;
}): string => {
    const entries = props.entries ?? [];
    if (entries.length === 0) {
        return '';
    }

    const custom = renderCustomTemplate('referenced-by', props);
    if (custom !== null) {
        return custom;
    }

    return (
        <section class="cdx-content-section cdx-referenced-by" data-compodoc="referenced-by">
            <h3 class="cdx-section-heading" id="referenced-by">
                {t('referenced-by')}
                <a class="cdx-member-permalink" href="#referenced-by">
                    #
                </a>
            </h3>
            <div class="cdx-chip-list">
                {entries.map(entry => (
                    <a
                        class={`cdx-chip cdx-chip--${entry.kind}`}
                        href={referencedByHref(entry, props.depth)}
                        data-cdx-kind={entry.kind}
                    >
                        {entry.name}
                    </a>
                ))}
            </div>
        </section>
    ) as string;
};
