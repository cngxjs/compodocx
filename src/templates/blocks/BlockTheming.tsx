import Html from '@kitajs/html';
import { renderCustomTemplate } from '../../app/engines/custom-template.engine';
import { highlightCode } from '../../app/engines/syntax-highlight.engine';
import type {
    StyleMixin,
    StyleSource,
    ThemeToken,
    ThemeTokenGroup
} from '../../utils/theme-doc-parser';
import { groupThemeTokens } from '../../utils/theme-doc-parser';
import { isThemingSection, t } from '../helpers';
import { themingProse } from '../helpers/theming-prose';
import { type RelatedEntry, resolveRelated } from './RelatedSection';

type BlockThemingProps = {
    readonly tokens: ThemeToken[];
    readonly styleSources?: StyleSource[];
    /** Markdown intro harvested from `@overview` blocks; rendered above the index. */
    readonly overview?: string;
    /** Documented SCSS mixins and functions; rendered after the tokens. */
    readonly mixins?: readonly StyleMixin[];
    /** Style files that theme the symbol (`@themes`), named above the overview. */
    readonly linked?: readonly { readonly label: string; readonly href?: string }[];
    /** Tokens rendered by another block on the same page that `{@link --name}` may target. */
    readonly linkTokens?: readonly ThemeToken[];
    readonly depth?: number;
};

/** Markdown to HTML with `{@link}` resolved (see `themingProse`). */
type Prose = (markdown: string) => string;

const slugifyId = (raw: string): string =>
    raw
        .replace(/^[$-]+/, '')
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-+|-+$/g, '');

const tokenAnchor = (token: ThemeToken): string => `theme-${slugifyId(token.name)}`;

/**
 * Row ids of the tokens a page renders, by token name, for `{@link --name}`;
 * empty when `themingTabSections` hides the token rows.
 */
export const tokenAnchors = (tokens: readonly ThemeToken[]): ReadonlyMap<string, string> =>
    new Map(
        isThemingSection('tokens') ? tokens.map(token => [token.name, tokenAnchor(token)]) : []
    );

const renderBadges = (token: Pick<ThemeToken, 'since' | 'deprecated'>): string => {
    const badges: string[] = [];
    if (token.since) {
        badges.push(
            `<span class="cdx-badge cdx-badge--since">${
                Html.escapeHtml(token.since) as string
            }</span>`
        );
    }
    if (token.deprecated !== null) {
        const reason = token.deprecated
            ? ` title="${Html.escapeHtml(token.deprecated) as string}"`
            : '';
        badges.push(
            `<span class="cdx-badge cdx-badge--deprecated"${reason}>${
                Html.escapeHtml(t('deprecated')) as string
            }</span>`
        );
    }
    return badges.join('');
};

const renderExamples = (token: { readonly examples: readonly string[] }): string =>
    token.examples
        .map(example => {
            const fence = example.match(/^```(\w+)\n([\s\S]*?)\n```$/);
            const lang = fence ? fence[1] : 'css';
            const code = fence ? fence[2] : example;
            return `<div class="cdx-theming-example">${highlightCode(code, {
                lang,
                mode: 'snippet'
            })}</div>`;
        })
        .join('');

const renderSeeLinks = (token: { readonly see: readonly string[] }): string => {
    if (token.see.length === 0) {
        return '';
    }
    const items = token.see
        .map(s => {
            const escaped = Html.escapeHtml(s) as string;
            if (/^https?:/i.test(s)) {
                return `<a href="${escaped}" rel="noopener" target="_blank">${escaped}</a>`;
            }
            if (s.startsWith('--') || s.startsWith('$')) {
                return `<a href="#theme-${slugifyId(s)}"><code>${escaped}</code></a>`;
            }
            return escaped;
        })
        .join(', ');
    return `<p class="cdx-theming-see">${t('see')}: ${items}</p>`;
};

