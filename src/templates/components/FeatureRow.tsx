import Html from '@kitajs/html';

/**
 * One row of a `ul.cdx-feature-rows` list: the (linked) name, then a one
 * line summary. Shared by the feature page and the landing pages so every
 * symbol list reads the same. `name` and `summary` are HTML; `attrs` carries
 * the row's `data-cdx-*` attributes (undefined values are left out).
 */
export const FeatureRow = (props: {
    readonly name: string;
    readonly summary?: string;
    readonly attrs?: Readonly<Record<string, string | undefined>>;
}): string =>
    (
        <li class="cdx-feature-row" {...props.attrs}>
            <span class="cdx-feature-row-name">{props.name}</span>
            <span class="cdx-feature-row-summary">{props.summary ?? ''}</span>
        </li>
    ) as string;

/** The `ul.cdx-feature-rows` list around rendered rows. */
export const FeatureRows = (rows: readonly string[]): string =>
    (<ul class="cdx-feature-rows">{rows.join('')}</ul>) as string;
