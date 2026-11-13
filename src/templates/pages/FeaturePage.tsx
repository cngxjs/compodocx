import Html from '@kitajs/html';
import type { SemanticModel } from '../../app/compiler/semantic/model';
import type { DiView } from '../../app/di/model';
import type { MainDataInterface } from '../../app/interfaces/main-data.interface';
import { hrefFor, hrefText, routeAnchor } from '../../app/links/layout';
import { placedLink, symbolTarget } from '../../app/links/resolve';
import type { SymbolEntry, SymbolTable } from '../../app/links/symbol-table';
import type { FeatureCard, FeaturePageData } from '../../app/page-generator/feature-page-generator';
import type { RoutingModel } from '../../app/routing/model';
import { unlinkedTokenFiles } from '../../app/styles/design-tokens';
import { isDocumentedToken, type StyleFile } from '../../app/styles/model';
import { markedAcl } from '../../utils/marked.acl';
import { DiBadges } from '../components/DiBadges';
import { IconFolder } from '../components/Icons';
import { pageSummary, t } from '../helpers';
import {
    FEATURE_PAGE_SECTIONS,
    type FeatureMembers,
    type FeaturePageSection
} from '../helpers/feature-sections';
import { entryFacts } from '../helpers/symbol-facts';
import { hasTheming, themingFor } from '../helpers/theming';
import { featureRouteRows, RouteTree } from './Routes';

/**
 * The page of a feature (`features/<entry point>/<key>.html`): import path,
 * README, sub-features of an entry point, the members by role (each row
 * linking to where the member is documented), and the features of other
 * entry points it builds on or that extend it.
 *
 * Override name: `feature`.
 */

type MemberSection = FeaturePageSection;

const SECTIONS = FEATURE_PAGE_SECTIONS;

interface Context {
    readonly table: SymbolTable;
    readonly di: DiView | undefined;
    readonly semantic: SemanticModel | undefined;
    /** The route model; undefined when routes are disabled. */
    readonly routing: RoutingModel | undefined;
    readonly depth: number;
    readonly mainData: Pick<MainDataInterface, 'styles' | 'symbols'>;
}

const featureHref = (segments: readonly string[], depth: number): string =>
    hrefText(hrefFor({ type: 'feature', segments }, depth));

const memberHref = (entry: SymbolEntry, ctx: Context): string | undefined => {
    const link = placedLink(ctx.table, entry, ctx.di);
    return link ? hrefText(hrefFor(link.target, ctx.depth, link.anchor)) : undefined;
};

const Heading = (id: string, title: string, count?: number): string =>
    (
        <h2 class="cdx-section-heading" id={id}>
            {title}
            {count === undefined ? '' : <span class="cdx-badge cdx-badge--count">{count}</span>}
            <a class="cdx-member-permalink" href={`#${id}`}>
                #
            </a>
        </h2>
    ) as string;

const MemberRow = (entry: SymbolEntry, ctx: Context): string => {
    const href = memberHref(entry, ctx);
    const name = <code>{entry.ref.name}</code>;
    const summary = pageSummary((entry.data as { description?: unknown }).description);
    return (
        <li class="cdx-feature-row" data-cdx-feature-member={entry.ref.kind}>
            <span class="cdx-feature-row-name">
                {href ? <a href={href}>{name}</a> : name}
                {DiBadges({ facts: entryFacts(ctx.semantic, entry) })}
            </span>
            <span class="cdx-feature-row-summary">{summary ?? ''}</span>
        </li>
    ) as string;
};

const Members = (section: MemberSection, members: FeatureMembers, ctx: Context): string => {
    const entries = section.lists.flatMap(list => members[list]);
    if (entries.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading(section.id, t(section.titleKey), entries.length)}
            <ul class="cdx-feature-rows">{entries.map(entry => MemberRow(entry, ctx))}</ul>
        </section>
    ) as string;
};

/** Links in a card summary read as their text: the whole card is one link. */
const unlinked = (html: string): string => html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');