/** `@relatedTo` chips of a token; unresolved names render as code. */
const renderRelated = (related: readonly RelatedEntry[]): string => {
    if (related.length === 0) {
        return '';
    }
    const items = related
        .map(entry => {
            const name = Html.escapeHtml(entry.name) as string;
            return entry.href
                ? `<a class="cdx-related-pill" href="${Html.escapeHtml(entry.href) as string}">${name}</a>`
                : `<code>${name}</code>`;
        })
        .join(' ');
    return `<p class="cdx-theming-see cdx-theming-related">${t('related')}: ${items}</p>`;
};

const renderTokenRow = (token: ThemeToken, prose: Prose, depth?: number): string => {
    const related = (token.relatedTo ?? []).map(name => resolveRelated(name, depth ?? 0));
    const custom = renderCustomTemplate('block-theming-token', {
        token,
        depth,
        ...(related.length > 0 && { related })
    });
    if (custom !== null) {
        return custom;
    }

    const id = tokenAnchor(token);
    const cls = ['cdx-io-member', 'cdx-io-member--theming', `cdx-io-member--theming-${token.kind}`];
    if (token.deprecated !== null) {
        cls.push('cdx-io-member--deprecated');
    }
    const escapedName = Html.escapeHtml(token.name) as string;
    const nameHtml = token.deprecated !== null ? `<s>${escapedName}</s>` : escapedName;

    const typeHtml = token.type
        ? `<span class="cdx-io-member-type"><code>${Html.escapeHtml(token.type) as string}</code></span>`
        : '';

    const badgesRow = renderBadges(token);
    const descHtml = token.description
        ? `<div class="cdx-io-member-desc cdx-prose">${prose(token.description)}</div>`
        : '';
    const deprecatedReason = token.deprecated
        ? `<p class="cdx-theming-deprecated">${prose(token.deprecated)}</p>`
        : '';
    const defaultHtml = token.defaultValue
        ? `<div class="cdx-io-member-default"><span class="cdx-io-member-default-label">${t(
              'default-value'
          )}</span> <code>${Html.escapeHtml(token.defaultValue) as string}</code></div>`
        : '';

    return (
        `<div class="${cls.join(' ')}" id="${id}" data-compodoc="block-theming-token">` +
        `<div class="cdx-io-member-title">` +
        `<span class="cdx-io-member-name${
            token.deprecated !== null ? ' cdx-member-name--deprecated' : ''
        }">${nameHtml}<a class="cdx-member-permalink" href="#${id}">#</a></span>` +
        typeHtml +
        `</div>` +
        (badgesRow ? `<div class="cdx-io-member-badges">${badgesRow}</div>` : '') +
        defaultHtml +
        descHtml +
        deprecatedReason +
        renderExamples(token) +
        renderSeeLinks(token) +
        renderRelated(related) +
        `</div>`
    );
};

const renderGroup = (group: ThemeTokenGroup, prose: Prose, depth?: number): string => {
    const heading = group.name
        ? `<h4 class="cdx-section-heading" id="theme-group-${slugifyId(group.name)}">${
              Html.escapeHtml(group.name) as string
          }</h4>`
        : '';
    const members = group.tokens.map(token => renderTokenRow(token, prose, depth)).join('');
    return (
        `<section class="cdx-theming-group" data-group="${
            Html.escapeHtml(group.name) as string
        }">` +
        heading +
        members +
        `</section>`
    );
};

