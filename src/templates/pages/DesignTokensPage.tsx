import Html from '@kitajs/html';
import type { DesignTokenGroup } from '../../app/styles/design-tokens';
import { markedAcl } from '../../utils/marked.acl';
import { pagefindMetaBlock, t } from '../helpers';

/** A token row: the Theming tab columns plus the file that defines it. */
export interface DesignTokenRow {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly defaultValue: string;
    readonly description: string;
    readonly deprecated: string | null;
    readonly file: string;
    /** The defining file's style page. */
    readonly href?: string;
}

/** What the `design-tokens` override receives under `groups`. */
export interface DesignTokensGroupData {
    readonly name: string;
    readonly id: string;
    readonly tokens: readonly DesignTokenRow[];
}

const fileLabel = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

const TokenRow = (row: DesignTokenRow): string => {
    const name = Html.escapeHtml(row.name) as string;
    const deprecated = row.deprecated !== null;
    return (
        `<div class="cdx-io-member cdx-io-member--theming${deprecated ? ' cdx-io-member--deprecated' : ''}" id="${row.id}" data-compodoc="design-token">` +
        `<div class="cdx-io-member-title">` +
        `<span class="cdx-io-member-name">${deprecated ? `<s>${name}</s>` : name}<a class="cdx-member-permalink" href="#${row.id}">#</a></span>` +
        (row.type
            ? `<span class="cdx-io-member-type"><code>${Html.escapeHtml(row.type) as string}</code></span>`
            : '') +
        `</div>` +
        (row.defaultValue
            ? `<div class="cdx-io-member-default"><span class="cdx-io-member-default-label">${t('default-value')}</span> <code>${Html.escapeHtml(row.defaultValue) as string}</code></div>`
            : '') +
        (row.description
            ? `<div class="cdx-io-member-desc cdx-prose">${markedAcl(row.description) as string}</div>`
            : '') +
        `<p class="cdx-theming-see cdx-theming-defined-in">${t('defined-in')}: ${
            row.href
                ? `<a href="${Html.escapeHtml(row.href) as string}"><code>${Html.escapeHtml(fileLabel(row.file)) as string}</code></a>`
                : `<code>${Html.escapeHtml(fileLabel(row.file)) as string}</code>`
        }</p>` +
        `</div>`
    );
};

const Group = (group: DesignTokensGroupData): string =>
    (
        <section class="cdx-content-section cdx-theming-group" data-group={group.name}>
            <h2 class="cdx-section-heading" id={group.id}>
                {Html.escapeHtml(group.name || t('design-tokens'))}
                <a class="cdx-member-permalink" href={`#${group.id}`}>
                    #
                </a>
            </h2>
            {group.tokens.map(TokenRow).join('')}
        </section>
    ) as string;

/**
 * The project's global design tokens (`design-tokens.html`): the documented
 * tokens of every style file that themes no symbol, by `@group`, each row
 * linking the file's style page. Override name: `design-tokens`.
 */
export const DesignTokensPage = (data: any): string => {
    const groups = (data.groups ?? []) as readonly DesignTokensGroupData[];
    const count = groups.reduce((sum, group) => sum + group.tokens.length, 0);
    return (
        <>
            <div class="cdx-entity-hero" style="--cdx-hero-color: var(--color-cdx-entity-style)">
                {pagefindMetaBlock({ kind: 'style' })}
                <h1 class="cdx-entity-hero-name">{t('design-tokens')}</h1>
                <div class="cdx-entity-hero-badges">
                    <span class="cdx-badge cdx-badge--entity-style">{String(count)}</span>
                </div>
            </div>
            {groups.map(Group).join('')}
        </>
    ) as string;
};