/** Counts per section of an entry point card, labelled like the jump bar. */
const CardKinds = (card: FeatureCard): string =>
    card.kinds && card.kinds.length > 0
        ? ((
              <p class="cdx-feature-card-kinds">
                  {card.kinds.map(
                      kind =>
                          (
                              <span title={`${t(kind.section)}: ${kind.count}`}>
                                  <span class="cdx-feature-card-kind">{t(kind.section)}</span>
                                  <b>{String(kind.count)}</b>
                              </span>
                          ) as string
                  )}
              </p>
          ) as string)
        : '';

/**
 * Feature cards: name linked to the feature page (the link covers the whole
 * card), member count, optional import path, README summary and, for entry
 * points, the counts per section.
 */
const FeatureCards = (
    cards: readonly FeatureCard[],
    depth: number,
    options: { readonly importLine: boolean }
): string =>
    (
        <ul class="cdx-feature-cards">
            {cards.map(
                card =>
                    (
                        <li class="cdx-feature-card" data-cdx-feature-card={card.id}>
                            <div class="cdx-feature-card-top">
                                <a
                                    class="cdx-feature-card-name"
                                    href={featureHref(card.segments, depth)}
                                >
                                    {card.label}
                                </a>
                                <span class="cdx-badge cdx-badge--count">
                                    {String(card.memberCount)}
                                </span>
                            </div>
                            {options.importLine && card.entryPoint ? (
                                <code class="cdx-feature-card-import">{card.entryPoint}</code>
                            ) : (
                                ''
                            )}
                            {card.summary ? (
                                <p class="cdx-feature-card-summary">{unlinked(card.summary)}</p>
                            ) : (
                                ''
                            )}
                            {CardKinds(card)}
                        </li>
                    ) as string
            )}
        </ul>
    ) as string;

/** The entry points below this one (parent entry point pages only). */
const EntryPoints = (cards: readonly FeatureCard[], depth: number): string =>
    cards.length === 0
        ? ''
        : ((
              <section class="cdx-content-section">
                  {Heading('entry-points', t('entry-points'), cards.length)}
                  {FeatureCards(cards, depth, { importLine: true })}
              </section>
          ) as string);

const SubFeatures = (cards: readonly FeatureCard[], depth: number): string =>
    cards.length === 0
        ? ''
        : ((
              <section class="cdx-content-section">
                  {Heading('features', t('features'), cards.length)}
                  {FeatureCards(cards, depth, { importLine: false })}
              </section>
          ) as string);

/** Features of other entry points, with their import path. */
const Related = (
    id: string,
    title: string,
    cards: readonly FeatureCard[],
    depth: number
): string => {
    if (cards.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading(id, title, cards.length)}
            <ul class="cdx-feature-rows">
                {cards.map(
                    card =>
                        (
                            <li class="cdx-feature-row" data-cdx-feature-related={card.id}>
                                <span class="cdx-feature-row-name">
                                    <a href={featureHref(card.segments, depth)}>
                                        <code>{card.label}</code>
                                    </a>
                                </span>
                                <span class="cdx-feature-row-summary">
                                    {card.entryPoint ? <code>{card.entryPoint}</code> : ''}
                                </span>
                            </li>
                        ) as string
                )}
            </ul>
        </section>
    ) as string;
};

/** Distinct non-empty token groups of a style file, in order of first appearance. */
const tokenGroups = (file: StyleFile): readonly string[] => [
    ...new Set(file.tokens.map(token => token.group).filter(group => group !== ''))
];

/** The components and directives a style file themes, linked where they have a page. */
const ThemedTargets = (file: StyleFile, ctx: Context): string => {
    const targets = file.themes.flatMap(id => {
        const entry = ctx.table?.byId.get(id);
        return entry ? [entry] : [];
    });
    if (targets.length === 0) {
        return '';
    }
    return (
        <p class="cdx-feature-card-for">
            <span class="cdx-feature-card-for-label">{t('theming-applies-to')}</span>
            {targets.map(entry => {
                const href = memberHref(entry, ctx);
                const name = <code>{entry.ref.name}</code>;
                return href ? ((<a href={href}>{name}</a>) as string) : (name as string);
            })}
        </p>
    ) as string;
};

/**
 * A style page card: file name linked to its page, first sentence of its
 * overview, documented token count, mixin count and token groups, and the
 * components and directives it themes.
 */