const renderIndex = (groups: ThemeTokenGroup[]): string => {
    const total = groups.reduce((acc, g) => acc + g.tokens.length, 0);
    if (total < 2) {
        return '';
    }
    const groupHtml = groups
        .filter(g => g.tokens.length > 0)
        .map(group => {
            const label = group.name || t('theming');
            const entries = group.tokens
                .map(token => {
                    const cls = ['cdx-index-entry'];
                    if (token.deprecated !== null) {
                        cls.push('cdx-index-entry--deprecated');
                    }
                    return (
                        `<a href="#${tokenAnchor(token)}" class="${cls.join(' ')}">` +
                        `<span class="cdx-index-indicator cdx-index-indicator--theming" aria-hidden="true">T</span>` +
                        `<span class="cdx-index-name">${
                            Html.escapeHtml(token.name) as string
                        }</span>` +
                        `</a>`
                    );
                })
                .join('');
            return (
                `<div class="cdx-index-group">` +
                `<h4 class="cdx-index-group-label">${Html.escapeHtml(label) as string}</h4>` +
                `<div class="cdx-index-entries">${entries}</div>` +
                `</div>`
            );
        })
        .join('');
    return (
        `<section class="cdx-content-section" data-compodoc="block-theming-index">` +
        `<h3 class="cdx-section-heading" id="theme-index">${t('index')}` +
        `<a class="cdx-member-permalink" href="#theme-index">#</a></h3>` +
        `<div class="cdx-index">${groupHtml}</div>` +
        `</section>`
    );
};

const mixinAnchor = (mixin: StyleMixin): string => `theme-${mixin.kind}-${slugifyId(mixin.name)}`;

/** `name($a, $b: 1)` as declared, defaults included. */
const mixinSignature = (mixin: StyleMixin): string =>
    `${mixin.name}(${mixin.params
        .map(param => `$${param.name}${param.default ? `: ${param.default}` : ''}`)
        .join(', ')})`;

const renderMixinParams = (mixin: StyleMixin, prose: Prose): string => {
    if (mixin.params.length === 0) {
        return '';
    }
    const rows = mixin.params
        .map(param => {
            const type = param.type
                ? ` <span class="cdx-io-member-type"><code>${Html.escapeHtml(param.type) as string}</code></span>`
                : '';
            const fallback = param.default
                ? ` <span class="cdx-io-member-default-label">${t('default-value')}</span> <code>${
                      Html.escapeHtml(param.default) as string
                  }</code>`
                : '';
            const desc = param.description
                ? `<div class="cdx-prose">${prose(param.description)}</div>`
                : '';
            return `<li><code>$${Html.escapeHtml(param.name) as string}</code>${type}${fallback}${desc}</li>`;
        })
        .join('');
    return `<div class="cdx-theming-params"><h5>${t('parameters')}</h5>` + `<ul>${rows}</ul></div>`;
};

const renderMixin = (mixin: StyleMixin, prose: Prose, depth?: number): string => {
    const related = mixin.relatedTo.map(name => resolveRelated(name, depth ?? 0));
    const custom = renderCustomTemplate('block-theming-mixin', { mixin, depth, related });
    if (custom !== null) {
        return custom;
    }
    const id = mixinAnchor(mixin);
    const name = Html.escapeHtml(mixin.name) as string;
    const deprecated = mixin.deprecated !== null;
    const badges = renderBadges(mixin);
    const contentHtml =
        mixin.content !== null
            ? `<p class="cdx-theming-mixin-content">${t('mixin-content')}${
                  mixin.content ? `: ${prose(mixin.content)}` : ''
              }</p>`
            : '';
    const returnsHtml = mixin.returns
        ? `<p class="cdx-theming-mixin-returns">${t('returns')}: ${prose(mixin.returns)}</p>`
        : '';
    return (
        `<div class="cdx-io-member cdx-io-member--theming cdx-io-member--theming-${mixin.kind}${
            deprecated ? ' cdx-io-member--deprecated' : ''
        }" id="${id}" data-compodoc="block-theming-mixin">` +
        `<div class="cdx-io-member-title">` +
        `<span class="cdx-io-member-name${deprecated ? ' cdx-member-name--deprecated' : ''}">${
            deprecated ? `<s>${name}</s>` : name
        }<a class="cdx-member-permalink" href="#${id}">#</a></span>` +
        `<span class="cdx-io-member-type"><code>@${mixin.kind}</code></span>` +
        `</div>` +
        (badges ? `<div class="cdx-io-member-badges">${badges}</div>` : '') +
        `<div class="cdx-theming-mixin-signature"><code>${
            Html.escapeHtml(mixinSignature(mixin)) as string
        }</code></div>` +
        (mixin.description
            ? `<div class="cdx-io-member-desc cdx-prose">${prose(mixin.description)}</div>`
            : '') +
        (mixin.deprecated
            ? `<p class="cdx-theming-deprecated">${prose(mixin.deprecated)}</p>`
            : '') +
        renderMixinParams(mixin, prose) +
        contentHtml +
        returnsHtml +
        renderExamples(mixin) +
        renderSeeLinks(mixin) +
        renderRelated(related) +
        `</div>`
    );
};