const StyleCard = (entry: SymbolEntry, ctx: Context): string => {
    const file = entry.data as StyleFile;
    const summary = pageSummary(file.overview ? (markedAcl(file.overview) as string) : '');
    const tokens = file.tokens.filter(isDocumentedToken).length;
    const groups = tokenGroups(file);
    const meta = [
        tokens > 0 ? `<span><b>${tokens}</b> ${t('tokens')}</span>` : '',
        file.mixins.length > 0 ? `<span><b>${file.mixins.length}</b> ${t('mixins')}</span>` : '',
        groups.length > 0
            ? `<span>${groups.map(group => Html.escapeHtml(group)).join(' &middot; ')}</span>`
            : ''
    ].filter(Boolean);
    return (
        <li class="cdx-feature-card" data-cdx-feature-member="style">
            <div class="cdx-feature-card-top">
                <a
                    class="cdx-feature-card-name"
                    href={hrefText(hrefFor(symbolTarget(entry), ctx.depth))}
                >
                    <code>{fileName(file.file)}</code>
                </a>
            </div>
            {summary ? <p class="cdx-feature-card-summary">{summary}</p> : ''}
            {meta.length > 0 ? <p class="cdx-feature-card-meta">{meta.join('')}</p> : ''}
            {ThemedTargets(file, ctx)}
        </li>
    ) as string;
};

/**
 * The routes whose component or lazily loaded route array is a member of the
 * feature, as a tree with the routes above them as context, each linked to
 * its row on the routes page.
 */
const FeatureRoutes = (members: FeatureMembers, ctx: Context): string => {
    const ids = new Set(Object.values(members).flatMap(list => list.map(entry => entry.id)));
    const rows = ctx.routing ? featureRouteRows(ctx.routing.roots, id => ids.has(id)) : [];
    const own = rows.filter(row => !row.context);
    if (own.length === 0) {
        return '';
    }
    const routesPage = hrefText(
        hrefFor({ type: 'root', page: 'routes' }, ctx.depth, routeAnchor(rows[0].node.id))
    );
    return (
        <section class="cdx-content-section cdx-routes-root" data-compodoc="feature-routes">
            {Heading('routes', t('routes'), own.length)}
            <p class="cdx-feature-routes-link">
                <a href={routesPage}>{t('view-on-routes-page')}</a>
            </p>
            {RouteTree(rows, { depth: ctx.depth, table: ctx.table, di: ctx.di, linkRows: true })}
        </section>
    ) as string;
};

const fileName = (file: string): string => file.slice(file.lastIndexOf('/') + 1);

/**
 * The feature's style pages, its components and directives with a Theming
 * tab (linked to it), and the design tokens page when one of the feature's
 * style files feeds it.
 */
/** The feature's components and directives that have a Theming tab. */
const themedMembers = (members: FeatureMembers, ctx: Context): readonly SymbolEntry[] => {
    const themedOf = (entries: readonly SymbolEntry[], kind: 'component' | 'directive') =>
        entries.filter(entry => hasTheming(themingFor(entry.data as never, kind, ctx.mainData)));
    return [
        ...themedOf(members.components, 'component'),
        ...themedOf(members.directives, 'directive')
    ];
};

const Theming = (members: FeatureMembers, styles: readonly SymbolEntry[], ctx: Context): string => {
    const themed = themedMembers(members, ctx);
    const tokenPage = styles.some(
        entry => unlinkedTokenFiles([entry.data as StyleFile]).length > 0
    );
    if (themed.length === 0 && styles.length === 0) {
        return '';
    }
    return (
        <section class="cdx-content-section">
            {Heading('theming', t('theming'), themed.length + styles.length)}
            {styles.length > 0 ? (
                <ul class="cdx-feature-cards">{styles.map(entry => StyleCard(entry, ctx))}</ul>
            ) : (
                ''
            )}
            {tokenPage ? (
                <p class="cdx-feature-design-tokens">
                    <a href={hrefText(hrefFor({ type: 'root', page: 'design-tokens' }, ctx.depth))}>
                        {t('design-tokens')}
                    </a>
                </p>
            ) : (
                ''
            )}
            {themed.length > 0 ? (
                <ul>
                    {themed.map(
                        entry =>
                            (
                                <li>
                                    <a
                                        href={hrefText(
                                            hrefFor(symbolTarget(entry), ctx.depth, 'theming')
                                        )}
                                    >
                                        <code>{entry.ref.name}</code>
                                    </a>
                                </li>
                            ) as string
                    )}
                </ul>
            ) : (
                ''
            )}
        </section>
    ) as string;
};

/**
 * Links to the page's sub-features, member sections and theming section, in
 * page order, each with its count; sections without entries are left out.
 */
const JumpBar = (feature: FeaturePageData, ctx: Context): string => {
    const styles = feature.styles ?? [];
    const links = [
        { id: 'entry-points', label: t('entry-points'), count: feature.entryPoints.length },
        { id: 'features', label: t('features'), count: feature.subFeatures.length },
        ...SECTIONS.map(section => ({
            id: section.id,
            label: t(section.titleKey),
            count: section.lists.reduce((sum, list) => sum + feature.members[list].length, 0)
        })),
        {
            id: 'theming',
            label: t('theming'),
            count: themedMembers(feature.members, ctx).length + styles.length
        }
    ].filter(link => link.count > 0);
    if (links.length === 0) {
        return '';
    }
    return (
        <nav class="cdx-feature-jump" aria-label={t('on-this-page')}>
            <ul class="cdx-feature-jump-list">
                {links.map(
                    link =>
                        (
                            <li>
                                <a class="cdx-feature-jump-link" href={`#${link.id}`}>
                                    {link.label}
                                    <span class="cdx-badge cdx-badge--count">{link.count}</span>
                                </a>
                            </li>
                        ) as string
                )}
            </ul>
        </nav>
    ) as string;
};

export const FeaturePage = (data: any): string => {
    const feature: FeaturePageData = data.feature;
    const ctx: Context = {
        table: data.symbols,
        di: data.di,
        semantic: data.semantic,
        routing: data.disableRoutes ? undefined : data.routing,
        depth: data.depth,
        mainData: { styles: data.styles, symbols: data.symbols }
    };
    return (
        <>
            <div
                class="cdx-entity-hero"
                style="--cdx-hero-color: var(--color-cdx-text-secondary)"
                data-cdx-feature={feature.id}
            >
                <div class="cdx-entity-hero-watermark" aria-hidden="true">
                    {IconFolder()}
                </div>
                <nav aria-label="Breadcrumb">
                    <ol class="cdx-breadcrumb">
                        {feature.parent ? (
                            <li>
                                <a href={featureHref(feature.parent.segments, ctx.depth)}>
                                    {feature.parent.label}
                                </a>
                            </li>
                        ) : (
                            <li>{t('features')}</li>
                        )}
                        <li aria-current="page">{feature.label}</li>
                    </ol>
                </nav>
                <h1 class="cdx-entity-hero-name">
                    <span>{feature.label}</span>
                </h1>
                {feature.importPath ? (
                    <p class="cdx-entity-hero-selector">
                        <code>{`import { ... } from '${feature.importPath}';`}</code>
                    </p>
                ) : (
                    ''
                )}
                <div class="cdx-entity-hero-badges">
                    <span
                        class="cdx-badge cdx-badge--outline"
                        data-cdx-feature-detector={feature.detector}
                    >
                        {t(`feature-detector-${feature.detector}`)}
                    </span>
                </div>
            </div>
            {JumpBar(feature, ctx)}
            {feature.readme ? (
                <section class="cdx-content-section">
                    {Heading('overview', t('overview'))}
                    <div class="cdx-readme">{feature.readme.html as string}</div>
                </section>
            ) : (
                ''
            )}
            {EntryPoints(feature.entryPoints, ctx.depth)}
            {SubFeatures(feature.subFeatures, ctx.depth)}
            {SECTIONS.map(section => Members(section, feature.members, ctx))}
            {FeatureRoutes(feature.members, ctx)}
            {Theming(feature.members, feature.styles ?? [], ctx)}
            {Related('builds-on', t('builds-on'), feature.buildsOn, ctx.depth)}
            {Related('extended-by', t('extended-by'), feature.extendedBy, ctx.depth)}
        </>
    ) as string;
};