const renderMixins = (mixins: readonly StyleMixin[], prose: Prose, depth?: number): string => {
    if (mixins.length === 0) {
        return '';
    }
    return (
        `<section class="cdx-content-section" data-compodoc="block-theming-mixins">` +
        `<h3 class="cdx-section-heading" id="theme-mixins">${t('mixins')}` +
        `<a class="cdx-member-permalink" href="#theme-mixins">#</a></h3>` +
        mixins.map(mixin => renderMixin(mixin, prose, depth)).join('') +
        `</section>`
    );
};

const renderLinked = (linked: readonly { label: string; href?: string }[]): string => {
    if (linked.length === 0) {
        return '';
    }
    const items = linked
        .map(file => {
            const label = Html.escapeHtml(file.label) as string;
            return file.href
                ? `<a href="${Html.escapeHtml(file.href) as string}"><code>${label}</code></a>`
                : `<code>${label}</code>`;
        })
        .join(', ');
    return `<p class="cdx-theming-see cdx-theming-linked">${t('style-files')}: ${items}</p>`;
};

const renderSourcePanel = (sources: StyleSource[]): string => {
    if (!sources || sources.length === 0) {
        return '';
    }
    const items = sources
        .map(src => {
            const label = src.file.startsWith('<inline-style-')
                ? src.file
                : src.file.split('/').slice(-2).join('/');
            return (
                `<section class="cdx-theming-source-file">` +
                `<h5 class="cdx-theming-source-file-name">${
                    Html.escapeHtml(label) as string
                }</h5>` +
                highlightCode(src.content, { lang: src.language, mode: 'snippet' }) +
                `</section>`
            );
        })
        .join('');
    return (
        `<details class="cdx-theming-source">` +
        `<summary>${t('source')}</summary>` +
        items +
        `</details>`
    );
};

export const BlockTheming = (props: BlockThemingProps): string => {
    const tokens = props.tokens ?? [];
    const styleSources = props.styleSources ?? [];
    const overview = (props.overview ?? '').trim();
    const mixins = props.mixins ?? [];
    const linked = props.linked ?? [];
    const groups = groupThemeTokens(tokens);

    const overrideArgs = {
        groups,
        styleSources,
        overview,
        depth: props.depth,
        ...(mixins.length > 0 && { mixins }),
        ...(linked.length > 0 && { linked })
    };
    const custom = renderCustomTemplate('block-theming', overrideArgs);
    if (custom !== null) {
        return custom;
    }

    const anchors = tokenAnchors([...tokens, ...(props.linkTokens ?? [])]);
    const prose: Prose = markdown => themingProse(markdown, props.depth ?? 0, anchors);
    const linkedHtml = renderLinked(linked);
    const overviewHtml =
        isThemingSection('overview') && overview
            ? `<div class="cdx-theming-overview cdx-prose">${prose(overview)}</div>`
            : '';
    const indexHtml = isThemingSection('index') ? renderIndex(groups) : '';
    const tokensHtml = isThemingSection('tokens')
        ? groups.map(group => renderGroup(group, prose, props.depth)).join('')
        : '';
    const mixinsHtml = isThemingSection('mixins') ? renderMixins(mixins, prose, props.depth) : '';
    const sourceHtml = isThemingSection('source') ? renderSourcePanel(styleSources) : '';

    return (
        <section data-compodoc="block-theming">
            {linkedHtml}
            {overviewHtml}
            {indexHtml}
            {tokensHtml}
            {mixinsHtml}
            {sourceHtml}
        </section>
    ) as string;
};
